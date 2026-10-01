# -*- coding: utf-8 -*-
"""Orchestrator-backed speech synthesis returning base64 audio (the shared
entry of the /api/tts/synthesize route and the tts_synthesize worker task)."""

import base64
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.common.coded_message import message_fields
from pycore.pyutils.common.model_manifest import CATEGORY_TTS
from pycore.pyutils.common.model_reasons import (
    MODEL_REASON_ENGINE_FAILED,
    MODEL_REASON_INPUT_REQUIRED,
    MODEL_REASON_NO_ENGINE_AVAILABLE,
    model_reason,
)
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.engine_registry import tts_engine_registry
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator

AUDIO_MIME = "audio/mpeg"
# Prosody params honored only by the edge engine (edge-tts Communicate).
_EDGE_PROSODY_PARAMS = ("volume", "pitch")


def _voice_to_accent_gender(voice: str) -> Tuple[Optional[str], Optional[str]]:
    """Map an edge voice id (e.g. 'en-US-AriaNeural') to (accent, gender).

    The edge engine resolves its voice strictly via
    TTSConfig.resolve_voice(locale, accent, gender); there is no explicit-voice
    override, so an exact voice id cannot be honored. Derive the closest hints:
    - accent: 'en-GB' -> 'uk', other English locales -> 'us'; non-English
      voices get None because the locale already comes from the language.
    - gender: from the voice's position in TTSConfig.VOICE_MAP (index 0 is
      female, 1 is male, per TTSConfig.get_voice)."""
    parts = (voice or "").strip().split("-")
    if len(parts) < 3:
        return None, None
    locale = f"{parts[0]}-{parts[1]}"
    accent: Optional[str] = None
    if locale == "en-GB":
        accent = "uk"
    elif parts[0].lower() == "en":
        accent = "us"
    gender: Optional[str] = None
    known_voices = TTSConfig.VOICE_MAP.get(locale) or []
    if voice in known_voices:
        gender = "female" if known_voices.index(voice) == 0 else "male"
    return accent, gender


def _failure(reason: str, **extra: Any) -> Dict[str, Any]:
    """Failed synthesis: English ``error`` plus ``error_code``/``error_params``."""
    return {"success": False, **extra, **message_fields(reason, "error")}


def _synthesis_failure_reason(required_engine: Optional[str], result: Dict[str, Any]) -> str:
    """The pinned engine's own coded reason when it is unavailable, else the
    orchestrator error as a coded engine failure."""
    adapter = tts_engine_registry.get(required_engine) if required_engine else None
    if adapter is not None and not adapter.available():
        reason = adapter.disabled_reason()
        if reason:
            return reason
    if not result.get("tried") and not required_engine:
        return model_reason(MODEL_REASON_NO_ENGINE_AVAILABLE, category=CATEGORY_TTS)
    return model_reason(
        MODEL_REASON_ENGINE_FAILED,
        model=required_engine or "tts",
        detail=str(result.get("error") or "synthesis failed"),
    )


def _truthy(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() not in ("", "0", "false", "no")
    return bool(value)


def synthesize_speech(params: Dict[str, Any]) -> Dict[str, Any]:
    """Params: text (required), language (default 'en'), voice (edge voice id,
    mapped to accent/gender hints), provider ('edge' pins required_engine),
    rate (passthrough), volume/pitch (edge only; ``applied_params`` lists the
    ones honored), return_base64 (default true)."""
    text = str(params.get("text") or "").strip()
    if not text:
        return _failure(model_reason(MODEL_REASON_INPUT_REQUIRED, field="text"))
    language = str(params.get("language") or "en").strip() or "en"
    provider = str(params.get("provider") or "").strip().lower()
    voice = str(params.get("voice") or "").strip()
    raw_rate = params.get("rate")
    rate = str(raw_rate).strip() if raw_rate not in (None, "") else None
    return_base64 = _truthy(params.get("return_base64"), True)
    required_engine = "edge" if provider == "edge" else None
    prosody = {
        name: str(params.get(name)).strip()
        for name in _EDGE_PROSODY_PARAMS
        if str(params.get(name) or "").strip()
    }
    accent, gender = _voice_to_accent_gender(voice) if voice else (None, None)

    tmp_path: Optional[Path] = None
    try:
        # The orchestrator writes to a path; sentence_audio_cache stores its
        # own copy of the bytes, so the temp file is deleted afterwards.
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False, dir=str(TMP_DIR)) as tmp:
            tmp_path = Path(tmp.name)
        result = tts_orchestrator.synthesize(
            text,
            language,
            tmp_path,
            rate=rate,
            accent=accent,
            gender=gender,
            required_engine=required_engine,
            volume=prosody.get("volume"),
            pitch=prosody.get("pitch"),
        )
        if not result.get("success"):
            return _failure(_synthesis_failure_reason(required_engine, result), tried=result.get("tried") or [])
        raw = tmp_path.read_bytes() if tmp_path.exists() else b""
        payload: Dict[str, Any] = {
            "success": True,
            "engine": result.get("engine"),
            "model": result.get("model"),
            "cached": bool(result.get("cached")),
            "bytes": len(raw),
            "applied_params": sorted(prosody) if result.get("engine") == "edge" else [],
        }
        if return_base64:
            payload["audio_base64"] = base64.b64encode(raw).decode()
            payload["mime"] = AUDIO_MIME
        return payload
    except Exception as exc:  # noqa: BLE001 - boundary: engine, subprocess and file I/O
        ColorPrint.yellow(f"[TTS] synthesize failed for '{text[:40]}': {exc}")
        return _failure(model_reason(MODEL_REASON_ENGINE_FAILED, model=required_engine or "tts", detail=str(exc)))
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError as exc:
                ColorPrint.yellow(f"[TTS] temp audio cleanup failed for {tmp_path}: {exc}")


__all__ = ["AUDIO_MIME", "synthesize_speech"]
