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

Cross-domain round-trip testing lives in ``pycore.pyctl.stt.test_service``;
this module owns STT availability, recognition, and model lifecycle only.
"""

import importlib.metadata
import importlib.util
import os
import time
import wave
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.managed_service import ServiceSpec, managed_services
from pycore.pyutils.common.managed_service_facade import (
    ManagedServiceFacade,
    managed_model_load_context,
)
from pycore.pyutils.common.engine_registry import (
    EngineAdapter,
    EngineRegistry,
    parse_engine_priority,
)
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.third_party.api import (
    get_third_package_faster_whisper,
    get_third_package_speechsdk,
    get_third_package_vosk,
    get_third_package_whisper,
)
from pycore.pyfoundations.api_secrets import azure_speech_key, azure_speech_region
from pycore.pyutils.common.model_tiers import (
    runtime_faster_whisper_compute_type,
    runtime_faster_whisper_device,
    runtime_faster_whisper_model,
    runtime_whisper_model,
)
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_STT_KEY,
    status_snapshot_cache,
)

import json as _json

from pycore.pyutils.common.azure_speech_quota_state import is_stt_quota_blocked
from pycore.pyfoundations.system_paths import APP_CACHE_DIR




class STTEngineAdapter(EngineAdapter):
    def __init__(
        self,
        name: str,
        note: str,
        availability_probe: Callable[[], bool],
        *,
        distribution: Optional[str] = None,
        managed_kind: Optional[str] = None,
    ) -> None:
        super().__init__(name, managed_kind=managed_kind)
        self.note = str(note or "")
        self.distribution = distribution
        self._availability_probe = availability_probe

    def available(self) -> bool:
        return bool(self._availability_probe())


class STTEngineRegistry(EngineRegistry[STTEngineAdapter]):
    pass


_STT_ENGINE_ADAPTERS = (
    STTEngineAdapter(
        "faster-whisper",
        "Faster-Whisper (CTranslate2; GPU large-v3 / CPU medium)",
        lambda: _faster_whisper_available(),
        distribution="faster-whisper",
        managed_kind="model",
    ),
    STTEngineAdapter(
        "whisper",
        "OpenAI Whisper (offline; GPU large-v3 / CPU medium)",
        lambda: _whisper_available(),
        distribution="openai-whisper",
        managed_kind="model",
    ),
    STTEngineAdapter(
        "vosk",
        "Vosk offline ASR (lightweight; needs a model dir)",
        lambda: _vosk_available(),
        distribution="vosk",
        managed_kind="model",
    ),
    STTEngineAdapter(
        "azure",
        "Azure Speech cloud STT (free F0 ~0.5M chars/mo; API fallback)",
        lambda: _azure_available(),
    ),
)
stt_engine_registry = STTEngineRegistry(_STT_ENGINE_ADAPTERS)
_STT_SERVICE_FACADE = ManagedServiceFacade("stt", "model_", idle_default=60)


def default_stt_engine_priority() -> tuple[str, ...]:
    """Canonical default chain (shared by capability settings)."""
    return stt_engine_registry.names()


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None


def _priority() -> tuple[str, ...]:
    raw = (os.environ.get("STT_ENGINE_PRIORITY") or "").strip()
    requested = parse_engine_priority(raw) if raw else None
    return stt_engine_registry.merge_priority(requested)


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
    return importlib.util.find_spec("whisper") is not None


def _vosk_available() -> bool:
    # Vosk needs both the package AND a model dir (env VOSK_MODEL_DIR or a default
    # cache). Without a model it cannot recognize, so report it unavailable.
    if importlib.util.find_spec("vosk") is None:
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
    adapter = stt_engine_registry.get(name)
    return bool(adapter and adapter.available())


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


def _build_stt_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no recognition run)."""
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        adapter = stt_engine_registry.get(name)
        if adapter is None:
            continue
        avail = adapter.available()
        entry: Dict[str, Any] = {
            "name": name,
            "priority": i + 1,
            "available": avail,
            "note": adapter.note,
        }
        if adapter.distribution and avail:
            entry["version"] = _dist_version(adapter.distribution)
        if name == "faster-whisper" and avail:
            entry["model"] = runtime_faster_whisper_model()
        if name == "whisper" and avail:
            entry["model"] = runtime_whisper_model()
        quota = _quota(name)
        if quota is not None:
            entry["quota"] = quota
        runtime = _STT_SERVICE_FACADE.runtime_status(name)
        if runtime:
            entry["model_loaded"] = bool(runtime.get("model_loaded"))
            entry["model_idle_remaining_s"] = runtime.get("model_idle_remaining_s")
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


def stt_status() -> Dict[str, Any]:
    """Return the shared cached STT availability snapshot."""
    return status_snapshot_cache.get(STATUS_SNAPSHOT_STT_KEY, _build_stt_status)


# --- transcription --------------------------------------------------------- #

def _transcribe_faster_whisper(audio_path: Path, language: Optional[str],
                                model_override: Optional[str] = None) -> str:
    model_name = model_override or runtime_faster_whisper_model()
    device = runtime_faster_whisper_device()
    compute = runtime_faster_whisper_compute_type(device)
    cache_key = ("faster-whisper", model_name, device, compute)
    model = _model_cache.get(cache_key)
    if model is None:
        faster_whisper = get_third_package_faster_whisper()
        if faster_whisper is None:
            raise RuntimeError("faster-whisper is unavailable")
        model = faster_whisper.WhisperModel(
            model_name,
            device=device,
            compute_type=compute,
        )
        _model_cache[cache_key] = model
        THREAD_BUS.signal(f'{_MODEL_LOADED_PREFIX}.faster-whisper', True)
    segments, _info = model.transcribe(str(audio_path), language=language)
    return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe_whisper(audio_path: Path, language: Optional[str],
                         model_override: Optional[str] = None) -> str:
    whisper = get_third_package_whisper()
    if whisper is None:
        raise RuntimeError("openai-whisper is unavailable")
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
    if vosk is None:
        raise RuntimeError("vosk is unavailable")
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
    speechsdk = get_third_package_speechsdk()
    if speechsdk is None:
        raise RuntimeError("Azure Speech SDK is unavailable")
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


def _transcribe(engine: str, audio_path: Path, language: Optional[str] = None,
                model: Optional[str] = None) -> str:
    # Busy-protected managed lifecycle: STT models load in parallel (no eviction);
    # each idle-unloads after 60s. azure is an API engine (unregistered) ->
    # `lease` is a no-op for it.
    model_device = runtime_faster_whisper_device() if engine == "faster-whisper" else ""
    with managed_services.lease(engine), managed_model_load_context(engine, model_device):
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
    for adapter in stt_engine_registry.values("model"):
        engine = adapter.name
        _STT_SERVICE_FACADE.register(ServiceSpec(
            name=engine,
            category="stt",
            kind="model",
            installed=adapter.available,
            unload=lambda engine=engine: unload_model(engine),
            is_loaded=lambda engine=engine: is_model_loaded(engine),
        ))


_register_stt_services()


__all__ = [
    "STTEngineAdapter",
    "STTEngineRegistry",
    "STT_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "stt_status",
    "transcribe",
    "is_model_loaded",
    "unload_model",
    "stt_engine_registry",
]
