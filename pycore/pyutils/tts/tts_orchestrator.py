# -*- coding: utf-8 -*-
"""
TTS orchestrator — ONE entry that picks the highest-priority AVAILABLE local
TTS engine and synthesizes text to MP3.

Priority (highest first), per project decision:
    1. edge           — Microsoft Edge TTS (online; serialized process-wide).
    2. streamelements — StreamElements speech endpoint (online, keyless;
                        us->Joanna / uk->Amy, English only).
    3. sherpa         — Sherpa-ONNX Kokoro offline (CPU, never fails when installed).
    4. melotts        — MeloTTS (torch GPU->CPU auto; zh/en mixed).
    5. gptsovits      — Local GPT-SoVITS api server (voice clone; opt-in).
    6. gtts_web       — Google Translate web TTS (online, keyless; ~200 char cap,
                        accent not selectable).
    7. azure          — Azure Speech cloud (free F0 ~0.5M chars/mo) — API fallback,
                        used when every engine above is unavailable/failed.

The cloud engine being last enforces the "local-first; API only if local can't"
rule automatically (synthesize() falls through engines in order). Add more free
cloud SDKs (google/polly) the same way and append them here.

Accent: synthesize(accent="us"|"uk") threads the requested English accent to
the engines that can honor it (edge picks an en-US/en-GB voice, streamelements
picks Joanna/Amy); other engines still run unchanged, and the result's
``accent`` key reports the accent ACTUALLY produced ("us"|"uk"|"unknown") so
callers can tag accent_fallback.

Override order with env ``TTS_ENGINE_PRIORITY`` (e.g. ``edge->sherpa->melotts``).
"""

import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from . import (
    azure_engine,
    gptsovits_engine,
    gtts_web_engine,
    melotts_engine,
    sherpa_engine,
    streamelements_engine,
)

_DEFAULT_PRIORITY = (
    "edge", "streamelements", "sherpa", "melotts", "gptsovits", "gtts_web", "azure")
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
    "streamelements": "StreamElements speech endpoint (online, keyless; en only, us/uk voices)",
    "sherpa": "Sherpa-ONNX Kokoro offline (CPU)",
    "melotts": "MeloTTS offline (torch GPU->CPU auto)",
    "gptsovits": "GPT-SoVITS local api server (voice clone)",
    "gtts_web": "Google Translate web TTS (online, keyless; ~200 char cap)",
    "azure": "Azure Speech cloud (free F0; API fallback)",
}
# Engines that can honor a requested English accent (us/uk voice selection).
_ACCENT_AWARE_ENGINES = ("edge", "streamelements")


def _priority() -> tuple[str, ...]:
    raw = (os.environ.get("TTS_ENGINE_PRIORITY") or "").strip()
    if not raw:
        return _DEFAULT_PRIORITY
    parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
    return tuple(parts) if parts else _DEFAULT_PRIORITY


TTS_ENGINE_PRIORITY = _priority()

# Edge-tts cooldown: after a synth failure, skip edge for a short window so a whole
# batch doesn't keep paying the per-attempt timeout when the endpoint is down or
# region-blocked — the offline engine takes over immediately. Override TTS_EDGE_COOLDOWN_S.
_EDGE_COOLDOWN_S = float(os.environ.get("TTS_EDGE_COOLDOWN_S", "60") or "60")
_edge_cooldown_until = 0.0


def _edge_in_cooldown() -> bool:
    return time.monotonic() < _edge_cooldown_until


def _set_edge_cooldown() -> None:
    """Mark edge-tts as failing so the orchestrator skips it for a short window."""
    global _edge_cooldown_until
    _edge_cooldown_until = time.monotonic() + _EDGE_COOLDOWN_S
    ColorPrint.yellow(
        f"[tts] edge-tts cooling down for {_EDGE_COOLDOWN_S:.0f}s; using offline engine meanwhile")


def edge_cooldown_remaining() -> float:
    """Seconds until edge-tts leaves its failure cooldown (0.0 when not cooling)."""
    rem = _edge_cooldown_until - time.monotonic()
    return round(rem, 1) if rem > 0 else 0.0


def get_edge_cooldown_seconds() -> float:
    """Current edge-tts failure-cooldown window length (seconds)."""
    return _EDGE_COOLDOWN_S


def set_edge_cooldown_seconds(seconds: Any) -> float:
    """Override the edge-tts cooldown window at runtime (Settings-adjustable).
    Clamped to [0, 3600]s; ignored if not numeric. Returns the value in effect."""
    global _EDGE_COOLDOWN_S
    try:
        _EDGE_COOLDOWN_S = max(0.0, min(3600.0, float(seconds)))
    except (TypeError, ValueError):
        pass
    return _EDGE_COOLDOWN_S


