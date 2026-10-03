# -*- coding: utf-8 -*-
"""Non-blocking audio stage for agent-history articles."""

import base64
import time
from typing import Any, Dict, Optional

from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyctl.tts.laravel_audio_worker import laravel_sentence_audio_worker
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.text_parsing import SUPPORTED_LANGUAGE_CODES, normalize_language_code
from pycore.pyutils.tts.queued_synthesis import queued_tts_synthesis


_MINIMUM_AUDIO_BYTES = 1024
# Article TTS yields the shared Qwen queue to the sentence lane (work-lease
# book plans): it is not submitted while that lane has queued or running rows,
# for at most the max wait so a permanently busy lane cannot starve it.
SENTENCE_LANE_YIELD_POLL_SECONDS = 15.0
SENTENCE_LANE_YIELD_MAX_SECONDS = 900.0


def _sentence_lane_busy() -> bool:
    counts = laravel_sentence_audio_worker.live_counts()
    return int(counts.get("queued") or 0) + int(counts.get("processing") or 0) > 0


def _yield_to_sentence_lane(job_state: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """A waiting result while the sentence lane owns the queue; None to submit."""
    state = dict(job_state or {})
    if state.get("job_id"):
        return None
    waiting_since = float(state.get("yield_since") or time.time())
    if time.time() - waiting_since >= SENTENCE_LANE_YIELD_MAX_SECONDS or not _sentence_lane_busy():
        return None
    return {
        "status": "waiting",
        "poll_after_s": SENTENCE_LANE_YIELD_POLL_SECONDS,
        "job": {**state, "status": "yield_sentence_lane", "yield_since": waiting_since},
    }


def _tts_lang_code(target_lang: str) -> str:
    code = normalize_language_code(target_lang)
    return code if code in SUPPORTED_LANGUAGE_CODES else "en"


def advance_audio_synthesis(
    text: str,
    job_state: Optional[Dict[str, Any]],
    job_scope: str,
) -> Dict[str, Any]:
    """Advance one idempotent queue job without waiting for generation."""
    clean = (text or "").strip()
    if not clean:
        return {"status": "failed", "error": "empty article for TTS", "job": dict(job_state or {})}

    yielded = _yield_to_sentence_lane(job_state)
    if yielded is not None:
        return yielded

    cfg = get_config()
    language = _tts_lang_code(str(cfg.get("target_lang") or "EN"))
    result = queued_tts_synthesis.advance(clean, language, job_state, job_scope)
    if result.get("status") != "done":
        return result

    audio_bytes = result.get("audio_bytes") or b""
    if len(audio_bytes) < _MINIMUM_AUDIO_BYTES:
        return {
            "status": "failed",
            "error": f"TTS produced suspiciously small audio ({len(audio_bytes)} bytes)",
            "job": result.get("job") or {},
        }
    engine = str(result.get("engine") or "")
    model = str(result.get("model") or "")
    chunked = bool(result.get("chunked"))
    ColorPrint.gray(
        f"[AgentHistoryTTS] audio source: engine={engine or 'unknown'} "
        f"model={model or '-'} multi_sentence={chunked} bytes={len(audio_bytes)}"
    )
    return {
        "status": "done",
        "audio": {
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "engine": engine,
            "model": model,
            "chunked": chunked,
            "accent": "us" if language == "en" else None,
            "bytes": len(audio_bytes),
        },
        "job": result.get("job") or {},
    }


__all__ = ["advance_audio_synthesis"]
