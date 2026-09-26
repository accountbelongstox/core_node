# -*- coding: utf-8 -*-
"""Word-audio full pull: mirror EVERY dictionary word without audio from
Laravel into the word_audio Queue (Part2 mirror of the dict-lane backlog).

Binding requirements: docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md,
corrected by docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.2.

The pull reads Laravel's dictionary listing
(GET /api/app_qy_v1/dictionary/words?filter=without_audio) — the live view of
Laravel's word_audio dict lane — through the shared ``AudioLaneFullSync``
machinery. Part1 stays the pycore-local priority lane (orchestration /
manual promote). It NEVER mutates Laravel's queue. Delivery is the domain
report (encodeTaskId via ``dict_row_id``) + durable outbox.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.tts.audio_lane_full_sync import AudioLaneFullSync
from pycore.pyutils.common.queue_center_contract import task_language_priority
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.tts.audio_queue_center import LOCAL_SOURCE_FULL_SYNC, build_local_task

QUEUE_KEY = "word_audio"
# Laravel listing endpoints (read-only dictionary scan).
_WORDS_PATH = "/api/app_qy_v1/dictionary/words"
_LANGUAGE_BREAKDOWN_PATH = "/api/app_qy_v1/vocabulary/language-breakdown"
# Locally sourced task marker: no global_task row exists to claim; delivery
# goes through the domain report + outbox (worker_base/execution guards).
LOCAL_SOURCE_MARKER = LOCAL_SOURCE_FULL_SYNC


class WordAudioFullSync(AudioLaneFullSync):
    """Idempotent full without-audio pull for the word_audio lane."""

    LANE = QUEUE_KEY
    CAPABILITY = "tts"
    DISABLED_CODE = "WORD_AUDIO_DISABLED"
    LOG_PREFIX = "[WordAudioFullSync]"

    def _fetch_languages(self, base_url: str) -> List[Dict[str, Any]]:
        """Language set: Laravel breakdown -> contract fallback -> english."""
        try:
            response = laravel_client.get(
                _LANGUAGE_BREAKDOWN_PATH,
                base_url=base_url,
                timeout=self.REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code == 200:
                payload = response.json()
                data = payload.get("data") if isinstance(payload, dict) else None
                rows = data.get("languages") if isinstance(data, dict) else None
                if isinstance(rows, list) and rows:
                    return [dict(row) for row in rows if isinstance(row, dict)]
        except Exception as exc:  # noqa: BLE001 - fallback below
            ColorPrint.yellow(
                f"{self.LOG_PREFIX} language breakdown unavailable ({exc}); "
                "using contract language list"
            )
        fallback = [
            {"language": str(code), "language_code": str(code)}
            for code in task_language_priority(QUEUE_KEY)
        ]
        return fallback or [{"language": "english", "language_code": "en"}]

    def _page_request(self, language: Dict[str, Any], cursor: int) -> Tuple[str, Dict[str, Any]]:
        # The listing resolves dictionary language NAMES (breakdown rows).
        name = str(language.get("language") or language.get("language_code") or "")
        return _WORDS_PATH, {
            "language": name,
            "filter": "without_audio",
            "cursor_id": cursor,
            "limit": self.PAGE_LIMIT,
        }

    def _row_task(self, base_url: str, language_code: str, row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        word = str(row.get("content") or "").strip()
        md5 = str(row.get("md5") or "").strip()
        row_id = row.get("id")
        if not word or not md5 or row_id in (None, ""):
            return None
        return build_local_task(
            QUEUE_KEY,
            language_code,
            word,
            LOCAL_SOURCE_MARKER,
            base_url=base_url,
            extra_payload={"md5": md5, "dict_row_id": int(row_id)},
        )


word_audio_full_sync = WordAudioFullSync()


__all__ = [
    "LOCAL_SOURCE_MARKER",
    "QUEUE_KEY",
    "WordAudioFullSync",
    "word_audio_full_sync",
]
