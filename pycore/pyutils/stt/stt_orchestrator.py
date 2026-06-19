# -*- coding: utf-8 -*-
"""
STT orchestrator — ONE place that reports which speech-to-text engines are
available and runs a live recognition test. Deliberately shaped like
pyutils/tts/tts_orchestrator.py so the backend/frontend speak ONE contract for
TTS, STT and OCR (status: {success, best, active, available_count, engines:[...]}).

Priority (highest first), local-first like TTS:
    1. faster-whisper — CTranslate2 Whisper (CPU int8 / GPU), default for video-extract.
    2. whisper        — OpenAI Whisper (offline; large on GPU, turbo on CPU).
    3. vosk           — Vosk offline ASR (lightweight; needs a model dir).
    4. azure          — Azure Speech cloud STT (free F0 ~0.5M chars/mo) — API fallback,
                        the ONLY STT engine with a quota/balance concept.

Override order with env ``STT_ENGINE_PRIORITY`` (e.g. ``whisper->vosk``).

The live test (``stt_test``) synthesizes a known phrase with the TTS orchestrator
(offline-first) and feeds the clip back through the chosen STT engine, returning
{success, engine, text, latency_ms, error} — the round-trip is the test.
"""

import importlib.util
import os
import tempfile
import time
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_vosk,
    get_third_package_whisper,
)
from pycore.pyutils.common.api_secrets import azure_speech_key, azure_speech_region

_DEFAULT_PRIORITY = ("faster-whisper", "whisper", "vosk", "azure")
_SAMPLE_PHRASE = "the quick brown fox jumps over the lazy dog"
_ENGINE_NOTES = {
    "faster-whisper": "Faster-Whisper (CTranslate2; CPU int8 / GPU) — offline",
    "whisper": "OpenAI Whisper (offline; large->GPU, turbo->CPU)",
    "vosk": "Vosk offline ASR (lightweight; needs a model dir)",
    "azure": "Azure Speech cloud STT (free F0 ~0.5M chars/mo; API fallback)",
}

# Cache loaded local models so repeat tests don't reload weights every click.
_model_cache: Dict[str, Any] = {}


def _priority() -> tuple[str, ...]:
    raw = (os.environ.get("STT_ENGINE_PRIORITY") or "").strip()
    if not raw:
        return _DEFAULT_PRIORITY
    parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
    return tuple(parts) if parts else _DEFAULT_PRIORITY


STT_ENGINE_PRIORITY = _priority()


# --- availability ---------------------------------------------------------- #

def _faster_whisper_available() -> bool:
    return importlib.util.find_spec("faster_whisper") is not None


def _whisper_available() -> bool:
    return get_third_package_whisper() is not None


def _vosk_available() -> bool:
    # Vosk needs both the package AND a model dir (env VOSK_MODEL_DIR or a default
    # cache). Without a model it cannot recognize, so report it unavailable.
    if get_third_package_vosk() is None:
        return False
    return _vosk_model_dir() is not None


def _azure_key() -> str:
    # Single key-reading center (pyutils/common/api_secrets) — shared with azure TTS.
    return azure_speech_key()


def _azure_region() -> str:
    return azure_speech_region()


def _azure_available() -> bool:
    """Azure Speech SDK importable AND key+region configured AND not quota-blocked."""
    if importlib.util.find_spec("azure.cognitiveservices.speech") is None:
        return False
    blocked, _ = _azure_stt_blocked()
    return bool(_azure_key() and _azure_region() and not blocked)


def _azure_stt_blocked() -> tuple[bool, Optional[str]]:
    try:
        from pycore.pyutils.azure_speech.quota_state import is_stt_quota_blocked
        return is_stt_quota_blocked()
    except Exception:
        return (False, None)


