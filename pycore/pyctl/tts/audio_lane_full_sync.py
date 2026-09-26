# -*- coding: utf-8 -*-
"""Shared full pull of one audio lane's Laravel backlog into its local Queue.

Binding: docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.4.
Each audio lane (word_audio, sentence_audio) owns its own Queue = Part1 +
Part2. While the lane switch is ON, pycore mirrors the lane's whole Laravel
backlog (items still lacking audio) into Part2 of that Queue through
``audio_queue_center.accept_backlog`` (whole-Queue dedup), so the lane keeps
generating while Laravel is offline; delivery is the lane's domain report +
durable outbox. It NEVER mutates Laravel's queue.

Lane specifics (listing endpoint, language source, row -> task) live in the
subclasses ``word_audio_full_sync`` / ``sentence_audio_full_sync``; the
paging, status, error codes, and state push are shared here.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue, start_bus_task
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyutils.laravel.client import laravel_client, laravel_failure
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_center import audio_queue_center


class AudioLaneFullSync:
    """Idempotent full backlog pull for one audio lane (Part2 mirror)."""

    LANE = ""
    CAPABILITY = ""
    DISABLED_CODE = "AUDIO_LANE_DISABLED"
    LOG_PREFIX = "[AudioLaneFullSync]"
    PAGE_LIMIT = 1000
    REQUEST_TIMEOUT_SECONDS = 30

    def __init__(self) -> None:
        self._running = SerializedValue(False, f"{type(self).__name__}RunningState")
        self._status = SerializedValue({
            "last_sync_at": 0,
            "last_result": {},
            "languages": [],
            "cache_source": "",
        }, f"{type(self).__name__}StatusState")

    # -------------------- lane adapter (subclasses) --------------------

    def _fetch_languages(self, base_url: str) -> List[Dict[str, Any]]:
        """``[{language, language_code, without_audio?}]`` to pull, in order."""
        raise NotImplementedError

    def _page_request(self, language: Dict[str, Any], cursor: int) -> Tuple[str, Dict[str, Any]]:
        """(listing path, query params) of one keyset page after ``cursor``."""
        raise NotImplementedError

    def _row_task(self, base_url: str, language_code: str, row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """One listing row -> local lane task (None skips the row)."""
        raise NotImplementedError

    # -------------------- status --------------------

    def enabled(self) -> bool:
        return assist_capability_enabled(self.CAPABILITY)

    def _update_status(self, **fields: Any) -> None:
        current = dict(self._status.get() or {})
        current.update(fields)
        self._status.set(current)

    def get_status(self) -> Dict[str, Any]:
        cache_path = audio_queue_cache.snapshot_path(self.LANE)
        cache_saved_at = int(cache_path.stat().st_mtime) if cache_path.is_file() else 0
        queue_count = audio_queue_center.queued_count(self.LANE)
        status = dict(self._status.get() or {})
        return {
            "lane": self.LANE,
            "running": bool(self._running.get()),
            "last_sync_at": int(status.get("last_sync_at") or 0),
            "last_result": dict(status.get("last_result") or {}),
            "languages": [dict(row) for row in (status.get("languages") or [])],
            "cache_saved_at": cache_saved_at,
            "cache_source": str(status.get("cache_source") or ""),
            "cache_count": queue_count,
            "queue_count": queue_count,
        }

    def record_cache_restore(self, result: Dict[str, Any]) -> None:
        """Keep cache provenance aligned with the last restored snapshot."""
        source = str(result.get("source") or "").strip()
        if source:
            self._update_status(cache_source=source)

    # -------------------- full pull --------------------

    def run_full_sync(self, base_url: str = "") -> Dict[str, Any]:
        """Run one full pull NOW (idempotent; a run in flight is reported,
        never stacked). Laravel unreachable -> the pull stops with a stable
        error code; the cache-restored queue keeps the lane alive offline."""
        if not self.enabled():
            return {"success": False, "running": False, "error": self.DISABLED_CODE, "status": self.get_status()}
        if not self._running.compare_and_set(False, True):
            return {"success": True, "running": True, "status": self.get_status()}
        audio_queue_center.note_state_change(self.LANE, "full_sync_started")
        try:
            result = self._pull_all(base_url or laravel_endpoint_manager.get_active_base_url())
        except Exception as exc:  # noqa: BLE001 - startup/RPC entry never raises
            ColorPrint.yellow(f"{self.LOG_PREFIX} full pull failed: {exc}")
            result = {"success": False, **laravel_failure(exc)}
        finally:
            self._running.set(False)
        self._update_status(last_result=dict(result), last_sync_at=int(time.time()))
        audio_queue_center.note_state_change(self.LANE, "full_sync_finished")
        if self.enabled():
            audio_queue_center.request_pull(self.LANE)
        result["status"] = self.get_status()
        return result

    def start_background(self, base_url: str = "") -> Dict[str, Any]:
        """Kick the full pull on a background bus task (non-blocking)."""
        if not self.enabled():
            return {"success": False, "error": self.DISABLED_CODE}
        if self._running.get():
            return {"success": True, "running": True}
        start_bus_task(self.run_full_sync, base_url, thread_name=f"{type(self).__name__}Thread")
        return {"success": True, "running": True}

    def _pull_all(self, base_url: str) -> Dict[str, Any]:
        per_language: List[Dict[str, Any]] = []
        total_pulled = 0
        total_inserted = 0
        failure: Dict[str, Any] = {}
        for language in self._fetch_languages(base_url):
            if not self.enabled():
                break
            code = str(language.get("language_code") or language.get("language") or "").strip()
            if not code:
                continue
            pulled, inserted, failure = self._pull_language(base_url, language, code)
            total_pulled += pulled
            total_inserted += inserted
            per_language.append({
                "language": str(language.get("language") or code),
                "language_code": code,
                "without_audio": int(language.get("without_audio") or 0),
                "pulled": pulled,
                "inserted": inserted,
            })
            self._update_status(
                languages=[dict(row) for row in per_language],
                last_result={"success": True, "pulled": total_pulled, "inserted": total_inserted,
                             "languages": len(per_language)},
            )
            if failure:
                break
        stopped = not self.enabled()
        ColorPrint.green(
            f"{self.LOG_PREFIX} full pull done: pulled={total_pulled} "
            f"inserted={total_inserted} languages={len(per_language)}"
        )
        return {
            "success": not stopped and not failure,
            "pulled": total_pulled,
            "inserted": total_inserted,
            "languages": len(per_language),
            "stopped": stopped,
            "source": audio_queue_cache.SOURCE_FULL_SYNC,
            **failure,
        }

    def _pull_language(
        self,
        base_url: str,
        language: Dict[str, Any],
        code: str,
    ) -> Tuple[int, int, Dict[str, Any]]:
        """Page one language's backlog listing into the lane's Part2."""
        pulled = 0
        inserted = 0
        cursor = 0
        while self.enabled():
            path, params = self._page_request(language, cursor)
            response = laravel_client.get(
                path, base_url=base_url, params=params, timeout=self.REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                ColorPrint.yellow(f"{self.LOG_PREFIX} {code} listing HTTP {response.status_code}; stopped")
                return pulled, inserted, laravel_failure(status_code=response.status_code)
            payload = response.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            items = data.get("items") if isinstance(data, dict) else None
            if not isinstance(items, list) or not items:
                break
            tasks = [
                task
                for task in (self._row_task(base_url, code, dict(row)) for row in items if isinstance(row, dict))
                if task is not None
            ]
            if tasks and self.enabled():
                inserted += int(audio_queue_center.accept_backlog(
                    self.LANE, tasks, source=audio_queue_cache.SOURCE_FULL_SYNC,
                ).get("inserted") or 0)
            pulled += len(items)
            next_cursor = int(data.get("next_cursor") or 0)
            if next_cursor <= cursor or len(items) < int(params.get("limit") or self.PAGE_LIMIT):
                break
            cursor = next_cursor
        return pulled, inserted, {}


__all__ = ["AudioLaneFullSync"]
