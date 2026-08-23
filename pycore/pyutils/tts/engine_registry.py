# -*- coding: utf-8 -*-

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, Tuple

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.engine_registry import EngineAdapter, EngineRegistry
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
        managed_kind: Optional[str] = None,
        health_paths: Tuple[str, ...] = (),
        availability_signal: Optional[str] = None,
        config_ready: Optional[Callable[[], bool]] = None,
        health_probe: Optional[Callable[[], bool]] = None,
        service_probe: Optional[Callable[[], Optional[Dict[str, Any]]]] = None,
        ready_without_process: Optional[Callable[[], bool]] = None,
        model_dir: Optional[Callable[[], Path]] = None,
        note: str = "",
        concurrency: Optional[str] = None,
        distribution: Optional[str] = None,
        tiered: bool = False,
    ) -> None:
        super().__init__(name, managed_kind=managed_kind)
        self.module = module
        self.health_paths = health_paths
        self.availability_signal = availability_signal
        self._config_ready = config_ready
        self.health_probe = health_probe
        self.service_probe = service_probe
        self.ready_without_process = ready_without_process
        self._model_dir = model_dir
        self.note = str(note or "")
        self.concurrency = concurrency or self._default_concurrency()
        self.distribution = distribution
        self.tiered = bool(tiered)

    def _default_concurrency(self) -> str:
        if self.managed_kind == "server":
            return "server"
        if self.managed_kind == "model":
            return "in_process"
        return "serial"

    def available(self) -> bool:
        available = getattr(self.module, "available", None)
        return bool(available and available())

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        raise NotImplementedError

    def base_url(self) -> str:
        getter = getattr(self.module, "base_url", None)
        return str(getter() if getter else "").rstrip("/")

    def disabled_reason(self) -> Optional[str]:
        getter = getattr(self.module, "disabled_reason", None)
        if not callable(getter):
            return None
        reason = getter()
        return str(reason) if reason else None

    def last_synth_error(self) -> Optional[str]:
        getter = getattr(self.module, "last_synth_error", None)
        if not callable(getter):
            return None
        error = getter()
        return str(error) if error else None

    def config_ready(self) -> bool:
        if self._config_ready is not None:
            return bool(self._config_ready())
        return self.disabled_reason() is None

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
    def available(self) -> bool:
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
        managed_kind="server",
        health_paths=("/health", "/"),
        availability_signal="pyutils.tts.chattts.available",
        config_ready=_chattts_model_ready,
        health_probe=chattts_engine.probe_ready,
        model_dir=_chattts_model_dir,
        note="ChatTTS local api (dialogue; laughs/sighs; CHATTTS_URL)",
    ),
    SpeedTTSEngineAdapter(
        "cosyvoice",
        cosyvoice_engine,
        managed_kind="server",
        health_paths=("/docs", "/"),
        availability_signal="pyutils.tts.cosyvoice.available",
        note="CosyVoice local api (multilingual clone; COSYVOICE_URL)",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "fishspeech",
        fishspeech_engine,
        managed_kind="server",
        health_paths=("/v1/health", "/health", "/"),
        availability_signal="pyutils.tts.fishspeech.available",
        config_ready=fishspeech_engine.synth_ready,
        ready_without_process=fishspeech_engine._sdk_available,
        note="Fish Speech / Fish Audio (FISHSPEECH_URL or FISH_API_KEY)",
        tiered=True,
    ),
    QwenTTSEngineAdapter(
        "qwen3tts",
        qwen_engine,
        managed_kind="server",
        health_paths=("/health", "/"),
        health_probe=qwen_engine.service_healthy,
        service_probe=qwen_engine.health,
        note="Qwen3-TTS class-C HTTP server (isolated venv; managed lifecycle)",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "bark",
        bark_engine,
        managed_kind="model",
        note="Bark via transformers (suno/bark; expressive; Python 3.13 native)",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "parler",
        parler_engine,
        note="Parler-TTS in-process (HF; voice-description steering)",
        concurrency="in_process",
    ),
    SpeedTTSEngineAdapter(
        "voxcpm2",
        voxcpm2_engine,
        managed_kind="model",
        note="VoxCPM2 in-process (OpenBMB; GPU preferred; pip voxcpm)",
        distribution="voxcpm",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "kokoro",
        kokoro_engine,
        managed_kind="model",
        note="Kokoro-82M sherpa-onnx offline (zh/en; KOKORO_TTS_MODEL_DIR)",
        distribution="sherpa-onnx",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "f5tts",
        f5tts_engine,
        managed_kind="server",
        health_paths=("/health", "/"),
        availability_signal="pyutils.tts.f5tts.available",
        note="F5-TTS local api (fast flow-matching clone; F5TTS_URL)",
    ),
    EdgeTTSEngineAdapter(
        "edge",
        edge_tts_client,
        note="Microsoft Edge TTS (online; serialized)",
    ),
    StreamElementsTTSEngineAdapter(
        "streamelements",
        streamelements_engine,
        note="StreamElements speech (online; API key; en only)",
        concurrency="cloud",
    ),
    SpeedTTSEngineAdapter(
        "sherpa",
        sherpa_engine,
        managed_kind="model",
        note="Sherpa-ONNX Kokoro offline (CPU)",
        distribution="sherpa-onnx",
        tiered=True,
    ),
    SpeedTTSEngineAdapter(
        "melotts",
        melotts_engine,
        managed_kind="server",
        health_paths=("/health", "/"),
        note="MeloTTS offline (torch GPU->CPU auto)",
    ),
    SpeedTTSEngineAdapter(
        "gptsovits",
        gptsovits_engine,
        managed_kind="server",
        health_paths=("/",),
        availability_signal="pyutils.tts.gptsovits.available",
        config_ready=lambda: gptsovits_engine._ref_audio() is not None,
        note="GPT-SoVITS local api server (voice clone)",
        tiered=True,
    ),
    SimpleTTSEngineAdapter(
        "gtts_web",
        gtts_web_engine,
        note="Google Translate web TTS (online, keyless; short text)",
        concurrency="cloud",
    ),
    AzureTTSEngineAdapter(
        "azure",
        azure_engine,
        note="Azure Speech cloud (free F0; API fallback)",
        concurrency="cloud",
    ),
)

tts_engine_registry = TTSEngineRegistry(_ENGINE_ADAPTERS)


__all__ = [
    "TTSEngineAdapter",
    "TTSEngineRegistry",
    "TTSSynthesisRequest",
    "tts_engine_registry",
]
