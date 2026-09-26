# -*- coding: utf-8 -*-
"""Word-audio full pull: mirror EVERY dictionary word without audio from
Laravel into the shared queue (Part2 mirror of the dict-lane backlog).

Binding requirements: docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md,
corrected by docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.2.

The pull reads Laravel's dictionary listing
(GET /api/app_qy_v1/dictionary/words?filter=without_audio) — the live view of
Laravel's word_audio dict lane — and mirrors it into Part2 through
``audio_queue_center.accept_backlog`` (whole-Queue dedup). Part1 stays the
pycore-local priority lane (orchestration / manual promote). It NEVER mutates
Laravel's queue. Delivery is the domain report + durable outbox path, so work
produced while Laravel is offline uploads when Laravel returns.

Activation (``audio_lane_activation``): cache restore -> full pull
(background) -> drain, only while the persisted Word Audio flag (assist
capability ``tts``) is ON.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue, start_bus_task
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyutils.common.queue_center_contract import task_language_priority
from pycore.pyutils.laravel.client import laravel_client, laravel_failure
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_center import (
    LOCAL_SOURCE_FULL_SYNC,
    audio_queue_center,
    build_local_task,
)

QUEUE_KEY = "word_audio"
# Laravel listing endpoints (read-only dictionary scan).
_WORDS_PATH = "/api/app_qy_v1/dictionary/words"
_LANGUAGE_BREAKDOWN_PATH = "/api/app_qy_v1/vocabulary/language-breakdown"
_PAGE_LIMIT = 1000
_REQUEST_TIMEOUT_SECONDS = 30
# Locally sourced task marker: no global_task row exists to claim; delivery
# goes through the domain report + outbox (worker_base/execution guards).
LOCAL_SOURCE_MARKER = LOCAL_SOURCE_FULL_SYNC


class WordAudioFullSync:
    """Idempotent full without-audio pull for the word_audio lane."""

    def __init__(self) -> None:
        self._running = SerializedValue(False, "WordAudioFullSyncRunningState")
        self._last_sync_at: int = 0
        self._last_result: Dict[str, Any] = {}
        self._languages: List[Dict[str, Any]] = []
        self._cache_source: str = ""

    # -------------------- status --------------------

    def get_status(self) -> Dict[str, Any]:
        cache_path = audio_queue_cache.snapshot_path(QUEUE_KEY)
        cache_saved_at = int(cache_path.stat().st_mtime) if cache_path.is_file() else 0
        queue_count = audio_queue_center.queued_count(QUEUE_KEY)
        return {
            "running": bool(self._running.get()),
            "last_sync_at": self._last_sync_at,
            "last_result": dict(self._last_result),
            "languages": [dict(row) for row in self._languages],
            "cache_saved_at": cache_saved_at,
            "cache_source": self._cache_source,
            "cache_count": queue_count,
            "queue_count": queue_count,
        }

    def record_cache_restore(self, result: Dict[str, Any]) -> None:
        """Keep cache provenance aligned with the last restored snapshot."""
        source = str(result.get("source") or "").strip()
        if source:
            self._cache_source = source

    # -------------------- full pull --------------------

    def run_full_sync(self, base_url: str = "") -> Dict[str, Any]:
        """Run one full pull NOW (idempotent; safe to call repeatedly).

        Triggered by startup (background bus task) and by the Queue Center
        RPC. A run already in flight is reported, never stacked. Laravel
        unreachable -> the pull aborts quietly; the cache-restored queue
        keeps the lane alive offline.
        """
        if not assist_capability_enabled("tts"):
            return {
                "success": False,
                "running": False,
                "error": "WORD_AUDIO_DISABLED",
                "status": self.get_status(),
            }
        if self._running.get():
            return {"success": True, "running": True, "status": self.get_status()}
        if not self._running.compare_and_set(False, True):
            return {"success": True, "running": True, "status": self.get_status()}
        audio_queue_center.note_state_change(QUEUE_KEY, "full_sync_started")
        try:
            result = self._pull_all(base_url or laravel_endpoint_manager.get_active_base_url())
        except Exception as exc:  # noqa: BLE001 - startup/RPC entry never raises
            ColorPrint.yellow(f"[WordAudioFullSync] full pull failed: {exc}")
            result = {"success": False, **laravel_failure(exc)}
        finally:
            self._running.set(False)
        self._last_result = dict(result)
        audio_queue_center.note_state_change(QUEUE_KEY, "full_sync_finished")
        if assist_capability_enabled("tts"):
            audio_queue_center.request_pull(QUEUE_KEY)
        result["status"] = self.get_status()
        return result

    def start_background(self, base_url: str = "") -> Dict[str, Any]:
        """Kick the full pull on a background bus task (non-blocking boot)."""
        if not assist_capability_enabled("tts"):
            return {"success": False, "error": "WORD_AUDIO_DISABLED"}
        if self._running.get():
            return {"success": True, "running": True}
        try:
            start_bus_task(
                self.run_full_sync,
                base_url,
                thread_name="WordAudioFullSync",
            )
            return {"success": True, "running": True}
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordAudioFullSync] background start failed: {exc}")
            return {"success": False, "error": str(exc)}

    # -------------------- internals --------------------

    def _pull_all(self, base_url: str) -> Dict[str, Any]:
        languages = self._fetch_languages(base_url)
        total_pulled = 0
        total_inserted = 0
        per_language: List[Dict[str, Any]] = []
        for language in languages:
            if not assist_capability_enabled("tts"):
                break
            name = str(language.get("language") or "").strip()
            if not name:
                continue
            pulled, inserted = self._pull_language(base_url, name, language)
            total_pulled += pulled
            total_inserted += inserted
            per_language.append({
                "language": name,
                "language_code": str(language.get("language_code") or ""),
                "without_audio": int(language.get("without_audio") or 0),
                "pulled": pulled,
                "inserted": inserted,
            })
            self._languages = [dict(row) for row in per_language]
            self._last_result = {
                "success": True,
                "pulled": total_pulled,
                "inserted": total_inserted,
                "languages": len(per_language),
            }
        self._languages = per_language
        self._last_sync_at = int(time.time())
        stopped = not assist_capability_enabled("tts")
        self._last_result = {
            "success": not stopped,
            "pulled": total_pulled,
            "inserted": total_inserted,
            "languages": len(per_language),
            "stopped": stopped,
            "source": audio_queue_cache.SOURCE_FULL_SYNC,
        }
        self._cache_source = audio_queue_cache.SOURCE_FULL_SYNC
        ColorPrint.green(
            f"[WordAudioFullSync] full pull done: pulled={total_pulled} "
            f"inserted={total_inserted} languages={len(per_language)}"
        )
        return dict(self._last_result)

    def _fetch_languages(self, base_url: str) -> List[Dict[str, Any]]:
        """Language set for the pull: Laravel breakdown -> contract fallback."""
        try:
            response = laravel_client.get(
                _LANGUAGE_BREAKDOWN_PATH,
                base_url=base_url,
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code == 200:
                payload = response.json()
                data = payload.get("data") if isinstance(payload, dict) else None
                rows = data.get("languages") if isinstance(data, dict) else None
                if isinstance(rows, list) and rows:
                    return [dict(row) for row in rows if isinstance(row, dict)]
        except Exception as exc:  # noqa: BLE001 - fallback below
            ColorPrint.yellow(
                f"[WordAudioFullSync] language breakdown unavailable ({exc}); "
                "using contract language list"
            )
        # Contract fallback: language_priority codes mapped to dictionary
        # language names (the listing endpoint resolves names -> codes).
        fallback: List[Dict[str, Any]] = []
        for code in task_language_priority(QUEUE_KEY):
            fallback.append({"language": str(code), "language_code": str(code)})
        if not fallback:
            fallback.append({"language": "english", "language_code": "en"})
        return fallback

    def _pull_language(
        self,
        base_url: str,
        language_name: str,
        language: Dict[str, Any],
    ) -> tuple[int, int]:
        """Page one language's without-audio listing into the queue (Part1)."""
        language_code = str(language.get("language_code") or language_name).strip()
        pulled = 0
        inserted = 0
        cursor_id = 0
        while assist_capability_enabled("tts"):
            response = laravel_client.get(
                _WORDS_PATH,
                base_url=base_url,
                params={
                    "language": language_name,
                    "filter": "without_audio",
                    "cursor_id": cursor_id,
                    "limit": _PAGE_LIMIT,
                },
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                ColorPrint.yellow(
                    f"[WordAudioFullSync] {language_name} listing HTTP "
                    f"{response.status_code}; skipped"
                )
                self._last_result = {"success": False, **laravel_failure(status_code=response.status_code)}
                break
            payload = response.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            items = data.get("items") if isinstance(data, dict) else None
            if not isinstance(items, list) or not items:
                break
            items = [dict(row) for row in items if isinstance(row, dict)]
            if not assist_capability_enabled("tts"):
                break
            result = self._fill_queue(base_url, language_code, items)
            pulled += len(items)
            inserted += int(result.get("inserted") or 0)
            next_cursor = int(data.get("next_cursor") or 0) if isinstance(data, dict) else 0
            if next_cursor <= cursor_id:
                break
            cursor_id = next_cursor
            if len(items) < _PAGE_LIMIT:
                break
        return pulled, inserted

    def _fill_queue(
        self,
        base_url: str,
        language_code: str,
        rows: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """One listing page -> M2 Part2 backlog mirror (whole-Queue dedup inside)."""
        tasks: List[Dict[str, Any]] = []
        for row in rows:
            word = str(row.get("content") or "").strip()
            md5 = str(row.get("md5") or "").strip()
            row_id = row.get("id")
            if not word or not md5 or row_id in (None, ""):
                continue
            # LOCAL marker: never claimed against Laravel's global_tasks;
            # delivery is the domain report (encodeTaskId) + outbox.
            task = build_local_task(
                QUEUE_KEY,
                language_code,
                word,
                LOCAL_SOURCE_MARKER,
                base_url=base_url,
                extra_payload={"md5": md5, "dict_row_id": int(row_id)},
            )
            if task is not None:
                tasks.append(task)
        if not tasks:
            return {"success": True, "inserted": 0}
        return audio_queue_center.accept_backlog(
            QUEUE_KEY,
            tasks,
            source=audio_queue_cache.SOURCE_FULL_SYNC,
        )


word_audio_full_sync = WordAudioFullSync()


__all__ = [
    "LOCAL_SOURCE_MARKER",
    "QUEUE_KEY",
    "WordAudioFullSync",
    "word_audio_full_sync",
]
