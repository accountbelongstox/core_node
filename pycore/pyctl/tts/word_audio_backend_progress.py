# -*- coding: utf-8 -*-
"""Central backend-wide TTS progress snapshot for the WordAudio worker."""

import time
from typing import Any, Dict

from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_WORD_AUDIO_PROGRESS_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.laravel.client import laravel_client


_STATS_PATH = "/api/app_qy_v1/ai_tools/tts/queue/stats"
_STATS_TIMEOUT_SECONDS = 15
_REFRESH_INTERVAL_SECONDS = 20


class WordAudioBackendProgress:
    """Own the shared canonical-table progress consumed by pycore surfaces."""

    def refresh(self, base_url: str) -> Dict[str, Any]:
        current = self.snapshot()
        if time.time() - int(current.get("refreshed_at") or 0) < _REFRESH_INTERVAL_SECONDS:
            return current
        response = laravel_client.get(
            _STATS_PATH,
            base_url=base_url,
            timeout=_STATS_TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            return self.snapshot()
        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        stats = data if isinstance(data, dict) else {}
        by_status = (
            stats.get("by_status")
            if isinstance(stats.get("by_status"), dict)
            else {}
        )
        completed = max(0, int(by_status.get("completed") or 0))
        failed = max(0, int(by_status.get("failed") or 0))
        snapshot = {
            "current": completed + failed,
            "completed": completed,
            "pending": max(0, int(by_status.get("pending") or 0)),
            "processing": max(0, int(by_status.get("processing") or 0)),
            "failed": failed,
            "total": max(0, int(stats.get("total") or 0)),
            "observed_at": int(time.time()),
            "refreshed_at": int(time.time()),
            "source": "laravel_canonical_tts_tables",
        }
        return status_snapshot_cache.update(
            STATUS_SNAPSHOT_WORD_AUDIO_PROGRESS_KEY,
            lambda _current: snapshot,
        )

    def record_result(self, success: bool) -> Dict[str, Any]:
        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            current = dict(snapshot)
            if success:
                current["completed"] = min(
                    max(0, int(current.get("total") or 0)),
                    max(0, int(current.get("completed") or 0)) + 1,
                )
                current["current"] = min(
                    max(0, int(current.get("total") or 0)),
                    max(0, int(current.get("current") or 0)) + 1,
                )
            current["observed_at"] = int(time.time())
            return current

        return status_snapshot_cache.update(
            STATUS_SNAPSHOT_WORD_AUDIO_PROGRESS_KEY,
            updater,
        )

    @staticmethod
    def snapshot() -> Dict[str, Any]:
        return status_snapshot_cache.peek(
            STATUS_SNAPSHOT_WORD_AUDIO_PROGRESS_KEY
        ) or {
            "current": 0,
            "completed": 0,
            "pending": 0,
            "processing": 0,
            "failed": 0,
            "total": 0,
            "observed_at": 0,
            "refreshed_at": 0,
            "source": "laravel_canonical_tts_tables",
        }


word_audio_backend_progress = WordAudioBackendProgress()
