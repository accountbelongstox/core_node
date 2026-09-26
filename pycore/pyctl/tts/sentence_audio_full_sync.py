# -*- coding: utf-8 -*-
"""Sentence-audio full pull: mirror EVERY library sentence without audio from
Laravel into the sentence_audio Queue (Part2 mirror of the sentence backlog).

Binding: docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.4.
The sentence lane is the sentence counterpart of the word lane: its own
Queue = Part1 (orchestration misses / manual promotes) + Part2 (Laravel's
live sentence_audio tasks mirrored by the lane worker's FULL_SYNC diff, plus
this backlog pull). Since the capacity-bounded sentence scan producer was
retired (DESIGN_20260922_DICT_LANE_LIVE_QUEUE §4.3), this pull is what feeds
the ~all-library sentence backlog to pycore.

Listing: GET /api/app_qy_v1/ai_tools/tts/sentence/without_audio
(keyset by id; no language -> per-language backlog sizes). Delivery: the
sentence lane reports by ``content_id`` (domain report) + durable outbox; the
Laravel content_id is carried as-is so the report addresses the exact row.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyctl.tts.audio_lane_full_sync import AudioLaneFullSync
from pycore.pyutils.common.queue_center_contract import (
    task_language_priority,
    task_payload_text_max_chars,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.tts.audio_queue_center import LOCAL_SOURCE_FULL_SYNC, build_local_task

QUEUE_KEY = "sentence_audio"
_WITHOUT_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/without_audio"


class SentenceAudioFullSync(AudioLaneFullSync):
    """Idempotent full without-audio pull for the sentence_audio lane."""

    LANE = QUEUE_KEY
    CAPABILITY = "sentence_audio"
    DISABLED_CODE = "AUDIO_LANE_DISABLED"
    LOG_PREFIX = "[SentenceAudioFullSync]"

    def _fetch_languages(self, base_url: str) -> List[Dict[str, Any]]:
        """Laravel per-language backlog sizes, contract language tiers first."""
        response = laravel_client.get(
            _WITHOUT_AUDIO_PATH, base_url=base_url, timeout=self.REQUEST_TIMEOUT_SECONDS,
        )
        rows: List[Dict[str, Any]] = []
        if response.status_code == 200:
            payload = response.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            listed = data.get("languages") if isinstance(data, dict) else None
            rows = [
                {
                    "language": str(row.get("language") or ""),
                    "language_code": str(row.get("language") or ""),
                    "without_audio": int(row.get("without_audio") or 0),
                }
                for row in (listed if isinstance(listed, list) else [])
                if isinstance(row, dict) and row.get("language")
            ]
        priority = [str(code) for code in task_language_priority(QUEUE_KEY)]
        rows.sort(key=lambda row: priority.index(row["language_code"]) if row["language_code"] in priority else len(priority))
        return rows

    def _page_request(self, language: Dict[str, Any], cursor: int) -> Tuple[str, Dict[str, Any]]:
        return _WITHOUT_AUDIO_PATH, {
            "language": str(language.get("language_code") or ""),
            "cursor_id": cursor,
            "limit": self.PAGE_LIMIT,
        }

    def _row_task(self, base_url: str, language_code: str, row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        text = str(row.get("text") or "").strip()
        content_id = str(row.get("content_id") or "").strip()
        limit = task_payload_text_max_chars(QUEUE_KEY)
        if not text or not content_id or (limit > 0 and len(text) > limit):
            return None
        return build_local_task(
            QUEUE_KEY,
            language_code,
            text,
            LOCAL_SOURCE_FULL_SYNC,
            base_url=base_url,
            extra_payload={"content_id": content_id},
        )


sentence_audio_full_sync = SentenceAudioFullSync()


__all__ = [
    "QUEUE_KEY",
    "SentenceAudioFullSync",
    "sentence_audio_full_sync",
]
