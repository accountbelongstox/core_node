#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Base THREAD_BUS-driven worker for queued TTS items."""

import threading
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.tts_models import ItemType
from pycore.pyutils.common.tts_queue_ops import TTSQueueOps


def initialize_tts_worker(
    worker: threading.Thread,
    thread_id: int,
    item_type: ItemType,
    interval: float,
) -> None:
    """Publish immutable worker startup data through THREAD_BUS."""
    worker._config_signal = f"tts.worker.config.{id(worker)}"
    worker._stop_signal = f"tts.worker.stop.{id(worker)}"
    THREAD_BUS.signal(worker._config_signal, {
        "thread_id": thread_id,
        "item_type": item_type,
        "interval": interval,
    })
    THREAD_BUS.clear_signal(worker._stop_signal)


def _process_tts_item(worker: threading.Thread, item, item_type: ItemType) -> None:
    ColorPrint.blue(f"[TTSWorker] Processing {item_type.value}: {item.md5[:8]}...")
    if item_type == ItemType.DOCUMENT:
        worker._process_document(item)
    elif item_type == ItemType.SENTENCE:
        worker._process_sentence(item)
    elif item_type == ItemType.WORD:
        worker._process_word(item)
    TTSQueueOps.mark_completed(item.md5)
    THREAD_BUS.trigger_event("tts.worker.completed", {
        "item_type": item_type.value,
        "item_md5": item.md5,
        "worker_name": worker.name,
    }, async_mode=True)


def run_tts_worker(worker: threading.Thread) -> None:
    """Run a TTS worker whose configuration is owned by THREAD_BUS."""
    config = THREAD_BUS.get_signal(worker._config_signal, {}) or {}
    item_type = config["item_type"]
    interval = float(config["interval"])
    THREAD_BUS.set_thread_state(worker.name, "starting")
    ColorPrint.blue(f"[TTSWorker] {worker.name} started")
    THREAD_BUS.set_thread_state(worker.name, "running")

    while not THREAD_BUS.get_signal(worker._stop_signal, False):
        if THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow(
                f"[TTSWorker] {worker.name} THREAD_BUS shutdown detected, stopping..."
            )
            break
        try:
            if item_type == ItemType.DOCUMENT:
                item = TTSQueueOps.get_document(timeout=interval)
            elif item_type == ItemType.SENTENCE:
                item = TTSQueueOps.get_sentence(timeout=interval)
            elif item_type == ItemType.WORD:
                item = TTSQueueOps.get_word(timeout=interval)
            else:
                item = None
            if item:
                _process_tts_item(worker, item, item_type)
            else:
                THREAD_BUS.wait_signal(worker._stop_signal, timeout=interval)
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[TTSWorker] {worker.name} error: {exc}")
            THREAD_BUS.wait_signal(worker._stop_signal, timeout=interval)

    THREAD_BUS.set_thread_state(worker.name, "stopped")
    ColorPrint.blue(f"[TTSWorker] {worker.name} stopped")


class BaseTTSWorkerThread(threading.Thread):
    """Process one TTS queue lane with startup data delivered by THREAD_BUS."""

    def __init__(self, thread_id: int, item_type: ItemType, interval: float = 1.0):
        super().__init__(name=f"TTSWorker-{item_type.value}-{thread_id}", daemon=True)
        initialize_tts_worker(self, thread_id, item_type, interval)

    @property
    def thread_id(self) -> int:
        return int(THREAD_BUS.get_signal(self._config_signal, {})["thread_id"])

    @property
    def item_type(self) -> ItemType:
        return THREAD_BUS.get_signal(self._config_signal, {})["item_type"]

    @property
    def interval(self) -> float:
        return float(THREAD_BUS.get_signal(self._config_signal, {})["interval"])

    def run(self):
        run_tts_worker(self)

    def _process_item(self, item):
        _process_tts_item(self, item, self.item_type)

    def _process_document(self, document):
        pass

    def _process_sentence(self, sentence):
        pass

    def _process_word(self, word):
        pass

    def stop(self):
        THREAD_BUS.signal(self._stop_signal, True)
