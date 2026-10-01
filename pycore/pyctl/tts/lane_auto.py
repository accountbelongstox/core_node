# -*- coding: utf-8 -*-
"""Queue Center auto-start toggles of the persistent audio pull lanes."""

from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.common.user_data_store import (
    USER_DATA_SECTION_SENTENCE_AUDIO_AUTO,
    USER_DATA_SECTION_WORD_TTS_AUTO,
    user_data_store,
)
from pycore.pyutils.tts.engine_policy import SENTENCE_LANE_SPEAKER_KEY
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as SENTENCE_AUDIO_ENGINE
import pycore.pyutils.tts.qwen.engine as qwen_engine
from pycore.pyctl.assist.assist_settings import (
    load_assist_settings,
    set_assist_capability,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime
from pycore.pyctl.tts.audio_lane_activation import activate_audio_lane
from pycore.pyctl.tts.laravel_audio_worker import (
    BaseLaravelAudioWorker,
    laravel_sentence_audio_worker,
    laravel_word_audio_worker,
)


LANE_CONCURRENCY_KEY = "concurrency"


class LaneAutoConfig:
    """Persisted auto-start toggle of one audio lane. ``speaker_key`` enables the
    per-lane speaker override; ``on_enable`` and ``extra_status`` are lane hooks."""

    def __init__(
        self,
        *,
        lane: str,
        capability: str,
        section: str,
        worker: BaseLaravelAudioWorker,
        log_tag: str,
        speaker_key: Optional[str] = None,
        on_enable: Optional[Callable[[], None]] = None,
        extra_status: Optional[Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]]] = None,
    ) -> None:
        self.lane = lane
        self.capability = capability
        self.section = section
        self.worker = worker
        self.log_tag = log_tag
        self.speaker_key = speaker_key
        self.on_enable = on_enable
        self.extra_status = extra_status

    def config(self) -> Dict[str, Any]:
        section = user_data_store.get_section(self.section) or {}
        assist = load_assist_settings()
        raw_concurrency = str(section.get(LANE_CONCURRENCY_KEY, 0) or 0)
        config: Dict[str, Any] = {
            "auto_start": bool(
                assist.get("enabled")
                and (assist.get("capabilities") or {}).get(self.capability)
            ),
            # 0 = use the per-engine recommended value.
            "concurrency": int(raw_concurrency) if raw_concurrency.isdigit() else 0,
        }
        if self.speaker_key:
            config["speaker"] = str(section.get(self.speaker_key) or "").strip()
        return config

    def restore_persisted_auto_start(self) -> None:
        """Apply persisted overrides before the pull callback starts."""
        config = self.config()
        self.worker.set_concurrency(config["concurrency"])
        if self.speaker_key:
            self.worker.set_speaker(config["speaker"])

    def apply_auto_start(
        self,
        enabled: bool,
        concurrency: Optional[int] = None,
        speaker: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist the toggle (+ optional overrides) and apply it live.

        ``concurrency`` None keeps the persisted value; 0 means the per-engine
        recommended value. The capability transition flows through the shared
        assist control plane, which also drives the lane lifecycle."""
        updates: Dict[str, Any] = {}
        if concurrency is not None:
            updates[LANE_CONCURRENCY_KEY] = max(0, int(concurrency))
        if self.speaker_key and speaker is not None:
            updates[self.speaker_key] = str(speaker or "").strip()
        if updates:
            user_data_store.update_section(self.section, updates)
        if LANE_CONCURRENCY_KEY in updates:
            self.worker.set_concurrency(updates[LANE_CONCURRENCY_KEY])
        if self.speaker_key and self.speaker_key in updates:
            self.worker.set_speaker(updates[self.speaker_key])

        settings = set_assist_capability(self.capability, bool(enabled))
        if enabled:
            activate_audio_lane(self.lane)
        runtime = apply_assist_runtime(settings)
        errors = list(runtime.get("errors") or [])
        if enabled and self.on_enable is not None:
            self.on_enable()

        ColorPrint.blue(f"[{self.log_tag}] auto_start set to {bool(enabled)}")
        status = self.status()
        if errors:
            status["error"] = "; ".join(errors)
        return status

    def warm_engine_after_enable(self) -> None:
        if self.on_enable is not None:
            self.on_enable()

    def status(self) -> Dict[str, Any]:
        config = self.config()
        concurrency_status = self.worker.concurrency_status()
        status: Dict[str, Any] = {
            "auto_start": config["auto_start"],
            "concurrency": concurrency_status.get("concurrency", config["concurrency"]),
            "concurrency_recommended": concurrency_status.get("concurrency_recommended", 0),
            "processor_enabled": config["auto_start"],
            "worker": self.worker.get_status(),
        }
        if self.extra_status is not None:
            status.update(self.extra_status(config, concurrency_status))
        return status


def _warm_sentence_engine() -> None:
    """Preload the sentence engine right after the ON toggle instead of on the
    first claimed task; the managed-service gates still apply inside the lease."""
    try:
        with managed_services.lease(SENTENCE_AUDIO_ENGINE):
            capabilities = qwen_engine.get_capabilities() or {}
            status_snapshot_cache.put(STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY, capabilities)
    except (OSError, RuntimeError) as exc:
        ColorPrint.yellow(f"[SentenceAudioAuto] {SENTENCE_AUDIO_ENGINE} warm-up failed ({exc})")
        return
    ColorPrint.green(f"[SentenceAudioAuto] {SENTENCE_AUDIO_ENGINE} server warm, model loaded")


def _start_sentence_engine_warm() -> None:
    start_bus_task(_warm_sentence_engine, thread_name="sentence-audio-engine-warm")


def _sentence_extra_status(
    config: Dict[str, Any],
    concurrency_status: Dict[str, Any],
) -> Dict[str, Any]:
    capabilities = load_assist_settings().get("capabilities") or {}
    qwen_capabilities = (
        status_snapshot_cache.peek(STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY) or {}
    )
    return {
        "concurrency_limit": concurrency_status.get("concurrency_limit", 1),
        "concurrency_class": concurrency_status.get("concurrency_class"),
        "selected_speaker": config["speaker"],
        "supported_speakers": list(qwen_capabilities.get("speakers") or []),
        "sentence_audio_capability": bool(capabilities.get("sentence_audio")),
        "required_engine": SENTENCE_AUDIO_ENGINE,
    }


word_audio_auto = LaneAutoConfig(
    lane="word_audio",
    capability="tts",
    section=USER_DATA_SECTION_WORD_TTS_AUTO,
    worker=laravel_word_audio_worker,
    log_tag="WordTtsAuto",
)
sentence_audio_auto = LaneAutoConfig(
    lane="sentence_audio",
    capability="sentence_audio",
    section=USER_DATA_SECTION_SENTENCE_AUDIO_AUTO,
    worker=laravel_sentence_audio_worker,
    log_tag="SentenceAudioAuto",
    speaker_key=SENTENCE_LANE_SPEAKER_KEY,
    on_enable=_start_sentence_engine_warm,
    extra_status=_sentence_extra_status,
)


__all__ = [
    "LaneAutoConfig",
    "sentence_audio_auto",
    "word_audio_auto",
]
