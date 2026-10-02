# -*- coding: utf-8 -*-
"""Central backend-wide TTS progress snapshot for the WordAudio worker."""

import time
from typing import Any, Dict

from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_WORD_AUDIO_PROGRESS_KEY,
    status_snapshot_cache,
)


class WordAudioBackendProgress:
    """Backend-wide word audio progress shown by the lane: Laravel's
    ``progress_template`` of the lease answers, plus the results this node
    finished since the last answer."""

    def apply_template(self, progress: Dict[str, Any]) -> Dict[str, Any]:
        completed = max(0, int(progress.get("done") or 0))
        failed = max(0, int(progress.get("failed") or 0))
        snapshot = {
            "current": completed + failed,
            "completed": completed,
            "pending": max(0, int(progress.get("pending") or 0)),
            "processing": 0,
            "failed": failed,
            "total": max(0, int(progress.get("total") or 0)),
            "observed_at": int(time.time()),
            "refreshed_at": int(time.time()),
            "source": "work_lease_progress",
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
            "source": "work_lease_progress",
        }


word_audio_backend_progress = WordAudioBackendProgress()
