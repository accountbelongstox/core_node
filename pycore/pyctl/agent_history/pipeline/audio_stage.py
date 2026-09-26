# -*- coding: utf-8 -*-
"""Non-blocking audio stage for agent-history articles."""

import base64
from typing import Any, Dict, Optional

from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.text_parsing import SUPPORTED_LANGUAGE_CODES, normalize_language_code
from pycore.pyutils.tts.queued_synthesis import queued_tts_synthesis


_MINIMUM_AUDIO_BYTES = 1024


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
