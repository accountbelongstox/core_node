# -*- coding: utf-8 -*-
"""
Sentence-audio queue monitor — Laravel missing-sentence list + priority-bump detection.

Mirrors queue_monitor_service (translation) for the sentence-library lane so the
Queue Center can show live rows, bump highlights, and generation activity while
book-reader bumps tts_priority.

Threading (PYTHON_PYCORE.md §4): polls and mutable state use THREAD_BUS-backed
workers, and every fresh snapshot is published to THREAD_BUS.
"""

import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import resolve_laravel_base_url
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub

_MISSING_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/missing"
_HTTP_TIMEOUT = 60
_POLL_LIMIT = 100

# THREAD_BUS signal carrying the latest snapshot for the queue router (rule §4:
# inter-thread data flows over the bus, not shared attributes).
_BUS_SNAPSHOT = "sentence_queue_monitor.snapshot"


class SentenceQueueMonitorService:
    """Monitor missing sentence audio rows and detect tts_priority bumps."""

    def __init__(self, bump_ttl_seconds: int = 30) -> None:
        if getattr(self, "_initialized", False):
            return
        self._bump_ttl = float(bump_ttl_seconds)
        self._prev_priority: Dict[str, int] = {}
        self._bumped_until: Dict[str, float] = {}
        self._snapshot: Dict[str, Any] = {"items": [], "total": 0, "reachable": False}
        self._snapshot_ts = 0.0
        self._laravel_reachable = False
        self._unreachable_warned = False
        self._last_logged_shape: Optional[Tuple[int, int]] = None
        self._poll_running_signal = f"sentence_queue_monitor.poll_running.{id(self)}"
        THREAD_BUS.signal(self._poll_running_signal, False)
        self._initialized = True
        init_serialized_owner(
            self,
            "sentence_queue_monitor.state",
            "SentenceQueueMonitorState",
            timeout=90.0,
        )

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
        """Heartbeat callback — LIGHT: hand the fetch to a THREAD_BUS task
        and return immediately; skip when the previous poll is still running. The
        heartbeat thread never blocks on network I/O (mirrors the worker's
        supervise pattern). Rule §4: lifecycle state travels through THREAD_BUS."""
        if THREAD_BUS.get_signal(self._poll_running_signal, False):
            return
        THREAD_BUS.signal(self._poll_running_signal, True)
        try:
            start_bus_task(self._poll_worker, thread_name="sentence-queue-monitor-poll")
        except Exception as exc:  # noqa: BLE001 — never raise into heartbeat
            THREAD_BUS.signal(self._poll_running_signal, False)
            ColorPrint.red(f"[SentenceQueueMonitor] poll_once error: {exc}")

    def _poll_worker(self) -> None:
        """Background poll: fetch missing rows, detect bumps, cache + publish
        the snapshot and publish it for FastAPI readers. Runs on the bus task
        thread started by poll_once — deliberately NOT a @serialized_method:
        the HTTP fetch can hold for seconds against a dead endpoint, and on
        the serialized state-owner thread that blocked every get_snapshot
        caller (task-center RPC) behind it. Single-flight via
        _poll_running_signal; the state it writes is plain scalars/dicts."""
        try:
            body = self._fetch_missing()
            if body is None:
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
            THREAD_BUS.signal(_BUS_SNAPSHOT, dict(self._snapshot))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[SentenceQueueMonitor] poll_once error: {exc}")
        finally:
            THREAD_BUS.signal(self._poll_running_signal, False)

    @serialized_method
    def get_snapshot(self) -> Dict[str, Any]:
        snap = dict(self._snapshot)
        snap["snapshot_age_s"] = round(max(0.0, time.monotonic() - self._snapshot_ts), 1)
        snap["laravel_reachable"] = self._laravel_reachable
        return snap


def get_sentence_queue_monitor_service(
    bump_ttl_seconds: int = 30,
) -> SentenceQueueMonitorService:
    """Get the SentenceQueueMonitorService singleton (idempotent)."""
    return _sentence_queue_monitor_provider.get(max(1, int(bump_ttl_seconds)))


class _SentenceQueueMonitorProvider:
    """Create and retain the service on one THREAD_BUS state owner."""

    def __init__(self) -> None:
        self._service: Optional[SentenceQueueMonitorService] = None
        init_serialized_owner(
            self,
            "sentence_queue_monitor.provider",
            "SentenceQueueMonitorProvider",
        )

    @serialized_method
    def get(self, bump_ttl_seconds: int) -> SentenceQueueMonitorService:
        if self._service is None:
            self._service = SentenceQueueMonitorService(bump_ttl_seconds)
        return self._service


_sentence_queue_monitor_provider = _SentenceQueueMonitorProvider()
