# -*- coding: utf-8 -*-
"""Non-blocking, idempotent TTS queue progression."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.managed_service_facade import managed_model_load_context
from pycore.pyutils.tts.qwen.config import ENGINE_NAME
import pycore.pyutils.tts.qwen.engine as qwen_engine


_FETCH_TIMEOUT_SECONDS = 30.0
_MAX_POLL_FAILURES = 6
_OUTPUT_FORMAT_PATH = Path("article.mp3")
_POLL_MAX_SECONDS = 30.0
_POLL_MIN_SECONDS = 1.0


class QueuedTtsSynthesis:
    """Advance one Qwen job by one network-free-or-short-poll step."""

    def advance(
        self,
        text: str,
        language: str,
        job_state: Optional[Dict[str, Any]],
        job_scope: str,
    ) -> Dict[str, Any]:
        clean = str(text or "").strip()
        state = dict(job_state or {})
        if not clean:
            return {"status": "failed", "error": "empty text", "job": state}

        client_job_id = str(state.get("client_job_id") or "")
        if not client_job_id:
            client_job_id = self._client_job_id(job_scope, clean, language)

        with managed_services.lease(ENGINE_NAME), managed_model_load_context(ENGINE_NAME):
            if not state.get("job_id"):
                observed = qwen_engine.submit_queued_synthesis(
                    clean,
                    language,
                    _OUTPUT_FORMAT_PATH,
                    instruct=os.environ.get("QWEN3TTS_INSTRUCT"),
                    client_job_id=client_job_id,
                )
            else:
                observed = qwen_engine.poll_queued_synthesis(
                    str(state.get("job_id") or ""),
                    client_job_id,
                )
                if observed.get("missing"):
                    observed = qwen_engine.submit_queued_synthesis(
                        clean,
                        language,
                        _OUTPUT_FORMAT_PATH,
                        instruct=os.environ.get("QWEN3TTS_INSTRUCT"),
                        client_job_id=client_job_id,
                    )

            if not observed.get("ok"):
                failures = int(state.get("poll_failures") or 0) + 1
                next_state = {
                    **state,
                    "client_job_id": client_job_id,
                    "poll_failures": failures,
                    "last_error": str(observed.get("error") or "queue unavailable"),
                }
                if failures >= _MAX_POLL_FAILURES:
                    return {
                        "status": "failed",
                        "error": next_state["last_error"],
                        "job": next_state,
                    }
                return {
                    "status": "waiting",
                    "poll_after_s": self._failure_poll_seconds(failures),
                    "job": next_state,
                }

            next_state = self._job_state(observed, client_job_id)
            status = str(observed.get("status") or "pending")
            if status in ("pending", "running"):
                return {
                    "status": "waiting",
                    "poll_after_s": self._poll_seconds(observed),
                    "job": next_state,
                }
            if status in ("failed", "cancelled"):
                return {
                    "status": "failed",
                    "error": str(observed.get("error") or status),
                    "job": next_state,
                }
            if status != "done":
                return {
                    "status": "waiting",
                    "poll_after_s": _POLL_MIN_SECONDS,
                    "job": next_state,
                }

            ok, audio_bytes, error = qwen_engine.fetch_queued_synthesis(
                str(observed.get("job_id") or "")
            )
            if not ok or not audio_bytes:
                return {
                    "status": "waiting",
                    "poll_after_s": _POLL_MIN_SECONDS,
                    "job": {**next_state, "last_error": error or "result unavailable"},
                }
            return {
                "status": "done",
                "audio_bytes": audio_bytes,
                "engine": ENGINE_NAME,
                "model": qwen_engine.active_model_id(),
                "chunked": True,
                "job": next_state,
            }

    @staticmethod
    def _client_job_id(scope: str, text: str, language: str) -> str:
        identity = "\x1f".join((str(scope or ""), text, language or "en"))
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        return f"qwen3tts-{digest}"

    @staticmethod
    def _job_state(observed: Dict[str, Any], client_job_id: str) -> Dict[str, Any]:
        return {
            "job_id": str(observed.get("job_id") or ""),
            "client_job_id": client_job_id,
            "status": str(observed.get("status") or ""),
            "submitted_at": observed.get("submitted_at"),
            "started_at": observed.get("started_at"),
            "running_elapsed_ms": int(observed.get("running_elapsed_ms") or 0),
            "queue_pending": int(observed.get("queue_pending") or 0),
            "average_elapsed_ms": int(observed.get("average_elapsed_ms") or 0),
            "poll_failures": 0,
        }

    @staticmethod
    def _failure_poll_seconds(failures: int) -> float:
        return min(_POLL_MAX_SECONDS, max(_POLL_MIN_SECONDS, float(2 ** failures)))

    @staticmethod
    def _poll_seconds(observed: Dict[str, Any]) -> float:
        status = str(observed.get("status") or "pending")
        average_ms = int(observed.get("average_elapsed_ms") or 0)
        running_ms = int(observed.get("running_elapsed_ms") or 0)
        if status == "pending":
            pending = max(1, int(observed.get("queue_pending") or 1))
            estimate = (average_ms * pending / 1000.0) if average_ms > 0 else 4.0
            return min(_POLL_MAX_SECONDS, max(2.0, estimate / 4.0))
        if average_ms > running_ms:
            remaining = (average_ms - running_ms) / 1000.0
            return min(15.0, max(_POLL_MIN_SECONDS, remaining / 4.0))
        elapsed = running_ms / 1000.0
        return min(15.0, max(_POLL_MIN_SECONDS, 1.0 + elapsed / 60.0))


queued_tts_synthesis = QueuedTtsSynthesis()


__all__ = ["queued_tts_synthesis"]
