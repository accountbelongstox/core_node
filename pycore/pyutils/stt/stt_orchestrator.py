# -*- coding: utf-8 -*-
"""
STT orchestrator: the one place that reports which speech-to-text engines are
available and transcribes through them. Status uses the shared engine panel
shape ({success, best, active, available_count, engines:[...]}).

Default priority is the manifest declaration order (stt_manifest); override it
with env ``STT_ENGINE_PRIORITY`` (e.g. ``whisper->vosk``). Azure Speech is the
only engine with a quota.

Cross-domain round-trip testing lives in ``pycore.pyctl.stt.probe_service``.
"""

import json
import os
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.api_secrets import azure_speech_key, azure_speech_region
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.third_party.api import get_third_package_vosk
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.azure_speech_quota_state import is_stt_quota_blocked
from pycore.pyutils.common.coded_message import CodedMessage, message_fields
from pycore.pyutils.common.engine_registry import (
    EngineAdapter,
    EngineRegistry,
    parse_engine_priority,
)
from pycore.pyutils.common.managed_service import ServiceSpec, managed_services
from pycore.pyutils.common.managed_service_facade import (
    ManagedServiceFacade,
    managed_model_load_context,
)
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_checks import module_present, packages_check
from pycore.pyutils.common.model_manifest import (
    BOOT_READY,
    CATEGORY_STT,
    BootVerdict,
    blocked,
    ready,
)
from pycore.pyutils.common.model_reasons import (
    MODEL_REASON_INSTALL_REQUIRED,
    MODEL_REASON_PACKAGE_MISSING,
    MODEL_REASON_SECRET_MISSING,
    model_reason,
)
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
from pycore.pyutils.common.whisper_models import (
    ENGINE_FASTER_WHISPER,
    ENGINE_WHISPER,
    weights_present,
    whisper_models,
)
from pycore.pyutils.stt.azure_provider import azure_stt_provider
import pycore.pyutils.stt.stt_manifest as stt_manifest

_MODEL_QUEUE = "pyutils.stt.orchestrator.model"
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, "STTModelThread")
_MODEL_WORKER.start()
_VOSK_LOADED_SIGNAL = "pyutils.stt.orchestrator.loaded.vosk"
_AZURE_LOCALES = {"en": "en-US", "zh": "zh-CN"}
_AZURE_SECRETS = "AZURE_SPEECH_KEY, AZURE_SPEECH_REGION"
_TRANSCRIBE_TIMEOUT_S = 900.0

stt_service_facade = ManagedServiceFacade("stt", "model_", idle_default=60)