def _vosk_model_dir() -> Optional[Path]:
    env = (os.environ.get("VOSK_MODEL_DIR") or "").strip()
    candidates = []
    if env:
        candidates.append(Path(env))
    try:
        from pycore.pyfoundations.system_paths import APP_CACHE_DIR
        candidates.append(Path(APP_CACHE_DIR) / "stt" / "vosk")
    except Exception:
        pass
    for c in candidates:
        # A Vosk model dir contains a 'conf' or 'am' subdir.
        if c.is_dir() and (c / "conf").is_dir():
            return c
        if c.is_dir():
            sub = sorted(c.glob("*/conf"))
            if sub:
                return sub[0].parent
    return None


def engine_available(name: str) -> bool:
    if name == "faster-whisper":
        return _faster_whisper_available()
    if name == "whisper":
        return _whisper_available()
    if name == "vosk":
        return _vosk_available()
    if name == "azure":
        return _azure_available()
    return False


def best_engine() -> Optional[str]:
    for name in _priority():
        if engine_available(name):
            return name
    return None


def _quota(name: str) -> Optional[Dict[str, Any]]:
    """Quota/balance info for an engine (only Azure Speech has one for STT)."""
    if name != "azure":
        return None
    blocked, error = _azure_stt_blocked()
    return {
        "kind": "free-tier",
        "note": "Azure Speech free F0 ~0.5M chars/mo",
        "blocked": bool(blocked),
        "error": error,
    }


