# -*- coding: utf-8 -*-
"""
TTS orchestrator — ONE entry that picks the highest-priority AVAILABLE local
TTS engine and synthesizes text to MP3.

Priority (highest first), per project decision:
    1. edge      — Microsoft Edge TTS (online; serialized process-wide).
    2. sherpa    — Sherpa-ONNX Kokoro offline (CPU, never fails when installed).
    3. melotts   — MeloTTS (torch/GPU; zh/en mixed).
    4. gptsovits — Local GPT-SoVITS api server (voice clone; opt-in).

Override order with env ``TTS_ENGINE_PRIORITY`` (e.g. ``edge->sherpa->melotts``).
"""

import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from . import gptsovits_engine, melotts_engine, sherpa_engine

_DEFAULT_PRIORITY = ("edge", "sherpa", "melotts", "gptsovits")
_LOCALE_BY_LANG = {
    "en": "en-US",
    "zh": "zh-CN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "es": "es-ES",
    "fr": "fr-FR",
}
_ENGINE_NOTES = {
    "edge": "Microsoft Edge TTS (online; serialized)",
    "sherpa": "Sherpa-ONNX Kokoro offline (CPU)",
    "melotts": "MeloTTS offline (torch/GPU)",
    "gptsovits": "GPT-SoVITS local api server (voice clone)",
}


def _priority() -> tuple[str, ...]:
    raw = (os.environ.get("TTS_ENGINE_PRIORITY") or "").strip()
    if not raw:
        return _DEFAULT_PRIORITY
    parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
    return tuple(parts) if parts else _DEFAULT_PRIORITY


TTS_ENGINE_PRIORITY = _priority()


def _edge_voice(lang: Optional[str]) -> str:
    locale = _LOCALE_BY_LANG.get((lang or "en").lower(), "en-US")
    return TTSConfig.get_voice(locale, "female")


def _rate_to_speed(rate: Optional[str]) -> float:
    if not rate:
        return 1.0
    text = str(rate).strip()
    if text.endswith("%"):
        try:
            pct = float(text[:-1])
            return max(0.25, 1.0 + pct / 100.0)
        except ValueError:
            return 1.0
    try:
        return max(0.25, float(text))
    except ValueError:
        return 1.0


def engine_available(name: str) -> bool:
    if name == "edge":
        return get_edge_tts_client().initialize()
    if name == "sherpa":
        return sherpa_engine.available()
    if name == "melotts":
        return melotts_engine.available()
    if name == "gptsovits":
        return gptsovits_engine.available()
    return False


def best_engine() -> Optional[str]:
    for name in _priority():
        if engine_available(name):
            return name
    return None


def tts_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no synthesis run)."""
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        engines.append({
            "name": name,
            "priority": i + 1,
            "available": engine_available(name),
            "note": _ENGINE_NOTES.get(name, ""),
        })
    avail = [e for e in engines if e["available"]]
    return {
        "success": True,
        "best": best_engine(),
        "available_count": len(avail),
        "engines": engines,
    }


def _synth_edge(text: str, lang: Optional[str], output_path: Path, rate: Optional[str]) -> bool:
    client = get_edge_tts_client()
    if not client.initialize():
        return False
    voice = _edge_voice(lang)
    return client.synthesize(text, voice, output_path, rate=rate)


def _synth_offline(
    engine: str,
    text: str,
    lang: Optional[str],
    output_path: Path,
    rate: Optional[str],
) -> bool:
    speed = _rate_to_speed(rate)
    if engine == "sherpa":
        return sherpa_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "melotts":
        return melotts_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "gptsovits":
        return gptsovits_engine.synthesize(text, lang or "en", output_path, speed=speed)
    return False


_SYNTHESIZERS: Dict[str, Callable[..., bool]] = {
    "edge": _synth_edge,
    "sherpa": lambda t, l, p, r: _synth_offline("sherpa", t, l, p, r),
    "melotts": lambda t, l, p, r: _synth_offline("melotts", t, l, p, r),
    "gptsovits": lambda t, l, p, r: _synth_offline("gptsovits", t, l, p, r),
}


def synthesize(
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Synthesize ``text`` to ``output_path`` (.mp3) using the best available engine.

    Returns:
        { success, engine, error, tried: [names] }
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return {"success": False, "engine": None, "error": "empty text", "tried": []}

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tried: List[str] = []
    last_error: Optional[str] = None
    for name in _priority():
        if not engine_available(name):
            continue
        synth = _SYNTHESIZERS.get(name)
        if synth is None:
            continue
        tried.append(name)
        try:
            ok = synth(cleaned, language, output_path, rate)
        except Exception as e:  # noqa: BLE001 — fall through to next engine
            last_error = f"{name}: {e}"
            ColorPrint.yellow(f"[tts] {name} failed ({e}); trying next engine")
            continue
        if ok and output_path.exists() and output_path.stat().st_size > 0:
            return {"success": True, "engine": name, "error": None, "tried": tried}
        last_error = f"{name}: synthesis failed"
        ColorPrint.gray(f"[tts] {name} returned no audio; trying next engine")

    return {
        "success": False,
        "engine": None,
        "error": last_error or ("No TTS engine available" if not tried else "All TTS engines failed"),
        "tried": tried,
    }


__all__ = [
    "TTS_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "tts_status",
    "synthesize",
]
