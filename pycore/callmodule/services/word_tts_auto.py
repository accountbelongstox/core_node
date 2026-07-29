# -*- coding: utf-8 -*-
"""
Word-dictionary TTS auto-start (Queue Center toggle).

When enabled, keeps the tts_queue_poller heartbeat callback ON so pycore
continuously claims + synthesizes missing word audio from Laravel's
tts_cache_{lang} tables.
"""

from typing import Any, Dict, Optional

import threading

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat.heartbeat import get_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_settings_exist, load_assist_settings, save_assist_settings

from pycore.callmodule.services.tts_queue_poller_service import (
    get_tts_queue_poller_service,
)
from pycore.callmodule.services.endpoint_scoped_cache import EndpointScopedCache
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager


_SECTION = "word_tts_auto"
_AUTO_KEY = "auto_start"
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
        value = get_laravel_endpoint_manager().get_active_base_url()
        return str(value or "").strip().rstrip("/")
    except Exception:
        return ""


def _laravel_queue_summary() -> Dict[str, Any]:
    """Cached Laravel pending/leased counts (limit=0 claim)."""
    endpoint = _summary_endpoint()
    if not endpoint:
        return {}
    return _LARAVEL_SUMMARY_CACHE.get_or_fetch(
        endpoint,
        lambda: get_tts_queue_poller_service().fetch_queue_summary() or {},
    )


def get_config() -> Dict[str, Any]:
    section = get_user_data_store().get_section(_SECTION) or {}
    assist = load_assist_settings()
    try:
        concurrency = int(section.get(_CONCURRENCY_KEY, 0) or 0)
    except (TypeError, ValueError):
        concurrency = 0
    return {
        "auto_start": (
            bool(assist.get("enabled") and (assist.get("capabilities") or {}).get("tts", True))
            if assist_settings_exist()
            else bool(section.get(_AUTO_KEY, False))
        ),
        # 0 = use the per-engine recommended value.
        "concurrency": concurrency,
    }


def restore_persisted_auto_start() -> None:
    """Apply persisted word_tts_auto.auto_start after heartbeat registration.

    When ``assist_laravel`` exists in user_data, voice auto-run is owned by
    Assist → Voice (TTS); skip legacy per-strip toggles here.
    """
    store = get_user_data_store()
    section = store.get_section(_SECTION)
    if not assist_settings_exist() and section is None:
        # No persisted toggle: land deterministically OFF.
        try:
            get_heartbeat_system().disable_callback(_HEARTBEAT_NAME)
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] default-off disable failed ({exc})")
        return

    enabled = get_config()["auto_start"]
    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(_HEARTBEAT_NAME)
        else:
            heartbeat.disable_callback(_HEARTBEAT_NAME)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore heartbeat failed ({exc})")

    ColorPrint.blue(f"[WordTtsAuto] Restored auto_start={enabled} from user_data")
    try:
        get_tts_queue_poller_service().set_concurrency(get_config()["concurrency"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore concurrency failed ({exc})")
    if not enabled:
        return

    try:
        threading.Thread(
            target=get_tts_queue_poller_service().poll_and_process,
            daemon=True,
            name="word-tts-restore-poll"
        ).start()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore immediate cycle failed ({exc})")


def apply_auto_start(enabled: bool, concurrency: Optional[int] = None) -> Dict[str, Any]:
    """Persist toggle (+ optional concurrency override) and apply live.

    ``concurrency`` None leaves the persisted value untouched; 0 means "use the
    per-engine recommended value". The live value is pushed straight onto the
    worker service instance."""
    updates: Dict[str, Any] = {}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = get_user_data_store()
    if updates:
        store.update_section(_SECTION, updates)

    assist = load_assist_settings()
    caps = dict(assist.get("capabilities") or {})
    caps["tts"] = bool(enabled)
    save_assist_settings({
        "enabled": True if enabled else assist.get("enabled", False),
        "capabilities": caps,
    })

    if concurrency is not None:
        try:
            get_tts_queue_poller_service().set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] live concurrency apply failed ({exc})")

    error: Optional[str] = None
    heartbeat = get_heartbeat_system()
    try:
        ok = (
            heartbeat.enable_callback(_HEARTBEAT_NAME)
            if enabled
            else heartbeat.disable_callback(_HEARTBEAT_NAME)
        )
        if not ok:
            error = f"{_HEARTBEAT_NAME} is not registered"
            ColorPrint.yellow(f"[WordTtsAuto] {error}")
    except Exception as exc:  # noqa: BLE001
        error = f"heartbeat toggle failed ({exc})"
        ColorPrint.yellow(f"[WordTtsAuto] {error}")

    if enabled:
        try:
            threading.Thread(
                target=get_tts_queue_poller_service().poll_and_process,
                daemon=True,
                name="word-tts-auto-poll"
            ).start()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] immediate cycle failed ({exc})")

    ColorPrint.blue(f"[WordTtsAuto] auto_start set to {bool(enabled)}")
    status = get_status()
    if error:
        status["error"] = error
    return status


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    heartbeat_enabled = False
    try:
        worker_status = get_tts_queue_poller_service().get_status()
    except Exception:
        pass
    try:
        heartbeat_enabled = bool(
            get_heartbeat_system().is_callback_enabled(_HEARTBEAT_NAME)
        )
    except Exception:
        pass
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = get_tts_queue_poller_service().concurrency_status()
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
