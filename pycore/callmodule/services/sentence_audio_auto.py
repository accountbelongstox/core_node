# -*- coding: utf-8 -*-
"""
Sentence-audio auto-start settings (Queue Center toggle).

When enabled, keeps the tts_sentence_worker heartbeat callback ON and turns on
the sentence_audio assist capability so pycore continuously claims + synthesizes
missing sentence audio from Laravel's priority queue.
"""

from typing import Any, Dict

import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.assist import load_assist_settings, save_assist_settings

_SECTION = "sentence_audio_auto"
_AUTO_KEY = "auto_start"
_HEARTBEAT_NAME = "tts_sentence_worker"
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
        from pycore.callmodule.services import get_tts_sentence_worker_service
        summary = get_tts_sentence_worker_service().fetch_queue_summary() or {}
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


def apply_auto_start(enabled: bool) -> Dict[str, Any]:
    """Persist toggle and apply live: heartbeat + assist capability."""
    store = get_user_data_store()
    store.update_section(_SECTION, {_AUTO_KEY: bool(enabled)})

    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(_HEARTBEAT_NAME)
        else:
            heartbeat.disable_callback(_HEARTBEAT_NAME)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] heartbeat toggle failed ({exc})")

    settings = load_assist_settings()
    caps = dict(settings.get("capabilities") or {})
    caps["sentence_audio"] = bool(enabled)
    save_assist_settings({**settings, "capabilities": caps})

    if enabled:
        try:
            from pycore.callmodule.services import get_tts_sentence_worker_service
            worker = get_tts_sentence_worker_service()
            worker.poll_and_process()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] immediate cycle failed ({exc})")

    ColorPrint.blue(f"[SentenceAudioAuto] auto_start set to {bool(enabled)}")
    return get_status()


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    heartbeat_enabled = False
    try:
        from pycore.callmodule.services import get_tts_sentence_worker_service
        worker_status = get_tts_sentence_worker_service().get_status()
    except Exception:
        pass
    try:
        heartbeat_enabled = bool(
            get_heartbeat_system().is_callback_enabled(_HEARTBEAT_NAME)
        )
    except Exception:
        pass
    assist = load_assist_settings()
    caps = assist.get("capabilities") or {}
    return {
        "auto_start": cfg["auto_start"],
        "heartbeat_enabled": heartbeat_enabled,
        "sentence_audio_capability": bool(caps.get("sentence_audio")),
        "laravel": _laravel_queue_summary(),
        "worker": worker_status,
    }
