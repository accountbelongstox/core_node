#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import threading
from abc import ABC, abstractmethod

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.speech_models import ItemType
from pycore.pyfoundations.speech_queue_ops import TTSQueueOps
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


class BaseTTSWorkerThread(threading.Thread, ABC):
    def __init__(self, thread_id: int, item_type: ItemType, interval: float = 1.0):
        super().__init__(name=f"TTSWorker-{item_type.value}-{thread_id}", daemon=True)
        self._config_signal = f"tts.worker.config.{id(self)}"
        self._stop_signal = f"tts.worker.stop.{id(self)}"
        THREAD_BUS.signal(self._config_signal, {
            "thread_id": thread_id,
            "item_type": item_type,
            "interval": interval,
        })
        THREAD_BUS.clear_signal(self._stop_signal)

    @property
    def thread_id(self) -> int:
        return int(THREAD_BUS.get_signal(self._config_signal, {})["thread_id"])

    @property
    def item_type(self) -> ItemType:
        return THREAD_BUS.get_signal(self._config_signal, {})["item_type"]

    @property
    def interval(self) -> float:
        return float(THREAD_BUS.get_signal(self._config_signal, {})["interval"])

    def run(self) -> None:
        item_type = self.item_type
        interval = self.interval
        THREAD_BUS.set_thread_state(self.name, "starting")
        ColorPrint.blue(f"[TTSWorker] {self.name} started")
        THREAD_BUS.set_thread_state(self.name, "running")

        while not THREAD_BUS.get_signal(self._stop_signal, False):
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow(
                    f"[TTSWorker] {self.name} THREAD_BUS shutdown detected, stopping..."
                )
                break
            try:
                item = self._next_item(item_type, interval)
                if item is not None:
                    self._process_item(item, item_type)
                else:
                    THREAD_BUS.wait_signal(self._stop_signal, timeout=interval)
            except Exception as exc:  # noqa: BLE001
                ColorPrint.red(f"[TTSWorker] {self.name} error: {exc}")
                THREAD_BUS.wait_signal(self._stop_signal, timeout=interval)

        THREAD_BUS.set_thread_state(self.name, "stopped")
        ColorPrint.blue(f"[TTSWorker] {self.name} stopped")

    @staticmethod
    def _next_item(item_type: ItemType, interval: float):
        if item_type == ItemType.DOCUMENT:
            return TTSQueueOps.get_document(timeout=interval)
        if item_type == ItemType.SENTENCE:
            return TTSQueueOps.get_sentence(timeout=interval)
        if item_type == ItemType.WORD:
            return TTSQueueOps.get_word(timeout=interval)
        return None

    def _process_item(self, item, item_type: ItemType) -> None:
        ColorPrint.blue(f"[TTSWorker] Processing {item_type.value}: {item.md5[:8]}...")
        if item_type == ItemType.DOCUMENT:
            self._process_document(item)
        elif item_type == ItemType.SENTENCE:
            self._process_sentence(item)
        elif item_type == ItemType.WORD:
            self._process_word(item)
        TTSQueueOps.mark_completed(item.md5)
        THREAD_BUS.trigger_event("tts.worker.completed", {
            "item_type": item_type.value,
            "item_md5": item.md5,
            "worker_name": self.name,
        }, async_mode=True)

    @abstractmethod
    def _process_document(self, document) -> None:
        raise NotImplementedError

    @abstractmethod
    def _process_sentence(self, sentence) -> None:
        raise NotImplementedError

    @abstractmethod
    def _process_word(self, word) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        THREAD_BUS.signal(self._stop_signal, True)
