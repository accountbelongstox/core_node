# -*- coding: utf-8 -*-
"""
Sentence-audio auto-start settings (Queue Center toggle).

When enabled, keeps the tts_sentence_worker heartbeat callback ON and turns on
the sentence_audio assist capability so pycore continuously claims + synthesizes
missing sentence audio from Laravel's priority queue.
"""

from typing import Any, Dict, Optional

import threading
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyutils.tts import tts_service_manager
from pycore.pyctl.assist import (
    assist_capability_enabled,
    load_assist_settings,
    save_assist_settings,
)

from pycore.callmodule.services.tts_sentence_worker_service import (
    get_tts_sentence_worker_service,
)


_SECTION = "sentence_audio_auto"
_AUTO_KEY = "auto_start"
_CONCURRENCY_KEY = "concurrency"
_HEARTBEAT_NAME = "tts_sentence_worker"
_LARAVEL_SUMMARY_TTL_S = 30.0
_SUMMARY_STATE_QUEUE = "sentence_audio_auto.summary"
_laravel_summary_cache: Dict[str, Any] = {}
_laravel_summary_ts: float = 0.0
_SUMMARY_STATE_WORKER = SerializedWorkerThread(
    _SUMMARY_STATE_QUEUE,
    "SentenceAudioSummaryStateThread",
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
        summary = get_tts_sentence_worker_service().fetch_queue_summary() or {}
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


def sentence_audio_auto_enabled_on_start(legacy_default: bool) -> bool:
    """Startup gate for the sentence-audio edge-tts worker.

    The heartbeat MUST register with the PERSISTED user intent, not a hardcoded
    Config default (mirrors translation_worker_enabled_on_start). Precedence:
      1. Explicit per-strip toggle present -> its ``auto_start``.
      2. Else the assist plane owns voice -> ``assist_capability_enabled`` (which
         returns ``legacy_default`` when assist was never configured).
    This closes the boot tick-window where the worker could run before
    ``restore_persisted_auto_start`` corrects it.
    """
    section = get_user_data_store().get_section(_SECTION)
    if section is not None:
        return bool(section.get(_AUTO_KEY, False))
    return assist_capability_enabled("sentence_audio", legacy_default)


def restore_persisted_auto_start() -> None:
    """Apply persisted Queue Center auto_start after heartbeat registration.

    When ``assist_laravel`` exists in user_data, voice auto-run is owned by
    Assist → Voice (TTS); skip legacy per-strip toggles here.
    """
    store = get_user_data_store()
    if store.get_section("assist_laravel") is not None:
        ColorPrint.blue("[SentenceAudioAuto] Skipping restore — assist_laravel owns voice workers")
        return
    section = store.get_section(_SECTION)
    if section is None:
        # No persisted toggle: land deterministically OFF rather than inheriting
        # whatever the register-time value happened to be.
        try:
            get_heartbeat_system().disable_callback(_HEARTBEAT_NAME)
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] default-off disable failed ({exc})")
        return

    enabled = bool(section.get(_AUTO_KEY, False))
    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(_HEARTBEAT_NAME)
        else:
            heartbeat.disable_callback(_HEARTBEAT_NAME)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] restore heartbeat failed ({exc})")

    settings = load_assist_settings()
    caps = dict(settings.get("capabilities") or {})
    desired = bool(enabled)
    if caps.get("sentence_audio") != desired:
        caps["sentence_audio"] = desired
        save_assist_settings({**settings, "capabilities": caps})

    ColorPrint.blue(f"[SentenceAudioAuto] Restored auto_start={desired} from user_data")
    try:
        get_tts_sentence_worker_service().set_concurrency(get_config()["concurrency"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] restore concurrency failed ({exc})")
    if not enabled:
        return

    try:
        get_tts_sentence_worker_service().poll_and_process()
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SentenceAudioAuto] restore immediate cycle failed ({exc})")


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


class SentenceEngineWarmThread(threading.Thread):
    """Engine warm-up on its own daemon thread (rule §4: Thread subclass)."""

    def __init__(self) -> None:
        super().__init__(daemon=True, name="sentence-audio-engine-warm")

    def run(self) -> None:
        _warm_sentence_engine()


def apply_auto_start(enabled: bool, concurrency: Optional[int] = None) -> Dict[str, Any]:
    """Persist toggle (+ optional concurrency override) and apply live: heartbeat
    + assist capability. ``concurrency`` None leaves the persisted value
    untouched; 0 means "use the per-engine recommended value"."""
    updates: Dict[str, Any] = {_AUTO_KEY: bool(enabled)}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = get_user_data_store()
    store.update_section(_SECTION, updates)

    if concurrency is not None:
        try:
            get_tts_sentence_worker_service().set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] live concurrency apply failed ({exc})")

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
            worker = get_tts_sentence_worker_service()
            worker.poll_and_process()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] immediate cycle failed ({exc})")
        try:
            SentenceEngineWarmThread().start()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[SentenceAudioAuto] engine warm-up spawn failed ({exc})")

    ColorPrint.blue(f"[SentenceAudioAuto] auto_start set to {bool(enabled)}")
    return get_status()


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    heartbeat_enabled = False
    try:
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
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = get_tts_sentence_worker_service().concurrency_status()
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
