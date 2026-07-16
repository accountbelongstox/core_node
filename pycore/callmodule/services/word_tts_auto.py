# -*- coding: utf-8 -*-
"""
Word-dictionary TTS auto-start (Queue Center toggle).

When enabled, keeps the tts_queue_poller heartbeat callback ON so pycore
continuously claims + synthesizes missing word audio from Laravel's
tts_cache_{lang} tables.
"""

from typing import Any, Dict

import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system

from pycore.callmodule.services import get_tts_queue_poller_service


_SECTION = "word_tts_auto"
_AUTO_KEY = "auto_start"
_HEARTBEAT_NAME = "tts_queue_poller"
_LARAVEL_SUMMARY_TTL_S = 30.0
_laravel_summary_cache: Dict[str, Any] = {}
_laravel_summary_ts: float = 0.0


def _laravel_queue_summary() -> Dict[str, Any]:
    """Cached Laravel pending/leased counts (limit=0 claim)."""
    global _laravel_summary_cache, _laravel_summary_ts
    now = time.time()
    if _laravel_summary_cache and (now - _laravel_summary_ts) < _LARAVEL_SUMMARY_TTL_S:
        return dict(_laravel_summary_cache)
    summary: Dict[str, Any] = {}
    try:
        summary = get_tts_queue_poller_service().fetch_queue_summary() or {}
    except Exception:
        pass
    if summary:
        _laravel_summary_cache = dict(summary)
        _laravel_summary_ts = now
        summary["cached_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    elif _laravel_summary_cache:
        return dict(_laravel_summary_cache)
    return summary


def get_config() -> Dict[str, Any]:
    section = get_user_data_store().get_section(_SECTION) or {}
    return {
        "auto_start": bool(section.get(_AUTO_KEY, False)),
    }


def restore_persisted_auto_start() -> None:
    """Apply persisted word_tts_auto.auto_start after heartbeat registration.

    When ``assist_laravel`` exists in user_data, voice auto-run is owned by
    Assist → Voice (TTS); skip legacy per-strip toggles here.
    """
    store = get_user_data_store()
    if store.get_section("assist_laravel") is not None:
        ColorPrint.blue("[WordTtsAuto] Skipping restore — assist_laravel owns voice workers")
        return
    section = store.get_section(_SECTION)
    if section is None:
        return

    enabled = bool(section.get(_AUTO_KEY, False))
    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(_HEARTBEAT_NAME)
        else:
            heartbeat.disable_callback(_HEARTBEAT_NAME)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore heartbeat failed ({exc})")

    ColorPrint.blue(f"[WordTtsAuto] Restored auto_start={enabled} from user_data")
    if not enabled:
        return

    try:
        get_tts_queue_poller_service().poll_and_process()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore immediate cycle failed ({exc})")


def apply_auto_start(enabled: bool) -> Dict[str, Any]:
    """Persist toggle and apply live: heartbeat on/off."""
    store = get_user_data_store()
    store.update_section(_SECTION, {_AUTO_KEY: bool(enabled)})

    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(_HEARTBEAT_NAME)
        else:
            heartbeat.disable_callback(_HEARTBEAT_NAME)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] heartbeat toggle failed ({exc})")

    if enabled:
        try:
            get_tts_queue_poller_service().poll_and_process()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] immediate cycle failed ({exc})")

    ColorPrint.blue(f"[WordTtsAuto] auto_start set to {bool(enabled)}")
    return get_status()


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
    return {
        "auto_start": cfg["auto_start"],
        "heartbeat_enabled": heartbeat_enabled,
        "laravel": _laravel_queue_summary(),
        "worker": worker_status,
    }
