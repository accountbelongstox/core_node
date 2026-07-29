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

import contextlib
import importlib.metadata
import importlib.util
import os
import tempfile
import time
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.managed_service import CategorySettings, ServiceSpec, managed_services
import pycore.pyutils.common.model_load_status as model_load_status
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.third_party.api import get_third_package_vosk, get_third_package_whisper
from pycore.pyutils.common.api_secrets import azure_speech_key, azure_speech_region
from pycore.pyutils.common.model_tiers import (
    runtime_faster_whisper_compute_type,
    runtime_faster_whisper_device,
    runtime_faster_whisper_model,
    runtime_whisper_model,
)

import json as _json

from pycore.pyutils.azure_speech.quota_state import is_stt_quota_blocked
from pycore.pyfoundations.system_paths import APP_CACHE_DIR
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
from pycore.pyfoundations.third_party.api import get_third_package_sherpa_onnx
from pycore.pyutils.tts.tts_orchestrator import synthesize as tts_synth

import array




_DEFAULT_PRIORITY = ("faster-whisper", "whisper", "vosk", "azure")
_KNOWN_ENGINES = _DEFAULT_PRIORITY
_SAMPLE_PHRASE = "the quick brown fox jumps over the lazy dog"
_ENGINE_NOTES = {
    "faster-whisper": "Faster-Whisper (CTranslate2; GPU large-v3 / CPU medium)",
    "whisper": "OpenAI Whisper (offline; GPU large-v3 / CPU medium)",
    "vosk": "Vosk offline ASR (lightweight; needs a model dir)",
    "azure": "Azure Speech cloud STT (free F0 ~0.5M chars/mo; API fallback)",
}

_ENGINE_VERSIONS = {
    "faster-whisper": "faster-whisper",
    "whisper": "openai-whisper",
    "vosk": "vosk",
}


def default_stt_engine_priority() -> tuple[str, ...]:
    """Canonical default chain (shared by capability settings)."""
    return _KNOWN_ENGINES


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None


def _priority() -> tuple[str, ...]:
    raw = (os.environ.get("STT_ENGINE_PRIORITY") or "").strip()
    if not raw:
        return _DEFAULT_PRIORITY
    parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
    return tuple(parts) if parts else _DEFAULT_PRIORITY


# Cache loaded local models so repeat tests don't reload weights every click.
_model_cache: Dict[str, Any] = {}
_MODEL_QUEUE = 'pyutils.stt.orchestrator.model'
_MODEL_LOADED_PREFIX = 'pyutils.stt.orchestrator.loaded'
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, 'STTModelThread')
_MODEL_WORKER.start()


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
        return is_stt_quota_blocked()
    except Exception:
        return (False, None)


def _vosk_model_dir() -> Optional[Path]:
    env = (os.environ.get("VOSK_MODEL_DIR") or "").strip()
    candidates = []
    if env:
        candidates.append(Path(env))
    try:
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
        avail = engine_available(name)
        entry: Dict[str, Any] = {
            "name": name,
            "priority": i + 1,
            "available": avail,
            "note": _ENGINE_NOTES.get(name, ""),
        }
        dist = _ENGINE_VERSIONS.get(name)
        if dist and avail:
            entry["version"] = _dist_version(dist)
        if name == "faster-whisper" and avail:
            entry["model"] = runtime_faster_whisper_model()
        if name == "whisper" and avail:
            entry["model"] = runtime_whisper_model()
        quota = _quota(name)
        if quota is not None:
            entry["quota"] = quota
        if name in ("faster-whisper", "whisper", "vosk") and managed_services.is_registered(name):
            rt = managed_services.runtime_status(name)
            entry["model_loaded"] = bool(rt.get("running"))
            entry["model_idle_remaining_s"] = rt.get("idle_remaining_s")
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

