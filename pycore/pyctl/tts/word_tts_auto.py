# -*- coding: utf-8 -*-
"""
Word-dictionary TTS auto-start (Queue Center toggle).

When enabled, keeps the tts_queue_poller heartbeat callback ON so pycore
continuously claims + synthesizes missing word audio from Laravel's
tts_cache_{lang} tables.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import load_assist_settings, save_assist_settings
from pycore.pyctl.assist.capability_sync import apply_assist_runtime

from pycore.pyctl.tts.word_queue_poller_service import (
    tts_queue_poller_service,
)
from pycore.pyutils.common.endpoint_scoped_cache import EndpointScopedCache
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


_SECTION = "word_tts_auto"
_CONCURRENCY_KEY = "concurrency"
_HEARTBEAT_NAME = "tts_queue_poller"
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
        lambda: tts_queue_poller_service.fetch_queue_summary() or {},
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
            assist.get("enabled") and (assist.get("capabilities") or {}).get("tts")
        ),
        # 0 = use the per-engine recommended value.
        "concurrency": concurrency,
    }


def restore_persisted_auto_start() -> None:
    """Apply persisted concurrency after callback registration."""
    try:
        tts_queue_poller_service.set_concurrency(get_config()["concurrency"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore concurrency failed ({exc})")


def apply_auto_start(enabled: bool, concurrency: Optional[int] = None) -> Dict[str, Any]:
    """Persist toggle (+ optional concurrency override) and apply live.

    ``concurrency`` None leaves the persisted value untouched; 0 means "use the
    per-engine recommended value". The live value is pushed straight onto the
    worker service instance."""
    updates: Dict[str, Any] = {}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = user_data_store
    if updates:
        store.update_section(_SECTION, updates)

    assist = load_assist_settings()
    caps = dict(assist.get("capabilities") or {})
    caps["tts"] = bool(enabled)
    settings = save_assist_settings({
        "enabled": bool(any(caps.values())),
        "capabilities": caps,
    })

    if concurrency is not None:
        try:
            tts_queue_poller_service.set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] live concurrency apply failed ({exc})")

    runtime = apply_assist_runtime(settings)
    errors = list(runtime.get("errors") or [])

    if enabled:
        try:
            start_bus_task(
                tts_queue_poller_service.poll_and_process,
                thread_name="word-tts-auto-poll",
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] immediate cycle failed ({exc})")

    ColorPrint.blue(f"[WordTtsAuto] auto_start set to {bool(enabled)}")
    status = get_status()
    if errors:
        status["error"] = "; ".join(errors)
    return status


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    heartbeat_enabled = False
    try:
        worker_status = tts_queue_poller_service.get_status()
    except Exception:
        pass
    try:
        heartbeat_enabled = bool(
            shared_heartbeat_system.is_callback_enabled(_HEARTBEAT_NAME)
        )
    except Exception:
        pass
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = tts_queue_poller_service.concurrency_status()
    except Exception:
        pass
    return {
        "auto_start": cfg["auto_start"],
        "concurrency": concurrency_status.get("concurrency", cfg["concurrency"]),
        "concurrency_recommended": concurrency_status.get("concurrency_recommended", 0),
        "heartbeat_enabled": heartbeat_enabled,
        "laravel": _laravel_queue_summary(),
        "worker": worker_status,
    }
