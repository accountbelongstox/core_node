# -*- coding: utf-8 -*-
"""Word-audio startup full sync: pull EVERY dictionary word without audio
from Laravel into the shared queue (Part1 fill, pycore self-driven).

Binding requirements: docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md.

Direction is pycore-local ONLY: the pull reads Laravel's dictionary listing
(GET /api/app_qy_v1/dictionary/words?filter=without_audio) and fills Part1
through the shared queue library (``audio_queue_center.promote_local_head``,
whole-Queue dedup). It NEVER mutates Laravel's queue — no enqueue, no head
ticket. Delivery of the generated audio is the existing domain report +
durable outbox path, so work produced while Laravel is offline uploads when
Laravel returns.

Startup chain (event_handlers): cache restore -> full pull (background) ->
drain. Runs only while the persisted Word Audio flag (assist capability
``tts``) is ON; the persisted ``word_tts_auto.full_sync_on_start`` key
(default true) — the SAME settings file the UI writes — decides whether the
pull runs at boot. There is NO CLI/env parameter: the persisted flag is the
single switch.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue, start_bus_task
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyutils.common.queue_center_contract import task_language_priority
from pycore.pyutils.common.user_data_store import USER_DATA_SECTION_WORD_TTS_AUTO, user_data_store
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_center import audio_queue_center

QUEUE_KEY = "word_audio"
# Persisted startup preference (user_data_store section word_tts_auto).
FULL_SYNC_ON_START_KEY = "full_sync_on_start"
# Laravel listing endpoints (read-only dictionary scan).
_WORDS_PATH = "/api/app_qy_v1/dictionary/words"
_LANGUAGE_BREAKDOWN_PATH = "/api/app_qy_v1/vocabulary/language-breakdown"
_PAGE_LIMIT = 1000
_REQUEST_TIMEOUT_SECONDS = 30
# Locally sourced task marker: no global_task row exists to claim; delivery
# goes through the domain report + outbox (worker_base/execution guards).
LOCAL_SOURCE_MARKER = "full_sync"
_LOCAL_TASK_ID_PREFIX = "word-full-"


def full_sync_on_start() -> bool:
    """Startup full-pull decision: the persisted key is the ONLY switch.

    Read DIRECTLY from the settings file (never from the UI process); default
    True so a Running Word Audio flag implies the full pull at boot.
    """
    section = user_data_store.get_section(USER_DATA_SECTION_WORD_TTS_AUTO) or {}
    value = section.get(FULL_SYNC_ON_START_KEY)
    return True if value is None else bool(value)


def set_full_sync_on_start(enabled: bool) -> None:
    """Persist the startup full-pull preference (read directly at boot)."""
    user_data_store.update_section(
        USER_DATA_SECTION_WORD_TTS_AUTO,
        {FULL_SYNC_ON_START_KEY: bool(enabled)},
    )


class WordAudioFullSync:
    """Idempotent full without-audio pull for the word_audio lane."""

    def __init__(self) -> None:
        self._running = SerializedValue(False, "WordAudioFullSyncRunningState")
        self._last_sync_at: int = 0
        self._last_result: Dict[str, Any] = {}
        self._languages: List[Dict[str, Any]] = []

    # -------------------- status --------------------

    def get_status(self) -> Dict[str, Any]:
        cache_path = audio_queue_cache.snapshot_path(QUEUE_KEY)
        cache_saved_at = int(cache_path.stat().st_mtime) if cache_path.is_file() else 0
        queue_count = audio_queue_center.queued_count(QUEUE_KEY)
        return {
            "running": bool(self._running.get()),
            "on_start": full_sync_on_start(),
            "last_sync_at": self._last_sync_at,
            "last_result": dict(self._last_result),
            "languages": [dict(row) for row in self._languages],
            "cache_saved_at": cache_saved_at,
            "cache_source": str(self._last_result.get("source") or ""),
            "cache_count": queue_count,
            "queue_count": queue_count,
        }

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
        try:
            result = self._pull_all(base_url or laravel_endpoint_manager.get_active_base_url())
        except Exception as exc:  # noqa: BLE001 - startup/RPC entry never raises
            ColorPrint.yellow(f"[WordAudioFullSync] full pull failed: {exc}")
            result = {"success": False, "error": str(exc)}
        finally:
            self._running.set(False)
        self._last_result = dict(result)
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
        }
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
        """One listing page -> M3 Part1 fill (whole-Queue dedup inside)."""
        items: List[Dict[str, Any]] = []
        for row in rows:
            word = str(row.get("content") or "").strip()
            md5 = str(row.get("md5") or "").strip()
            row_id = row.get("id")
            if not word or not md5 or row_id in (None, ""):
                continue
            task = {
                "task_id": f"{_LOCAL_TASK_ID_PREFIX}{language_code}-{md5}",
                "task_type": QUEUE_KEY,
                "payload": {
                    "word": word,
                    "content": word,
                    "language": language_code,
                    "md5": md5,
                    "dict_row_id": int(row_id),
                },
                # LOCAL marker: never claimed against Laravel's global_tasks;
                # delivery is the domain report (encodeTaskId) + outbox.
                "_local_source": LOCAL_SOURCE_MARKER,
                "_laravel_base_url": base_url,
            }
            items.append({
                "language": language_code,
                "text": word,
                "md5": md5,
                "task": task,
            })
        if not items:
            return {"success": True, "inserted": 0}
        result = audio_queue_center.promote_local_head(QUEUE_KEY, items)
        # Whole-Queue snapshot persisted (source=full_sync): head/dedup are
        # already resolved by the library, so the cache is restart-ready.
        audio_queue_center.persist_snapshot(
            QUEUE_KEY, source=audio_queue_cache.SOURCE_FULL_SYNC
        )
        return result


word_audio_full_sync = WordAudioFullSync()


def activate_word_audio_queue() -> Dict[str, Any]:
    """Apply the complete persisted ON transition immediately.

    Every UI control path uses this same entry: restore the durable queue,
    start the configured full pull, then wake the batch drain. Repeated calls
    are safe because restore and full pull both use whole-Queue dedup.
    """
    if not assist_capability_enabled("tts"):
        return {"success": False, "error": "WORD_AUDIO_DISABLED"}
    restored = audio_queue_center.restore_from_cache(QUEUE_KEY)
    if full_sync_on_start():
        word_audio_full_sync.start_background()
    audio_queue_center.request_pull(QUEUE_KEY)
    return {"success": True, "restored": restored}


__all__ = [
    "FULL_SYNC_ON_START_KEY",
    "LOCAL_SOURCE_MARKER",
    "QUEUE_KEY",
    "activate_word_audio_queue",
    "WordAudioFullSync",
    "full_sync_on_start",
    "set_full_sync_on_start",
    "word_audio_full_sync",
]