def _transcribe_faster_whisper(audio_path: Path, language: Optional[str],
                                model_override: Optional[str] = None) -> str:
    model_name = model_override or runtime_faster_whisper_model()
    device = runtime_faster_whisper_device()
    compute = runtime_faster_whisper_compute_type(device)
    cache_key = ("faster-whisper", model_name, device, compute)
    model = _model_cache.get(cache_key)
    if model is None:
        model = WhisperModel(model_name, device=device, compute_type=compute)
        _model_cache[cache_key] = model
        THREAD_BUS.signal(f'{_MODEL_LOADED_PREFIX}.faster-whisper', True)
    segments, _info = model.transcribe(str(audio_path), language=language)
    return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe_whisper(audio_path: Path, language: Optional[str],
                         model_override: Optional[str] = None) -> str:
    whisper = get_third_package_whisper()
    model_name = model_override or runtime_whisper_model()
    cache_key = ("whisper", model_name)
    model = _model_cache.get(cache_key)
    if model is None:
        model = whisper.load_model(model_name)
        _model_cache[cache_key] = model
        THREAD_BUS.signal(f'{_MODEL_LOADED_PREFIX}.whisper', True)
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
        THREAD_BUS.signal(f'{_MODEL_LOADED_PREFIX}.vosk', True)
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


def _model_load_ctx(engine: str):
    """Report FIRST-load progress for a class-B in-process STT model to the shared
    model-load registry (surfaced at /api/local/engines/load-status). azure is an
    API engine (unregistered) and loads no model, so it is a no-op — the registry
    is written from ONE place per engine. ``managed_services.is_running`` on a model
    spec reflects the engine's own ``is_model_loaded`` (resident weights)."""
    spec = managed_services.spec(engine)
    if spec is None or spec.kind != "model":
        return contextlib.nullcontext()
    device = runtime_faster_whisper_device() if engine == "faster-whisper" else ""
    return model_load_status.report_model_load(
        engine, is_loaded=lambda: managed_services.is_running(engine), device=device
    )


def _transcribe(engine: str, audio_path: Path, language: Optional[str] = None,
                model: Optional[str] = None) -> str:
    # Busy-protected managed lifecycle: STT models load in parallel (no eviction);
    # each idle-unloads after 60s. azure is an API engine (unregistered) ->
    # `using` is a no-op for it.
    with managed_services.using(engine), _model_load_ctx(engine):
        if engine == "faster-whisper":
            return _transcribe_faster_whisper(audio_path, language, model_override=model)
        if engine == "whisper":
            return _transcribe_whisper(audio_path, language, model_override=model)
        if engine == "vosk":
            return _transcribe_vosk(audio_path, language)
        if engine == "azure":
            return _transcribe_azure(audio_path, language)
        raise ValueError(f"unknown STT engine: {engine}")


def transcribe(engine: str, audio_path: Path, language: Optional[str] = None,
               model: Optional[str] = None) -> str:
    """Transcribe through the single model-owner thread."""
    return call_serialized(
        _MODEL_QUEUE,
        _transcribe,
        engine,
        audio_path,
        language,
        model,
        timeout=900.0,
    )


def _make_sample_clip(language: str, want_wav: bool, phrase: str = _SAMPLE_PHRASE) -> Optional[Path]:
    """Synthesize the known phrase with the TTS orchestrator (offline-first) so the
    STT test has audio to recognize. Returns an mp3, or a 16k PCM wav when an engine
    needs one (vosk/azure) — converted from a local sherpa render via stdlib wave."""
    tmp_dir = Path(tempfile.gettempdir()) / "pycore_stt_test"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    if want_wav:
        # Render raw samples with the offline sherpa engine and write a PCM wav
        # directly — no ffmpeg, and the exact format vosk/azure expect.
        try:
            if not sherpa_engine.available() or get_third_package_sherpa_onnx() is None:
                return None
            tts = sherpa_engine._get_tts()  # noqa: SLF001 — reuse the loaded model
            if tts is None:
                return None
            audio = tts.generate(phrase, 0, speed=1.0)
            samples = getattr(audio, "samples", None)
            sample_rate = int(getattr(audio, "sample_rate", 22050))
            if samples is None:
                return None
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
        mp3_path = tmp_dir / "sample.mp3"
        res = tts_synth(phrase, language, mp3_path)
        if res.get("success") and mp3_path.exists() and mp3_path.stat().st_size > 0:
            return mp3_path
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[stt] could not build mp3 sample: {e}")
    return None


