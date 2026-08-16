# -*- coding: utf-8 -*-
"""Register stable non-UI TTS synthesis controllers on HTTP API."""

import base64
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.callmodule.rpc_routes.route_names import TTS_SYNTHESIZE
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.tts.edge.config import TTSConfig
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator


def _voice_to_accent_gender(voice: str) -> Tuple[Optional[str], Optional[str]]:
    """Map an edge voice id (e.g. 'en-US-AriaNeural') to (accent, gender).

    The edge engine path (engine_registry.EdgeTTSEngineAdapter.synthesize)
    resolves its voice strictly via TTSConfig.resolve_voice(locale, accent,
    gender); there is NO explicit-voice override mechanism (no voice field on
    TTSSynthesisRequest, no edge entry in engine_policy env overrides), so an
    exact voice id cannot be honored. Derive the closest hints instead:
    - accent: 'en-GB' -> 'uk', other English locales -> 'us'
      (normalize_tts_accent only accepts 'us'/'uk'); non-English voices get
      None because the locale already comes from the language param.
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


def synthesize_speech(params: Dict[str, Any]) -> Dict[str, Any]:
    """POST /api/tts/synthesize — orchestrator-backed synthesis, base64 audio.

    Params: text (required), language (default 'en'), voice (edge voice id,
    mapped to accent/gender hints), provider ('edge' pins required_engine),
    rate (passthrough), return_base64 (default true), enable_cache (accepted;
    the orchestrator's sentence-audio cache already handles caching)."""
    text = str(params.get("text") or "").strip()
    if not text:
        return {"success": False, "error": "text is required"}
    language = str(params.get("language") or "en").strip() or "en"
    provider = str(params.get("provider") or "").strip().lower()
    voice = str(params.get("voice") or "").strip()
    raw_rate = params.get("rate")
    rate = str(raw_rate).strip() if raw_rate not in (None, "") else None
    return_base64 = params.get("return_base64", True)
    if isinstance(return_base64, str):
        return_base64 = return_base64.strip().lower() not in ("", "0", "false", "no")
    else:
        return_base64 = bool(return_base64)
    required_engine = "edge" if provider == "edge" else None
    accent, gender = _voice_to_accent_gender(voice) if voice else (None, None)

    tmp_path: Optional[Path] = None
    try:
        # Temp-file convention mirrors word_audio_service.edge_synth: the
        # orchestrator writes to a path; sentence_audio_cache stores its own
        # copy of the bytes, so the temp file is safe to delete afterwards.
        with tempfile.NamedTemporaryFile(
            suffix=".mp3",
            delete=False,
            dir=str(TMP_DIR),
        ) as tmp:
            tmp_path = Path(tmp.name)
        result = tts_orchestrator.synthesize(
            text,
            language,
            tmp_path,
            rate=rate,
            accent=accent,
            gender=gender,
            required_engine=required_engine,
        )
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error") or "synthesis failed",
                "tried": result.get("tried") or [],
            }
        raw = tmp_path.read_bytes() if tmp_path.exists() else b""
        payload: Dict[str, Any] = {
            "success": True,
            "engine": result.get("engine"),
            "model": result.get("model"),
            "cached": bool(result.get("cached")),
            "bytes": len(raw),
        }
        if return_base64:
            payload["audio_base64"] = base64.b64encode(raw).decode()
            payload["mime"] = "audio/mpeg"
        return payload
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[TTS] /tts/synthesize failed for '{text[:40]}': {exc}")
        return {"success": False, "error": str(exc)}
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:  # noqa: BLE001
                pass


def register_tts_routes(server) -> None:
    """Register stable TTS synthesis routes backed by the TTS orchestrator."""

    server.post(path=TTS_SYNTHESIZE, handler=synthesize_speech)