def stt_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no recognition run)."""
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        entry: Dict[str, Any] = {
            "name": name,
            "priority": i + 1,
            "available": engine_available(name),
            "note": _ENGINE_NOTES.get(name, ""),
        }
        quota = _quota(name)
        if quota is not None:
            entry["quota"] = quota
        engines.append(entry)
    avail = [e for e in engines if e["available"]]
    best = next((e["name"] for e in engines if e["available"]), None)
    return {
        "success": True,
        "best": best,
        "active": best,
        "available_count": len(avail),
        "engines": engines,
    }


# --- transcription --------------------------------------------------------- #

def _transcribe_faster_whisper(audio_path: Path, language: Optional[str]) -> str:
    from faster_whisper import WhisperModel  # availability checked by caller
    model = _model_cache.get("faster-whisper")
    if model is None:
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        _model_cache["faster-whisper"] = model
    segments, _info = model.transcribe(str(audio_path), language=language)
    return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe_whisper(audio_path: Path, language: Optional[str]) -> str:
    whisper = get_third_package_whisper()
    model = _model_cache.get("whisper")
    if model is None:
        model = whisper.load_model("tiny")
        _model_cache["whisper"] = model
    result = model.transcribe(str(audio_path), language=language, fp16=False)
    return str(result.get("text", "")).strip()


def _transcribe_vosk(audio_path: Path, language: Optional[str]) -> str:
    vosk = get_third_package_vosk()
    model_dir = _vosk_model_dir()
    if model_dir is None:
        raise RuntimeError("no Vosk model dir (set VOSK_MODEL_DIR)")
    model = _model_cache.get("vosk")
    if model is None:
        model = vosk.Model(str(model_dir))
        _model_cache["vosk"] = model
    import json as _json
    with wave.open(str(audio_path), "rb") as wf:
        rec = vosk.KaldiRecognizer(model, wf.getframerate())
        rec.SetWords(False)
        text_parts: List[str] = []
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            if rec.AcceptWaveform(data):
                text_parts.append(_json.loads(rec.Result()).get("text", ""))
        text_parts.append(_json.loads(rec.FinalResult()).get("text", ""))
    return " ".join(p for p in text_parts if p).strip()


def _transcribe_azure(audio_path: Path, language: Optional[str]) -> str:
    import azure.cognitiveservices.speech as speechsdk
    speech_config = speechsdk.SpeechConfig(subscription=_azure_key(), region=_azure_region())
    locale = {"en": "en-US", "zh": "zh-CN"}.get((language or "en").lower(), "en-US")
    speech_config.speech_recognition_language = locale
    audio_config = speechsdk.audio.AudioConfig(filename=str(audio_path))
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    result = recognizer.recognize_once()
    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        return result.text.strip()
    if result.reason == speechsdk.ResultReason.Canceled:
        detail = speechsdk.CancellationDetails(result)
        raise RuntimeError(f"{detail.reason}: {detail.error_details}")
    return ""


# Engines that decode compressed audio (mp3) themselves; the rest need a PCM wav.
_NEEDS_WAV = {"vosk", "azure"}


def transcribe(engine: str, audio_path: Path, language: Optional[str] = None) -> str:
    if engine == "faster-whisper":
        return _transcribe_faster_whisper(audio_path, language)
    if engine == "whisper":
        return _transcribe_whisper(audio_path, language)
    if engine == "vosk":
        return _transcribe_vosk(audio_path, language)
    if engine == "azure":
        return _transcribe_azure(audio_path, language)
    raise ValueError(f"unknown STT engine: {engine}")


def _make_sample_clip(language: str, want_wav: bool) -> Optional[Path]:
    """Synthesize the known phrase with the TTS orchestrator (offline-first) so the
    STT test has audio to recognize. Returns an mp3, or a 16k PCM wav when an engine
    needs one (vosk/azure) — converted from a local sherpa render via stdlib wave."""
    tmp_dir = Path(tempfile.gettempdir()) / "pycore_stt_test"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    if want_wav:
        # Render raw samples with the offline sherpa engine and write a PCM wav
        # directly — no ffmpeg, and the exact format vosk/azure expect.
        try:
            from pycore.pyutils.tts import sherpa_engine
            from pycore.pyfoundations.third_party import get_third_package_sherpa_onnx
            if not sherpa_engine.available() or get_third_package_sherpa_onnx() is None:
                return None
            tts = sherpa_engine._get_tts()  # noqa: SLF001 — reuse the loaded model
            if tts is None:
                return None
            audio = tts.generate(_SAMPLE_PHRASE, 0, speed=1.0)
            samples = getattr(audio, "samples", None)
            sample_rate = int(getattr(audio, "sample_rate", 22050))
            if samples is None:
                return None
            import array
            ints = array.array("h", (max(-32768, min(32767, int(s * 32767))) for s in samples))
            wav_path = tmp_dir / "sample.wav"
            with wave.open(str(wav_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(ints.tobytes())
            return wav_path
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[stt] could not build wav sample: {e}")
            return None
    # mp3 path: any TTS engine works; whisper/faster-whisper decode mp3 themselves.
    try:
        from pycore.pyutils.tts import synthesize as tts_synth
        mp3_path = tmp_dir / "sample.mp3"
        res = tts_synth(_SAMPLE_PHRASE, language, mp3_path)
        if res.get("success") and mp3_path.exists() and mp3_path.stat().st_size > 0:
            return mp3_path
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[stt] could not build mp3 sample: {e}")
    return None


def stt_test(engine: Optional[str] = None, language: str = "en") -> Dict[str, Any]:
    """Live round-trip test: synth the known phrase, recognize it with ``engine``
    (or the best available), return {success, engine, text, latency_ms, error}."""
    name = engine or best_engine()
    if not name:
        return {"success": False, "engine": None, "text": "", "latency_ms": 0, "error": "no STT engine available"}
    if not engine_available(name):
        return {"success": False, "engine": name, "text": "", "latency_ms": 0, "error": f"{name} unavailable"}

    sample = _make_sample_clip(language, want_wav=(name in _NEEDS_WAV))
    if sample is None:
        return {"success": False, "engine": name, "text": "", "latency_ms": 0,
                "error": "could not produce a sample clip (offline TTS needed to generate test audio)"}

    t0 = time.monotonic()
    try:
        text = transcribe(name, sample, language)
    except Exception as e:  # noqa: BLE001
        return {"success": False, "engine": name, "text": "", "latency_ms": round((time.monotonic() - t0) * 1000),
                "path": str(sample), "language": language, "error": f"{e}"}
    latency = round((time.monotonic() - t0) * 1000)
    ok = bool((text or "").strip())
    return {"success": ok, "engine": name, "text": text, "latency_ms": latency,
            # The sample clip that was recognized (for the caller to persist).
            "path": str(sample), "language": language,
            "error": None if ok else "engine returned empty text"}


__all__ = [
    "STT_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "stt_status",
    "transcribe",
    "stt_test",
]
