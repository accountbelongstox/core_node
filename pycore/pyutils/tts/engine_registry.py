# -*- coding: utf-8 -*-

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, Tuple

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.engine_registry import EngineAdapter, EngineRegistry
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import CATEGORY_TTS, model_manifest
import pycore.pyutils.common.hf_local_weights as hf_local_weights
from pycore.pyutils.tts.edge.client import edge_tts_client
from pycore.pyutils.tts.edge.config import TTSConfig
import pycore.pyutils.tts.azure_engine as azure_engine
import pycore.pyutils.tts.bark_engine as bark_engine
import pycore.pyutils.tts.chattts_engine as chattts_engine
import pycore.pyutils.tts.cosyvoice_engine as cosyvoice_engine
import pycore.pyutils.tts.f5tts_engine as f5tts_engine
import pycore.pyutils.tts.fishspeech_engine as fishspeech_engine
import pycore.pyutils.tts.gptsovits_engine as gptsovits_engine
import pycore.pyutils.tts.gtts_web_engine as gtts_web_engine
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
import pycore.pyutils.tts.melotts_engine as melotts_engine
import pycore.pyutils.tts.parler_engine as parler_engine
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
import pycore.pyutils.tts.streamelements_engine as streamelements_engine
import pycore.pyutils.tts.tts_manifest  # noqa: F401
import pycore.pyutils.tts.voxcpm2_engine as voxcpm2_engine


_CHATTTS_MODEL_MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "tts_install_assets"
    / "chattts_model_files.txt"
)
_CHATTTS_REQUIRED_MODEL_FILES = hf_local_weights.load_required_file_manifest(
    _CHATTTS_MODEL_MANIFEST
)


def _chattts_staging_dir() -> Path:
    return hf_local_weights.staging_dir("CHATTTS_DIR", "chattts")


def _chattts_model_dir() -> Path:
    return hf_local_weights.configured_weights_dir(
        "CHATTTS_MODEL_DIR",
        _chattts_staging_dir(),
    )


def _chattts_model_ready() -> bool:
    return hf_local_weights.installed_model_files_ready(
        _chattts_staging_dir(),
        _chattts_model_dir(),
        _CHATTTS_REQUIRED_MODEL_FILES,
    )


@dataclass(frozen=True)
class TTSSynthesisRequest:
    text: str
    language: str
    output_path: Path
    speed: float = 1.0
    locale: str = ""
    rate: Optional[str] = None
    accent: Optional[str] = None
    gender: Optional[str] = None
    speaker: Optional[str] = None
    instruct: Optional[str] = None
    client_job_id: Optional[str] = None
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None


class TTSEngineAdapter(EngineAdapter):
    def __init__(
        self,
        name: str,
        module: Any,
        *,
        availability_signal: Optional[str] = None,
        config_ready: Optional[Callable[[], bool]] = None,
        health_probe: Optional[Callable[[], bool]] = None,
        service_probe: Optional[Callable[[], Optional[Dict[str, Any]]]] = None,
        ready_without_process: Optional[Callable[[], bool]] = None,
        model_dir: Optional[Callable[[], Path]] = None,
    ) -> None:
        entry = model_manifest.get(name, CATEGORY_TTS)
        if entry is None:
            raise ValueError(f"TTS engine missing from the model manifest: {name}")
        super().__init__(name, managed_kind=entry.managed_kind)
        self.entry = entry
        self.module = module
        self.health_paths = entry.health_paths
        self.availability_signal = availability_signal
        self._config_ready = config_ready
        self.health_probe = health_probe
        self.service_probe = service_probe
        self.ready_without_process = ready_without_process
        self._model_dir = model_dir
        self.note = entry.note
        self.concurrency = entry.concurrency or "serial"
        self.distribution = entry.distribution
        self.tiered = entry.tiered

    def boot_blocked(self) -> bool:
        return model_boot.is_blocked(self.name, CATEGORY_TTS)

    def _module_available(self) -> bool:
        available = getattr(self.module, "available", None)
        return bool(available and available())

    def available(self) -> bool:
        return not self.boot_blocked() and self._module_available()

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        raise NotImplementedError

    def base_url(self) -> str:
        getter = getattr(self.module, "base_url", None)
        return str(getter() if getter else "").rstrip("/")

    def disabled_reason(self) -> Optional[str]:
        """The engine's reason text; a coded reason (tts_reason_codes) is
        returned as is, so its code and params reach the status UI. A boot
        block wins over the engine's own reason."""
        boot_reason = model_boot.reason(self.name, CATEGORY_TTS)
        if boot_reason:
            return boot_reason
        getter = getattr(self.module, "disabled_reason", None)
        if not callable(getter):
            return None
        reason = getter()
        if not reason:
            return None
        return reason if isinstance(reason, str) else str(reason)

    def last_synth_error(self) -> Optional[str]:
        getter = getattr(self.module, "last_synth_error", None)
        if not callable(getter):
            return None
        error = getter()
        return str(error) if error else None

    def config_ready(self) -> bool:
        if self.boot_blocked():
            return False
        if self._config_ready is not None:
            return bool(self._config_ready())
        return self.disabled_reason() is None

    def has_config_gate(self) -> bool:
        """True when the adapter declares an explicit configuration gate
        (a missing config a managed lease can never fix by starting the server)."""
        return self._config_ready is not None

    def healthy(self) -> bool:
        return bool(self.health_probe and self.health_probe())

    def service_report(self) -> Optional[Dict[str, Any]]:
        """Canonical lightweight lifecycle report for a managed server."""
        if self.service_probe is None:
            return None
        info = self.service_probe()
        return info if isinstance(info, dict) else None

    def model_path(self) -> Optional[Path]:
        return self._model_dir() if self._model_dir is not None else None

    def is_model_loaded(self) -> bool:
        getter = getattr(self.module, "is_model_loaded", None)
        return bool(getter and getter())

    def unload_model(self) -> None:
        unload = getattr(self.module, "unload_model", None)
        if callable(unload):
            unload()

    def invalidate_availability(self) -> None:
        if self.availability_signal:
            THREAD_BUS.clear_signal(self.availability_signal)