class STTEngine(EngineAdapter):
    """One speech-to-text engine. ``needs_wav`` engines only read PCM WAV."""

    needs_wav = False

    def __init__(self, name: str) -> None:
        super().__init__(name, CATEGORY_STT)

    def install_reason(self, item: str) -> CodedMessage:
        """Coded reason naming the shell step that installs ``item``."""
        return model_reason(
            MODEL_REASON_INSTALL_REQUIRED, model=self.name, item=item, installer=self.entry.installer,
        )

    def missing_reason(self) -> Optional[CodedMessage]:
        """Why the engine cannot run (package, weights); None when installed."""
        module, package = self.entry.pip
        if not module_present(module):
            return self.install_reason(f"{package} package")
        return None

    def probe(self) -> bool:
        return self.missing_reason() is None

    def boot_check(self) -> BootVerdict:
        module, package = self.entry.pip
        verdict = packages_check(
            (module,), model_reason(MODEL_REASON_PACKAGE_MISSING, package=package),
        )
        if verdict.state != BOOT_READY:
            return verdict
        reason = self.missing_reason()
        return blocked(reason) if reason else ready()

    def model_name(self) -> Optional[str]:
        return None

    def transcribe(self, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
        raise NotImplementedError

    def is_model_loaded(self) -> bool:
        return False

    def unload_model(self) -> None:
        return None

    def status_row(self, available: bool) -> Dict[str, Any]:
        row = super().status_row(available)
        model = self.model_name()
        if model and available:
            row["model"] = model
        if not available:
            row.update(message_fields(self.boot_reason() or self.missing_reason(), "disabled_reason"))
        runtime = stt_service_facade.runtime_status(self.name)
        if runtime:
            row["model_loaded"] = bool(runtime.get("model_loaded"))
            row["model_idle_remaining_s"] = runtime.get("model_idle_remaining_s")
        return row


class WhisperWeightsEngine(STTEngine):
    """A Whisper engine whose weights the shell installer places."""

    weights_engine = ""

    def missing_reason(self) -> Optional[CodedMessage]:
        reason = super().missing_reason()
        if reason is None and not weights_present(self.weights_engine, self.model_name()):
            return self.install_reason(f"{self.model_name()} weights")
        return reason

    def require_weights(self, model: Optional[str]) -> str:
        name = model or self.model_name()
        if not weights_present(self.weights_engine, name):
            raise RuntimeError(str(self.install_reason(f"{name} weights")))
        return name


class FasterWhisperEngine(WhisperWeightsEngine):
    weights_engine = ENGINE_FASTER_WHISPER

    def model_name(self) -> Optional[str]:
        return runtime_faster_whisper_model()

    def transcribe(self, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
        device = runtime_faster_whisper_device()
        loaded = whisper_models.faster_whisper(
            self.require_weights(model),
            device,
            runtime_faster_whisper_compute_type(device),
        )
        if loaded is None:
            raise RuntimeError("faster-whisper is unavailable")
        segments, _info = loaded.transcribe(str(audio_path), language=language)
        return " ".join(segment.text.strip() for segment in segments).strip()

    def is_model_loaded(self) -> bool:
        return whisper_models.is_loaded(ENGINE_FASTER_WHISPER)

    def unload_model(self) -> None:
        whisper_models.unload(ENGINE_FASTER_WHISPER)


class WhisperEngine(WhisperWeightsEngine):
    weights_engine = ENGINE_WHISPER

    def model_name(self) -> Optional[str]:
        return runtime_whisper_model()

    def transcribe(self, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
        loaded = whisper_models.whisper(self.require_weights(model))
        if loaded is None:
            raise RuntimeError("openai-whisper is unavailable")
        result = loaded.transcribe(str(audio_path), language=language, fp16=False)
        return str(result.get("text", "")).strip()

    def is_model_loaded(self) -> bool:
        return whisper_models.is_loaded(ENGINE_WHISPER)

    def unload_model(self) -> None:
        whisper_models.unload(ENGINE_WHISPER)


class VoskEngine(STTEngine):
    needs_wav = True

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._model: Any = None

    @staticmethod
    def model_dir() -> Optional[Path]:
        """Vosk model dir: env VOSK_MODEL_DIR, else <shared cache>/stt/vosk; a model dir has a conf/ subdir."""
        configured = (os.environ.get("VOSK_MODEL_DIR") or "").strip()
        candidates = [Path(configured)] if configured else []
        candidates.append(get_shared_download_cache_dir() / "stt" / "vosk")
        for candidate in candidates:
            if not candidate.is_dir():
                continue
            if (candidate / "conf").is_dir():
                return candidate
            nested = sorted(candidate.glob("*/conf"))
            if nested:
                return nested[0].parent
        return None

    def missing_reason(self) -> Optional[CodedMessage]:
        reason = super().missing_reason()
        if reason is None and self.model_dir() is None:
            return self.install_reason("model dir (VOSK_MODEL_DIR)")
        return reason

    def transcribe(self, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
        vosk = get_third_package_vosk() if module_present("vosk") else None
        model_dir = self.model_dir()
        if vosk is None or model_dir is None:
            raise RuntimeError("vosk or its model dir (VOSK_MODEL_DIR) is unavailable")
        if self._model is None:
            self._model = vosk.Model(str(model_dir))
            THREAD_BUS.signal(_VOSK_LOADED_SIGNAL, True)
        text_parts: List[str] = []
        with wave.open(str(audio_path), "rb") as wav_file:
            recognizer = vosk.KaldiRecognizer(self._model, wav_file.getframerate())
            recognizer.SetWords(False)
            while True:
                data = wav_file.readframes(4000)
                if not data:
                    break
                if recognizer.AcceptWaveform(data):
                    text_parts.append(json.loads(recognizer.Result()).get("text", ""))
            text_parts.append(json.loads(recognizer.FinalResult()).get("text", ""))
        return " ".join(part for part in text_parts if part).strip()

    def is_model_loaded(self) -> bool:
        return bool(THREAD_BUS.get_signal(_VOSK_LOADED_SIGNAL, False))

    def unload_model(self) -> None:
        self._model = None
        THREAD_BUS.signal(_VOSK_LOADED_SIGNAL, False)


class AzureEngine(STTEngine):
    needs_wav = True
    _MODULE = "azure.cognitiveservices.speech"
    _PACKAGE = "azure-cognitiveservices-speech"

    @staticmethod
    def quota_blocked() -> Tuple[bool, Optional[str]]:
        try:
            return is_stt_quota_blocked()
        except Exception as exc:  # noqa: BLE001 - quota state read; unknown means not blocked
            ColorPrint.yellow(f"[stt] azure quota state read failed: {exc}")
            return (False, None)

    def missing_reason(self) -> Optional[CodedMessage]:
        if not module_present(self._MODULE):
            return model_reason(MODEL_REASON_PACKAGE_MISSING, package=self._PACKAGE)
        if not (azure_speech_key() and azure_speech_region()):
            return model_reason(MODEL_REASON_SECRET_MISSING, secrets=_AZURE_SECRETS)
        return None

    def probe(self) -> bool:
        return self.missing_reason() is None and not self.quota_blocked()[0]

    def boot_check(self) -> BootVerdict:
        package = packages_check(
            (self._MODULE,), model_reason(MODEL_REASON_PACKAGE_MISSING, package=self._PACKAGE),
        )
        if package.state != BOOT_READY:
            return package
        if not (azure_speech_key() and azure_speech_region()):
            return blocked(model_reason(MODEL_REASON_SECRET_MISSING, secrets=_AZURE_SECRETS))
        return ready()

    def transcribe(self, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
        locale = _AZURE_LOCALES.get((language or "en").lower(), "en-US")
        result = azure_stt_provider.recognize_from_file(Path(audio_path), locale)
        if result.get("success"):
            return str(result.get("text") or "").strip()
        if result.get("canceled"):
            raise RuntimeError(str(result.get("error") or "azure recognition canceled"))
        return ""

    def status_row(self, available: bool) -> Dict[str, Any]:
        row = super().status_row(available)
        quota_blocked, error = self.quota_blocked()
        row["quota"] = {
            "kind": "free-tier",
            "note": "Azure Speech free F0 ~0.5M chars/mo",
            "blocked": bool(quota_blocked),
            "error": error,
        }
        return row


class STTEngineRegistry(EngineRegistry[STTEngine]):
    def priority(self) -> Tuple[str, ...]:
        raw = (os.environ.get("STT_ENGINE_PRIORITY") or "").strip()
        return self.merge_priority(parse_engine_priority(raw) if raw else None)


_ENGINE_CLASSES = {
    "faster-whisper": FasterWhisperEngine,
    "whisper": WhisperEngine,
    "vosk": VoskEngine,
    "azure": AzureEngine,
}
stt_engine_registry = STTEngineRegistry(
    _ENGINE_CLASSES[entry.id](entry.id) for entry in stt_manifest.STT_ENTRIES
)


def stt_status() -> Dict[str, Any]:
    """Return the shared cached STT availability panel."""
    return status_snapshot_cache.get(STATUS_SNAPSHOT_STT_KEY, stt_engine_registry.panel)


def _transcribe(engine: str, audio_path: Path, language: Optional[str], model: Optional[str]) -> str:
    adapter = stt_engine_registry.get(engine)
    if adapter is None:
        raise ValueError(f"unknown STT engine: {engine}")
    if adapter.boot_blocked():
        raise RuntimeError(f"{engine} is blocked: {adapter.boot_reason()}")
    model_device = runtime_faster_whisper_device() if isinstance(adapter, FasterWhisperEngine) else ""
    with managed_services.lease(adapter.name), managed_model_load_context(adapter.name, model_device):
        return adapter.transcribe(Path(audio_path), language, model)


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
        timeout=_TRANSCRIBE_TIMEOUT_S,
    )


def _unload_model(engine: str) -> None:
    adapter = stt_engine_registry.get(engine)
    if adapter is not None:
        adapter.unload_model()


def unload_model(engine: str) -> None:
    """Unload a model through the model-owner thread (busy protection is the
    managed-service layer's job)."""
    call_serialized(_MODEL_QUEUE, _unload_model, engine)


for _adapter in stt_engine_registry.values("model"):
    stt_service_facade.register(ServiceSpec(
        name=_adapter.name,
        category="stt",
        kind="model",
        installed=_adapter.available,
        unload=lambda engine=_adapter.name: unload_model(engine),
        is_loaded=_adapter.is_model_loaded,
    ))

model_boot.register_checks(CATEGORY_STT, tuple(
    (adapter.name, adapter.boot_check) for adapter in stt_engine_registry.values()
))


__all__ = [
    "STTEngine",
    "STTEngineRegistry",
    "stt_engine_registry",
    "stt_service_facade",
    "stt_status",
    "transcribe",
    "unload_model",
]
