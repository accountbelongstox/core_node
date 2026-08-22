# -*- coding: utf-8 -*-
"""
Sentence-audio auto-start settings (Queue Center toggle).

When enabled, turns on Pycore's persistent sentence-audio pull worker.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.user_data_store import user_data_store
import pycore.pyutils.tts.qwen.engine as qwen_engine
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as SENTENCE_AUDIO_ENGINE
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY,
    status_snapshot_cache,
)
from pycore.pyctl.assist.assist_settings import (
    load_assist_settings,
    set_assist_capability,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime

from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_sentence_audio_worker,
)


_SECTION = "sentence_audio_auto"
_CONCURRENCY_KEY = "concurrency"
_SPEAKER_KEY = "speaker"


def get_config() -> Dict[str, Any]:
    section = user_data_store.get_section(_SECTION) or {}
    assist = load_assist_settings()
    try:
        concurrency = int(section.get(_CONCURRENCY_KEY, 0) or 0)
    except (TypeError, ValueError):
        concurrency = 0
    return {
        "auto_start": bool(
            assist.get("enabled")
            and (assist.get("capabilities") or {}).get("sentence_audio")
        ),
        # 0 = use the per-engine recommended value.
        "concurrency": concurrency,
        "speaker": str(section.get(_SPEAKER_KEY) or "").strip(),
    }


def restore_persisted_auto_start() -> None:
    """Apply persisted concurrency before the pull callback starts."""
    try:
        laravel_sentence_audio_worker.set_concurrency(get_config()["concurrency"])
        laravel_sentence_audio_worker.set_speaker(get_config()["speaker"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] restore concurrency failed ({exc})")


def _warm_sentence_engine() -> None:
    """Preload the sentence TTS engine (qwen3tts) into memory right after the
    ON toggle — do not wait for the first claimed task to pay the model-load
    cost. Runs on a daemon thread; the managed-service settings gates
    (server_enabled / server_auto_manage) still apply inside the lease."""
    try:
        with managed_services.lease(SENTENCE_AUDIO_ENGINE):
            capabilities = qwen_engine.get_capabilities() or {}
            status_snapshot_cache.put(
                STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY,
                capabilities,
            )
        ColorPrint.green("[SentenceAudioAuto] qwen3tts server warm — model loaded")
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] qwen3tts warm-up failed ({exc})")


def warm_engine_after_enable() -> None:
    """Spawn the async qwen3tts warm-up after the ON toggle."""
    try:
        start_bus_task(
            _warm_sentence_engine,
            thread_name="sentence-audio-engine-warm",
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] engine warm-up spawn failed ({exc})")


def apply_auto_start(
    enabled: bool,
    concurrency: Optional[int] = None,
    speaker: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist toggle (+ optional overrides) and apply live. ``concurrency``
    None leaves the persisted value untouched; 0 means "use the per-engine
    recommended value". The capability transition itself flows through the
    shared assist control plane (set_assist_capability + apply_assist_runtime),
    which also drives the lane lifecycle."""
    updates: Dict[str, Any] = {}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    if speaker is not None:
        updates[_SPEAKER_KEY] = str(speaker or "").strip()
    store = user_data_store
    if updates:
        store.update_section(_SECTION, updates)

    if concurrency is not None:
        try:
            laravel_sentence_audio_worker.set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] live concurrency apply failed ({exc})")
    if speaker is not None:
        try:
            laravel_sentence_audio_worker.set_speaker(str(speaker or "").strip())
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] live speaker apply failed ({exc})")

    settings = set_assist_capability("sentence_audio", bool(enabled))
    runtime = apply_assist_runtime(settings)
    errors = list(runtime.get("errors") or [])

    if enabled:
        warm_engine_after_enable()

    ColorPrint.blue(f"[SentenceAudioAuto] auto_start set to {bool(enabled)}")
    status = get_status()
    if errors:
        status["error"] = "; ".join(errors)
    return status


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    try:
        worker_status = laravel_sentence_audio_worker.get_status()
    except Exception:
        pass
    assist = load_assist_settings()
    caps = assist.get("capabilities") or {}
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = laravel_sentence_audio_worker.concurrency_status()
    except Exception:
        pass
    qwen_capabilities = (
        status_snapshot_cache.peek(STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY) or {}
    )
    return {
        "auto_start": cfg["auto_start"],
        "concurrency": concurrency_status.get("concurrency", cfg["concurrency"]),
        "concurrency_recommended": concurrency_status.get("concurrency_recommended", 0),
        "concurrency_limit": concurrency_status.get("concurrency_limit", 1),
        "concurrency_class": concurrency_status.get("concurrency_class"),
        "selected_speaker": cfg["speaker"],
        "supported_speakers": list(qwen_capabilities.get("speakers") or []),
        "processor_enabled": cfg["auto_start"],
        "heartbeat_enabled": cfg["auto_start"],
        "sentence_audio_capability": bool(caps.get("sentence_audio")),
        "required_engine": SENTENCE_AUDIO_ENGINE,
        "worker": worker_status,
    }