def stt_test(engine: Optional[str] = None, language: str = "en",
             text: Optional[str] = None,
             # Per-engine extra params.
             model: Optional[str] = None,
             **extra_params: Any) -> Dict[str, Any]:
    """Live round-trip test: synth ``text`` (or the default sample phrase),
    recognize it with ``engine`` (or the best available), return
    {success, engine, text, latency_ms, error}. The synthesized phrase is
    echoed back as ``phrase`` so the caller knows what was recognized.

    Per-engine params:
    - model (faster-whisper / whisper): override the default model name."""
    name = engine or best_engine()
    if not name:
        return {"success": False, "engine": None, "text": "", "latency_ms": 0,
                "route": "local.stt.test", "error": "no STT engine available"}
    if not engine_available(name):
        return {"success": False, "engine": name, "text": "", "latency_ms": 0,
                "route": "local.stt.test", "error": f"{name} unavailable"}

    phrase = (text or "").strip() or _SAMPLE_PHRASE
    sample = _make_sample_clip(language, want_wav=(name in _NEEDS_WAV), phrase=phrase)
    if sample is None:
        return {"success": False, "engine": name, "text": "", "latency_ms": 0,
                "route": "local.stt.test",
                "error": "could not produce a sample clip (offline TTS needed to generate test audio)"}

    t0 = time.monotonic()
    try:
        recognized = transcribe(name, sample, language, model=model)
    except Exception as e:  # noqa: BLE001
        return {"success": False, "engine": name, "text": "", "latency_ms": round((time.monotonic() - t0) * 1000),
                "route": "local.stt.test",
                "phrase": phrase, "path": str(sample), "language": language, "error": f"{e}"}
    latency = round((time.monotonic() - t0) * 1000)
    ok = bool((recognized or "").strip())
    result: Dict[str, Any] = {"success": ok, "engine": name, "text": recognized, "latency_ms": latency,
            "route": "local.stt.test",
            "phrase": phrase, "path": str(sample), "language": language,
            "error": None if ok else "engine returned empty text"}
    if model:
        result["model"] = model
    return result


def _is_model_loaded(engine: str) -> bool:
    """True when a local STT model for `engine` is resident in memory."""
    if engine in ("faster-whisper", "whisper"):
        return any(isinstance(k, tuple) and k and k[0] == engine for k in _model_cache)
    if engine == "vosk":
        return "vosk" in _model_cache
    return False


def _unload_model(engine: str) -> None:
    """Drop cached STT model(s) for `engine` so their memory can be freed. The
    managed-service layer releases the GPU cache afterwards and only calls this
    when no transcription is in flight (busy protection)."""
    if engine in ("faster-whisper", "whisper"):
        for key in list(_model_cache):
            if isinstance(key, tuple) and key and key[0] == engine:
                _model_cache.pop(key, None)
    elif engine == "vosk":
        _model_cache.pop("vosk", None)


def is_model_loaded(engine: str) -> bool:
    """Read model residency from the model-owner signal."""
    return bool(THREAD_BUS.get_signal(f'{_MODEL_LOADED_PREFIX}.{engine}', False))


def unload_model(engine: str) -> None:
    """Unload a model through the model-owner thread."""
    call_serialized(_MODEL_QUEUE, _unload_model, engine)
    THREAD_BUS.signal(f'{_MODEL_LOADED_PREFIX}.{engine}', False)


def _register_stt_services() -> None:
    """Register the local STT models with the unified managed-service manager
    (category "stt", parallel models, 60s idle unload). azure is an API engine and
    is NOT registered."""
    managed_services.register_category("stt", CategorySettings("stt", "model_", idle_default=60))
    for engine in ("faster-whisper", "whisper", "vosk"):
        managed_services.register(ServiceSpec(
            name=engine,
            category="stt",
            kind="model",
            installed=lambda e=engine: engine_available(e),
            unload=lambda e=engine: unload_model(e),
            is_loaded=lambda e=engine: is_model_loaded(e),
        ))


_register_stt_services()


__all__ = [
    "STT_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "stt_status",
    "transcribe",
    "stt_test",
    "is_model_loaded",
    "unload_model",
]
