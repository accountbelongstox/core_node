# -*- coding: utf-8 -*-
"""
Sentence-audio auto-start settings (Queue Center toggle).

When enabled, keeps the tts_sentence_worker heartbeat callback ON and turns on
the sentence_audio assist capability so pycore continuously claims + synthesizes
missing sentence audio from Laravel's priority queue.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
import pycore.pyutils.tts.tts_service_manager as tts_service_manager
from pycore.pyctl.assist.assist_settings import (
    assist_capability_enabled,
    load_assist_settings,
    save_assist_settings,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime

from pycore.pyctl.tts.sentence_worker_service import (
    tts_sentence_worker_service,
)
from pycore.pyutils.common.endpoint_scoped_cache import EndpointScopedCache
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


_SECTION = "sentence_audio_auto"
_CONCURRENCY_KEY = "concurrency"
_HEARTBEAT_NAME = "tts_sentence_worker"
_LARAVEL_SUMMARY_TTL_S = 30.0
_LARAVEL_SUMMARY_STALE_MAX_S = 300.0
_LARAVEL_SUMMARY_CACHE = EndpointScopedCache(
    ttl_s=_LARAVEL_SUMMARY_TTL_S,
    stale_max_s=_LARAVEL_SUMMARY_STALE_MAX_S,
)


def _summary_endpoint() -> str:
    try:
        value = laravel_endpoint_manager.get_active_base_url()
        return str(value or "").strip().rstrip("/")
    except Exception:
        return ""


def _laravel_queue_summary() -> Dict[str, Any]:
    """Return cached counts immediately and refresh Laravel in background."""
    endpoint = _summary_endpoint()
    if not endpoint:
        return {}
    return _LARAVEL_SUMMARY_CACHE.get_or_refresh(
        endpoint,
        lambda: tts_sentence_worker_service.fetch_queue_summary() or {},
    )


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
    }


def sentence_audio_auto_enabled_on_start(legacy_default: bool) -> bool:
    """Startup gate for the sentence-audio edge-tts worker.

    The effective Assist setting is authoritative; the legacy default remains
    in the signature only for call compatibility.
    """
    return assist_capability_enabled("sentence_audio", legacy_default)


def restore_persisted_auto_start() -> None:
    """Apply persisted concurrency after callback registration."""
    try:
        tts_sentence_worker_service.set_concurrency(get_config()["concurrency"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] restore concurrency failed ({exc})")


def _warm_sentence_engine() -> None:
    """Preload the sentence TTS engine (qwen3tts) into memory right after the
    ON toggle — do not wait for the first claimed task to pay the model-load
    cost. Runs on a daemon thread; the managed-service settings gates
    (server_enabled / server_auto_manage) still apply inside ensure_running."""
    try:
        if tts_service_manager.prepare_server_for_use("qwen3tts"):
            ColorPrint.green("[SentenceAudioAuto] qwen3tts server warm — model loaded")
        else:
            ColorPrint.yellow("[SentenceAudioAuto] qwen3tts warm-up skipped (disabled/unavailable)")
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] qwen3tts warm-up failed ({exc})")


def apply_auto_start(enabled: bool, concurrency: Optional[int] = None) -> Dict[str, Any]:
    """Persist toggle (+ optional concurrency override) and apply live: heartbeat
    + assist capability. ``concurrency`` None leaves the persisted value
    untouched; 0 means "use the per-engine recommended value"."""
    updates: Dict[str, Any] = {}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = user_data_store
    if updates:
        store.update_section(_SECTION, updates)

    if concurrency is not None:
        try:
            tts_sentence_worker_service.set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] live concurrency apply failed ({exc})")

    settings = load_assist_settings()
    caps = dict(settings.get("capabilities") or {})
    caps["sentence_audio"] = bool(enabled)
    settings = save_assist_settings({
        "enabled": bool(any(caps.values())),
        "capabilities": caps,
    })
    runtime = apply_assist_runtime(settings)
    errors = list(runtime.get("errors") or [])

    if enabled:
        try:
            worker = tts_sentence_worker_service
            start_bus_task(
                worker.poll_and_process,
                thread_name="sentence-audio-auto-poll",
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] immediate cycle failed ({exc})")
        try:
            start_bus_task(
                _warm_sentence_engine,
                thread_name="sentence-audio-engine-warm",
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] engine warm-up spawn failed ({exc})")

    ColorPrint.blue(f"[SentenceAudioAuto] auto_start set to {bool(enabled)}")
    status = get_status()
    if errors:
        status["error"] = "; ".join(errors)
    return status


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    heartbeat_enabled = False
    try:
        worker_status = tts_sentence_worker_service.get_status()
    except Exception:
        pass
    try:
        heartbeat_enabled = bool(
            shared_heartbeat_system.is_callback_enabled(_HEARTBEAT_NAME)
        )
    except Exception:
        pass
    assist = load_assist_settings()
    caps = assist.get("capabilities") or {}
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = tts_sentence_worker_service.concurrency_status()
    except Exception:
        pass
    return {
        "auto_start": cfg["auto_start"],
        "concurrency": concurrency_status.get("concurrency", cfg["concurrency"]),
        "concurrency_recommended": concurrency_status.get("concurrency_recommended", 0),
        "heartbeat_enabled": heartbeat_enabled,
        "sentence_audio_capability": bool(caps.get("sentence_audio")),
        "laravel": _laravel_queue_summary(),
        "worker": worker_status,
    }
