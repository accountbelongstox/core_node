# -*- coding: utf-8 -*-
"""
Sentence-audio queue monitor — Laravel missing-sentence list + priority-bump detection.

Mirrors queue_monitor_service (translation) for the sentence-library lane so the
Queue Center can show live rows, bump highlights, and generation activity while
book-reader bumps tts_priority.
"""

import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import resolve_laravel_base_url
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub

_MISSING_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/missing"
_HTTP_TIMEOUT = 60
_POLL_LIMIT = 50


class SentenceQueueMonitorService:
    """Monitor missing sentence audio rows and detect tts_priority bumps."""

    _instance: Optional["SentenceQueueMonitorService"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, bump_ttl_seconds: int = 30) -> None:
        if getattr(self, "_initialized", False):
            return
        self._lock = threading.Lock()
        self._bump_ttl = float(bump_ttl_seconds)
        self._prev_priority: Dict[str, int] = {}
        self._bumped_until: Dict[str, float] = {}
        self._snapshot: Dict[str, Any] = {"items": [], "total": 0, "reachable": False}
        self._snapshot_ts = 0.0
        self._laravel_reachable = False
        self._unreachable_warned = False
        self._last_logged_shape: Optional[Tuple[int, int]] = None
        # Non-reentrant guard: the fetch runs on its own daemon thread so the
        # heartbeat thread never blocks on network I/O (up to _HTTP_TIMEOUT).
        self._poll_running = False
        self._initialized = True

    @staticmethod
    def _row_key(item: Dict[str, Any]) -> str:
        cid = str(item.get("content_id") or "")
        lang = str(item.get("language") or "")
        return f"{lang}:{cid}"

    @staticmethod
    def _as_int(value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _base_url(self) -> str:
        return (resolve_laravel_base_url() or "").rstrip("/")

    def _fetch_missing(self) -> Optional[Dict[str, Any]]:
        base = self._base_url()
        if not base:
            return None
        try:
            resp = get_laravel_client().get(
                _MISSING_PATH,
                base_url=base,
                params={"page": 1, "per_page": _POLL_LIMIT},
                timeout=_HTTP_TIMEOUT,
            )
        except Exception as exc:  # noqa: BLE001
            if not self._unreachable_warned:
                self._unreachable_warned = True
                # Name the exact Laravel base (:9000) that was probed so this can
                # never be mistaken for the code-sync peer mesh (pycore :59000).
                ColorPrint.yellow(
                    f"[SentenceQueueMonitor] Laravel backend ({base}) unreachable "
                    f"({exc}); polling quietly."
                )
            return None
        if resp.status_code != 200:
            return None
        try:
            body = resp.json() or {}
        except ValueError:
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return data if isinstance(data, dict) else None

    def _apply_bump_detection(self, items: List[Dict[str, Any]]) -> None:
        hub = get_queue_bump_hub()
        now = time.monotonic()
        new_prev: Dict[str, int] = {}
        for item in items:
            key = self._row_key(item)
            priority = self._as_int(item.get("tts_priority"))
            new_prev[key] = priority
            prior = self._prev_priority.get(key)
            if prior is not None and priority > prior:
                self._bumped_until[key] = now + self._bump_ttl
                hub.record(
                    lane="sentence_audio",
                    item_id=key,
                    label=(item.get("text") or key)[:80],
                    old_priority=prior,
                    new_priority=priority,
                    meta={
                        "language": item.get("language"),
                        "content_id": item.get("content_id"),
                        "tts_status": item.get("tts_status"),
                    },
                )
        self._prev_priority = new_prev
        self._bumped_until = {
            k: exp for k, exp in self._bumped_until.items()
            if exp > now and k in new_prev
        }

    def _decorate_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now = time.monotonic()
        hub = get_queue_bump_hub()
        out: List[Dict[str, Any]] = []
        for item in items:
            row = dict(item)
            key = self._row_key(item)
            exp = self._bumped_until.get(key)
            row["recently_bumped"] = bool(exp and exp > now) or hub.is_bumped(
                "sentence_audio", key
            )
            out.append(row)
        return out

    def poll_once(self) -> None:
        """Heartbeat callback — LIGHT: spawn the fetch on a daemon thread and
        return immediately; skip when the previous poll is still running. The
        heartbeat thread never blocks on network I/O (mirrors the worker's
        supervise pattern)."""
        with self._lock:
            if self._poll_running:
                return
            self._poll_running = True
        try:
            threading.Thread(
                target=self._poll_worker,
                daemon=True,
                name="sentence-queue-monitor-poll",
            ).start()
        except Exception as exc:  # noqa: BLE001 — never raise into heartbeat
            with self._lock:
                self._poll_running = False
            ColorPrint.red(f"[SentenceQueueMonitor] poll_once error: {exc}")

    def _poll_worker(self) -> None:
        """Background poll: fetch missing rows, detect bumps, cache snapshot."""
        try:
            body = self._fetch_missing()
            if body is None:
                with self._lock:
                    self._laravel_reachable = False
                return
            items = list(body.get("items") or [])
            total = int(body.get("total") or len(items))
            summary = body.get("summary") if isinstance(body.get("summary"), dict) else None
            shape = (total, len(items))
            if shape != self._last_logged_shape:
                # Log only on CHANGE (every poll is 5s — a per-poll line would
                # flood the terminal). This is the answer to "the 200s return
                # nothing?": total/items counts from the response body itself.
                detail = f" summary={summary}" if summary else ""
                ColorPrint.cyan(
                    f"[SentenceQueueMonitor] missing: total={total} "
                    f"items={len(items)} (page 1, per_page {_POLL_LIMIT}){detail}"
                )
                self._last_logged_shape = shape
            with self._lock:
                self._apply_bump_detection(items)
                self._snapshot = {
                    "items": self._decorate_items(items),
                    "total": total,
                    "summary": summary,
                    "reachable": True,
                }
                self._snapshot_ts = time.monotonic()
                if not self._laravel_reachable and self._unreachable_warned:
                    ColorPrint.green(
                        f"[SentenceQueueMonitor] Reconnected to Laravel at {self._base_url()}"
                    )
                self._laravel_reachable = True
                self._unreachable_warned = False
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[SentenceQueueMonitor] poll_once error: {exc}")
        finally:
            with self._lock:
                self._poll_running = False

    def get_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            snap = dict(self._snapshot)
            snap["snapshot_age_s"] = round(max(0.0, time.monotonic() - self._snapshot_ts), 1)
            snap["laravel_reachable"] = self._laravel_reachable
            return snap


def get_sentence_queue_monitor_service(
    bump_ttl_seconds: int = 30,
) -> SentenceQueueMonitorService:
    """Get the SentenceQueueMonitorService singleton (idempotent)."""
    return SentenceQueueMonitorService(bump_ttl_seconds=max(1, int(bump_ttl_seconds)))