class SpeedTTSEngineAdapter(TTSEngineAdapter):
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        return bool(self.module.synthesize(
            request.text,
            request.language,
            request.output_path,
            speed=request.speed,
        ))


class QwenTTSEngineAdapter(SpeedTTSEngineAdapter):
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        # Speed policy lives with the engine: an explicit rate hint resolves to
        # a speed factor; no hint forwards None so the SERVER applies its own
        # default (QWEN3TTS_SPEED / QWEN3TTS_DEFAULT_SPEED = 0.75).
        return bool(self.module.synthesize(
            request.text,
            request.language,
            request.output_path,
            speed=self.module.effective_speed(request.rate),
            speaker=request.speaker,
            instruct=request.instruct,
            client_job_id=request.client_job_id,
            progress_callback=request.progress_callback,
        ))


class EdgeTTSEngineAdapter(TTSEngineAdapter):
    def _module_available(self) -> bool:
        return bool(edge_tts_client.initialize())

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        voice = TTSConfig.resolve_voice(
            request.locale,
            request.accent,
            request.gender,
        )
        return bool(voice and edge_tts_client.synthesize(
            request.text,
            voice,
            request.output_path,
        ))


class StreamElementsTTSEngineAdapter(TTSEngineAdapter):
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        return bool(self.module.synthesize(
            request.text,
            request.language,
            request.output_path,
            accent=request.accent,
        ))


class SimpleTTSEngineAdapter(TTSEngineAdapter):
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        return bool(self.module.synthesize(
            request.text,
            request.language,
            request.output_path,
        ))


class AzureTTSEngineAdapter(TTSEngineAdapter):
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        return bool(self.module.synthesize(
            request.text,
            request.language,
            request.output_path,
            rate=request.rate,
        ))


class TTSEngineRegistry(EngineRegistry[TTSEngineAdapter]):
    def __init__(self, adapters: Iterable[TTSEngineAdapter]) -> None:
        super().__init__(adapters)


_ENGINE_ADAPTERS = (
    SpeedTTSEngineAdapter(
        "chattts",
        chattts_engine,
        availability_signal=BusSignals.TTS_CHATTTS_AVAILABLE,
        config_ready=_chattts_model_ready,
        health_probe=chattts_engine.probe_ready,
        model_dir=_chattts_model_dir,
    ),
    SpeedTTSEngineAdapter(
        "cosyvoice",
        cosyvoice_engine,
        availability_signal=BusSignals.TTS_COSYVOICE_AVAILABLE,
    ),
    SpeedTTSEngineAdapter(
        "fishspeech",
        fishspeech_engine,
        availability_signal=BusSignals.TTS_FISHSPEECH_AVAILABLE,
        config_ready=fishspeech_engine.synth_ready,
        ready_without_process=fishspeech_engine._sdk_available,
    ),
    QwenTTSEngineAdapter(
        "qwen3tts",
        qwen_engine,
        health_probe=qwen_engine.service_healthy,
        service_probe=qwen_engine.health,
    ),
    SpeedTTSEngineAdapter(
        "bark",
        bark_engine,
    ),
    SpeedTTSEngineAdapter(
        "parler",
        parler_engine,
    ),
    SpeedTTSEngineAdapter(
        "voxcpm2",
        voxcpm2_engine,
        availability_signal=BusSignals.TTS_VOXCPM2_AVAILABLE,
    ),
    SpeedTTSEngineAdapter(
        "kokoro",
        kokoro_engine,
    ),
    SpeedTTSEngineAdapter(
        "f5tts",
        f5tts_engine,
        availability_signal=BusSignals.TTS_F5TTS_AVAILABLE,
        config_ready=lambda: f5tts_engine.disabled_reason() is None,
    ),
    EdgeTTSEngineAdapter(
        "edge",
        edge_tts_client,
    ),
    StreamElementsTTSEngineAdapter(
        "streamelements",
        streamelements_engine,
    ),
    SpeedTTSEngineAdapter(
        "sherpa",
        sherpa_engine,
    ),
    SpeedTTSEngineAdapter(
        "melotts",
        melotts_engine,
    ),
    SpeedTTSEngineAdapter(
        "gptsovits",
        gptsovits_engine,
        availability_signal=BusSignals.TTS_GPTSOVITS_AVAILABLE,
        config_ready=lambda: gptsovits_engine._ref_audio() is not None,
    ),
    SimpleTTSEngineAdapter(
        "gtts_web",
        gtts_web_engine,
    ),
    AzureTTSEngineAdapter(
        "azure",
        azure_engine,
    ),
)

tts_engine_registry = TTSEngineRegistry(_ENGINE_ADAPTERS)


__all__ = [
    "TTSEngineAdapter",
    "TTSEngineRegistry",
    "TTSSynthesisRequest",
    "tts_engine_registry",
]
