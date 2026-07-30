# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for TTS word/sentence workers and sentence queue monitor.

Shared by callmodule_main_entry (native_ui path) and event_handlers
(pycore_module_caller path).
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states
from pycore.pyutils.common.service_config import (
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    TRANSLATION_QUEUE_MONITOR_INTERVAL,
    TTS_SENTENCE_WORKER_BATCH,
    TTS_SENTENCE_WORKER_INTERVAL,
    TTS_WORKER_BATCH,
    TTS_WORKER_INTERVAL,
)
from pycore.pyctl.tts.word_queue_poller_service import tts_queue_poller_service
from pycore.pyctl.tts.sentence_worker_service import tts_sentence_worker_service
from pycore.pyctl.tts.sentence_audio_auto import (
    restore_persisted_auto_start as restore_sentence_audio_auto_start,
)
from pycore.pyctl.tts.sentence_queue_monitor_service import (
    sentence_queue_monitor_service,
)
from pycore.pyctl.tts.word_tts_auto import (
    restore_persisted_auto_start as restore_word_tts_auto_start,
)


def register_tts_queue_poller() -> None:
    """Register the TTS word-generation queue worker callback (idempotent)."""
    heartbeat = shared_heartbeat_system
    poller = tts_queue_poller_service
    enabled_on_start = assist_callback_states()["tts_queue_poller"]
    heartbeat.register_callback(
        name="tts_queue_poller",
        callback=poller.poll_and_process,
        interval=TTS_WORKER_INTERVAL,
        enabled=enabled_on_start,
    )
    ColorPrint.green("[Callmodule] Registered TTS queue worker callback")
    ColorPrint.blue("  - Callback name: tts_queue_poller")
    ColorPrint.blue(f"  - Interval: {TTS_WORKER_INTERVAL} seconds")
    ColorPrint.blue(
        f"  - Initial state: "
        f"{'enabled' if enabled_on_start else 'disabled'} (user settings)"
    )
    ColorPrint.blue(f"  - Batch size: {TTS_WORKER_BATCH}")
    ColorPrint.blue("  - UI control: RPC v2 ui.heartbeat_workers.config")
    restore_word_tts_auto_start()


def register_tts_sentence_worker() -> None:
    """Register the TTS sentence-audio worker callback (idempotent)."""
    heartbeat = shared_heartbeat_system
    worker = tts_sentence_worker_service
    enabled_on_start = assist_callback_states()["tts_sentence_worker"]
    heartbeat.register_callback(
        name="tts_sentence_worker",
        callback=worker.poll_and_process,
        interval=TTS_SENTENCE_WORKER_INTERVAL,
        enabled=enabled_on_start,
    )
    ColorPrint.green("[Callmodule] Registered TTS sentence-audio worker callback")
    ColorPrint.blue("  - Callback name: tts_sentence_worker")
    ColorPrint.blue(f"  - Interval: {TTS_SENTENCE_WORKER_INTERVAL} seconds")
    ColorPrint.blue(
        f"  - Initial state: "
        f"{'enabled' if enabled_on_start else 'disabled'} (user settings)"
    )
    ColorPrint.blue(f"  - Batch size: {TTS_SENTENCE_WORKER_BATCH}")
    ColorPrint.blue("  - UI control: RPC v2 ui.heartbeat_workers.config")
    restore_sentence_audio_auto_start()


def register_sentence_queue_monitor() -> None:
    """Register sentence-audio queue monitor (missing rows + priority bumps)."""
    heartbeat = shared_heartbeat_system
    monitor = sentence_queue_monitor_service
    enabled_on_start = assist_callback_states()["sentence_queue_monitor"]
    heartbeat.register_callback(
        name="sentence_queue_monitor",
        callback=monitor.poll_once,
        interval=TRANSLATION_QUEUE_MONITOR_INTERVAL,
        enabled=enabled_on_start,
    )
    ColorPrint.green("[Callmodule] Registered sentence queue monitor callback")
    ColorPrint.blue("  - Callback name: sentence_queue_monitor")
    ColorPrint.blue(f"  - Interval: {TRANSLATION_QUEUE_MONITOR_INTERVAL} seconds")
    ColorPrint.blue(
        f"  - Initial state: {'enabled' if enabled_on_start else 'disabled'} (user settings)"
    )
