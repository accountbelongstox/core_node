# -*- coding: utf-8 -*-
"""
Word-dictionary TTS auto-start (Queue Center toggle).

When enabled, keeps the tts_queue_poller heartbeat callback ON so pycore
continuously claims + synthesizes missing word audio from Laravel's
tts_cache_{lang} tables.
"""

from typing import Any, Dict, Optional

import time
import threading

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.assist import load_assist_settings, save_assist_settings

from pycore.callmodule.services.tts_queue_poller_service import (
    get_tts_queue_poller_service,
)


_SECTION = "word_tts_auto"
_AUTO_KEY = "auto_start"
_CONCURRENCY_KEY = "concurrency"
_HEARTBEAT_NAME = "tts_queue_poller"
_LARAVEL_SUMMARY_TTL_S = 30.0
_SUMMARY_STATE_QUEUE = "word_tts_auto.summary"
_laravel_summary_cache: Dict[str, Any] = {}
_laravel_summary_ts: float = 0.0
_SUMMARY_STATE_WORKER = SerializedWorkerThread(
    _SUMMARY_STATE_QUEUE,
    "WordTTSSummaryStateThread",
)
_SUMMARY_STATE_WORKER.start()


def _read_summary_cache(now: float) -> Dict[str, Any]:
    if _laravel_summary_cache and (now - _laravel_summary_ts) < _LARAVEL_SUMMARY_TTL_S:
        return dict(_laravel_summary_cache)
    return {}


def _store_summary_cache(summary: Dict[str, Any], now: float) -> Dict[str, Any]:
    global _laravel_summary_cache, _laravel_summary_ts
    if summary:
        _laravel_summary_cache = dict(summary)
        _laravel_summary_ts = now
        result = dict(summary)
        result["cached_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        return result
    return dict(_laravel_summary_cache)


def _laravel_queue_summary() -> Dict[str, Any]:
    """Cached Laravel pending/leased counts (limit=0 claim)."""
    now = time.time()
    cached = call_serialized(_SUMMARY_STATE_QUEUE, _read_summary_cache, now)
    if cached:
        return cached
    summary: Dict[str, Any] = {}
    try:
        summary = get_tts_queue_poller_service().fetch_queue_summary() or {}
    except Exception:
        pass
    return call_serialized(_SUMMARY_STATE_QUEUE, _store_summary_cache, summary, now)


def get_config() -> Dict[str, Any]:
    section = get_user_data_store().get_section(_SECTION) or {}
    try:
        concurrency = int(section.get(_CONCURRENCY_KEY, 0) or 0)
    except (TypeError, ValueError):
        concurrency = 0
    return {
        "auto_start": bool(section.get(_AUTO_KEY, False)),
        # 0 = use the per-engine recommended value.
        "concurrency": concurrency,
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
        # No persisted toggle: land deterministically OFF.
        try:
            get_heartbeat_system().disable_callback(_HEARTBEAT_NAME)
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] default-off disable failed ({exc})")
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
    updates: Dict[str, Any] = {_AUTO_KEY: bool(enabled)}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = get_user_data_store()
    store.update_section(_SECTION, updates)

    assist = load_assist_settings()
    caps = dict(assist.get("capabilities") or {})
    caps["tts"] = bool(enabled)
    save_assist_settings({**assist, "capabilities": caps})

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
