# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for TTS word/sentence workers and sentence queue monitor.

Shared by callmodule_main_entry (native_ui path) and event_handlers
(pycore_module_caller path).
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat.heartbeat import get_heartbeat_system
from pycore.callmodule.callmodule_config.config import Config
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.callmodule.services.tts_sentence_worker_service import get_tts_sentence_worker_service
from pycore.callmodule.services.sentence_audio_auto import (
    restore_persisted_auto_start as restore_sentence_audio_auto_start,
    sentence_audio_auto_enabled_on_start,
)
from pycore.callmodule.services.sentence_queue_monitor_service import (
    get_sentence_queue_monitor_service,
)
from pycore.callmodule.services.word_tts_auto import (
    restore_persisted_auto_start as restore_word_tts_auto_start,
)


def register_tts_queue_poller() -> None:
    """Register the TTS word-generation queue worker callback (idempotent)."""
    heartbeat = get_heartbeat_system()
    poller = get_tts_queue_poller_service()
    heartbeat.register_callback(
        name="tts_queue_poller",
        callback=poller.poll_and_process,
        interval=Config.TTS_WORKER_INTERVAL,
        enabled=Config.TTS_WORKER_ENABLED_ON_START,
    )
    ColorPrint.green("[Callmodule] Registered TTS queue worker callback")
    ColorPrint.blue("  - Callback name: tts_queue_poller")
    ColorPrint.blue(f"  - Interval: {Config.TTS_WORKER_INTERVAL} seconds")
    ColorPrint.blue(
        f"  - Initial state: "
        f"{'enabled' if Config.TTS_WORKER_ENABLED_ON_START else 'disabled'}"
    )
    ColorPrint.blue(f"  - Batch size: {Config.TTS_WORKER_BATCH}")
    ColorPrint.blue("  - UI control: RPC v2 ui.heartbeat_workers.config")
    restore_word_tts_auto_start()


def register_tts_sentence_worker() -> None:
    """Register the TTS sentence-audio worker callback (idempotent)."""
    heartbeat = get_heartbeat_system()
    worker = get_tts_sentence_worker_service()
    # Register with the PERSISTED user intent (UI toggle / assist plane), not the
    # hardcoded Config default — the env flag is only the legacy fallback. This is
    # what makes edge-tts auto-run a UI setting instead of a backend hardcode.
    enabled_on_start = sentence_audio_auto_enabled_on_start(
        Config.TTS_SENTENCE_WORKER_ENABLED_ON_START
    )
    heartbeat.register_callback(
        name="tts_sentence_worker",
        callback=worker.poll_and_process,
        interval=Config.TTS_SENTENCE_WORKER_INTERVAL,
        enabled=enabled_on_start,
    )
    ColorPrint.green("[Callmodule] Registered TTS sentence-audio worker callback")
    ColorPrint.blue("  - Callback name: tts_sentence_worker")
    ColorPrint.blue(f"  - Interval: {Config.TTS_SENTENCE_WORKER_INTERVAL} seconds")
    ColorPrint.blue(
        f"  - Initial state: "
        f"{'enabled' if enabled_on_start else 'disabled'}"
    )
    ColorPrint.blue(f"  - Batch size: {Config.TTS_SENTENCE_WORKER_BATCH}")
    ColorPrint.blue("  - UI control: RPC v2 ui.heartbeat_workers.config")
    restore_sentence_audio_auto_start()


def register_sentence_queue_monitor() -> None:
    """Register sentence-audio queue monitor (missing rows + priority bumps)."""
    heartbeat = get_heartbeat_system()
    monitor = get_sentence_queue_monitor_service(
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )
    heartbeat.register_callback(
        name="sentence_queue_monitor",
        callback=monitor.poll_once,
        interval=Config.TRANSLATION_QUEUE_MONITOR_INTERVAL,
        enabled=Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START,
    )
    ColorPrint.green("[Callmodule] Registered sentence queue monitor callback")
    ColorPrint.blue("  - Callback name: sentence_queue_monitor")
    ColorPrint.blue(f"  - Interval: {Config.TRANSLATION_QUEUE_MONITOR_INTERVAL} seconds")