def _normalize_accent(accent: Optional[str]) -> Optional[str]:
    """Normalize an accent hint to the wire values "us"|"uk"; anything else -> None."""
    value = (accent or "").strip().lower()
    return value if value in ("us", "uk") else None


def _is_english_lang(lang: Optional[str]) -> bool:
    return (lang or "en").strip().lower().startswith("en")


def _engine_actual_accent(engine: str, lang: Optional[str], accent: Optional[str]) -> str:
    """Accent an engine ACTUALLY produces for this request ("us"|"uk"|"unknown").

    Accent-aware engines honor the request (default US voice); azure_engine
    hardcodes en-US-JennyNeural for English; every other engine (and any
    non-English language) has no accent guarantee.
    """
    if not _is_english_lang(lang):
        return "unknown"
    if engine in _ACCENT_AWARE_ENGINES:
        return "uk" if accent == "uk" else "us"
    if engine == "azure":
        return "us"
    return "unknown"


def _edge_voice(lang: Optional[str], accent: Optional[str] = None) -> str:
    locale = _LOCALE_BY_LANG.get((lang or "en").lower(), "en-US")
    # Accent "uk" on an English locale -> British voice (en-GB-SoniaNeural).
    if accent == "uk" and locale.startswith("en-"):
        locale = "en-GB"
    voice = TTSConfig.get_voice(locale, "female")
    if not voice:
        # Unmapped locale -> get_voice returns "" and edge-tts would fail with no
        # audio. Fall back to a known-good English voice (offline engines still take
        # over later if edge is unavailable / cooling down).
        ColorPrint.yellow(f"[tts] no edge voice for locale '{locale}'; falling back to en-US")
        voice = TTSConfig.get_voice("en-US", "female") or "en-US-JennyNeural"
    return voice


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
    if name == "streamelements":
        return streamelements_engine.available()
    if name == "sherpa":
        return sherpa_engine.available()
    if name == "melotts":
        return melotts_engine.available()
    if name == "gptsovits":
        return gptsovits_engine.available()
    if name == "gtts_web":
        return gtts_web_engine.available()
    if name == "azure":
        return azure_engine.available()
    return False


def best_engine() -> Optional[str]:
    for name in _priority():
        if engine_available(name):
            return name
    return None


def tts_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no synthesis run)."""
    cooldown = edge_cooldown_remaining()
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        entry = {
            "name": name,
            "priority": i + 1,
            "available": engine_available(name),
            "note": _ENGINE_NOTES.get(name, ""),
        }
        if name == "edge":
            # When cooling down, synthesize() skips edge regardless of availability.
            entry["cooldown_remaining"] = cooldown
        engines.append(entry)
    avail = [e for e in engines if e["available"]]
    # Derive `best` and `active` from the availability we ALREADY computed above
    # rather than calling best_engine() (which would re-probe every engine a
    # second time — a redundant round of HTTP/import checks on each poll).
    # best = first available in priority order; active also respects the edge
    # cooldown (synthesize() skips edge while cooling down).
    best = next((e["name"] for e in engines if e["available"]), None)
    active = None
    for e in engines:
        if e["available"] and not (e["name"] == "edge" and cooldown > 0):
            active = e["name"]
            break
    return {
        "success": True,
        "best": best,
        "active": active,
        "edge_cooldown_remaining": cooldown,
        "available_count": len(avail),
        "engines": engines,
    }


def _synth_edge(text: str, lang: Optional[str], output_path: Path, rate: Optional[str],
                accent: Optional[str] = None) -> bool:
    client = get_edge_tts_client()
    if not client.initialize():
        return False
    voice = _edge_voice(lang, accent)
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


def _synth_azure(text: str, lang: Optional[str], output_path: Path, rate: Optional[str]) -> bool:
    # Cloud engine takes the percent rate string directly (mapped to SSML prosody).
    return azure_engine.synthesize(text, lang or "en", output_path, rate=rate)


# Uniform arity (text, lang, path, rate, accent); accent-blind engines ignore it.
_SYNTHESIZERS: Dict[str, Callable[..., bool]] = {
    "edge": _synth_edge,
    "streamelements": lambda t, l, p, r, a=None: streamelements_engine.synthesize(
        t, l or "en", p, accent=a),
    "sherpa": lambda t, l, p, r, a=None: _synth_offline("sherpa", t, l, p, r),
    "melotts": lambda t, l, p, r, a=None: _synth_offline("melotts", t, l, p, r),
    "gptsovits": lambda t, l, p, r, a=None: _synth_offline("gptsovits", t, l, p, r),
    "gtts_web": lambda t, l, p, r, a=None: gtts_web_engine.synthesize(t, l or "en", p),
    "azure": lambda t, l, p, r, a=None: _synth_azure(t, l, p, r),
}


def synthesize(
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Synthesize ``text`` to ``output_path`` (.mp3) using the best available engine.

    ``accent`` ("us"|"uk"|None) is honored by the accent-aware engines
    (edge/streamelements); other engines still run — the returned ``accent``
    is the accent ACTUALLY produced ("us"|"uk"|"unknown"; None on failure) so
    callers can tag accent_fallback.

    Returns:
        { success, engine, accent, error, tried: [names] }
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return {"success": False, "engine": None, "accent": None,
                "error": "empty text", "tried": []}

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    want_accent = _normalize_accent(accent)

    tried: List[str] = []
    last_error: Optional[str] = None
    for name in _priority():
        # Skip a recently-failed edge endpoint so a whole batch doesn't repeatedly
        # pay the per-attempt timeout when edge is down — go straight to offline.
        if name == "edge" and _edge_in_cooldown():
            ColorPrint.gray("[tts] edge in cooldown (recent failure); skipping to offline engine")
            continue
        if not engine_available(name):
            continue
        synth = _SYNTHESIZERS.get(name)
        if synth is None:
            continue
        tried.append(name)
        try:
            ok = synth(cleaned, language, output_path, rate, want_accent)
        except Exception as e:  # noqa: BLE001 — fall through to next engine
            last_error = f"{name}: {e}"
            ColorPrint.yellow(f"[tts] {name} failed ({e}); trying next engine")
            if name == "edge":
                _set_edge_cooldown()
            continue
        if ok and output_path.exists() and output_path.stat().st_size > 0:
            return {"success": True, "engine": name,
                    "accent": _engine_actual_accent(name, language, want_accent),
                    "error": None, "tried": tried}
        last_error = f"{name}: synthesis failed"
        ColorPrint.gray(f"[tts] {name} returned no audio; trying next engine")
        if name == "edge":
            _set_edge_cooldown()

    return {
        "success": False,
        "engine": None,
        "accent": None,
        "error": last_error or ("No TTS engine available" if not tried else "All TTS engines failed"),
        "tried": tried,
    }


def synthesize_engine(
    engine: str,
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
) -> bool:
    """Synthesize with ONE named engine (no fallback). For the UI per-engine test.
    Returns True only when the engine actually produced non-empty audio."""
    synth = _SYNTHESIZERS.get(engine)
    if synth is None:
        return False
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        ok = synth((text or "").strip(), language, output_path, rate, _normalize_accent(accent))
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[tts] {engine} test failed ({e})")
        return False
    return bool(ok and output_path.exists() and output_path.stat().st_size > 0)


def tts_test(engine: Optional[str] = None, text: Optional[str] = None,
             language: str = "en", rate: Optional[str] = None,
             accent: Optional[str] = None) -> Dict[str, Any]:
    """Live synth test for ONE engine (or the best available). Returns
    {success, engine, latency_ms, bytes, accent, error}. Skips the edge cooldown
    so the user's explicit test always runs the engine they asked for."""
    name = engine or best_engine()
    if not name:
        return {"success": False, "engine": None, "latency_ms": 0, "bytes": 0, "error": "no TTS engine available"}
    if not engine_available(name):
        return {"success": False, "engine": name, "latency_ms": 0, "bytes": 0, "error": f"{name} unavailable"}
    out = Path(os.environ.get("TEMP") or "/tmp") / "pycore_tts_test" / f"{name}.mp3"
    sample = (text or "").strip() or "This is a pycore text to speech test."
    want_accent = _normalize_accent(accent)
    t0 = time.monotonic()
    ok = synthesize_engine(name, sample, language, out, rate, accent=want_accent)
    latency = round((time.monotonic() - t0) * 1000)
    size = out.stat().st_size if (ok and out.exists()) else 0
    return {
        "success": bool(ok),
        "engine": name,
        "latency_ms": latency,
        "bytes": size,
        # Where the produced mp3 landed (for the caller to persist into history).
        "path": str(out) if (ok and size > 0) else None,
        "text": sample,
        "language": language,
        # Accent ACTUALLY produced by this engine ("us"|"uk"|"unknown"; None on failure).
        "accent": _engine_actual_accent(name, language, want_accent) if ok else None,
        "error": None if ok else f"{name} produced no audio",
    }


__all__ = [
    "TTS_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "tts_status",
    "synthesize",
    "synthesize_engine",
    "tts_test",
]
