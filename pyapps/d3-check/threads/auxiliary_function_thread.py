#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary Function Thread (auxiliary function).
Dedicated thread for auxiliary tasks. Command queue: shutdown.
"""

import queue
import threading
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from providor.constants.common import CMD_SHUTDOWN


class AuxiliaryFunctionThread(threading.Thread):
    """Dedicated thread for auxiliary function. Waits for commands; on shutdown exits."""

    def __init__(self):
        threading.Thread.__init__(self, daemon=True)
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()

    def put_command(self, cmd: str) -> None:
        self._command_queue.put(cmd)

    def request_shutdown(self) -> None:
        self._shutdown.set()
        self._command_queue.put(CMD_SHUTDOWN)

    def run(self) -> None:
        ColorPrint.blue("[AuxiliaryFunctionThread] Started")
        while not self._shutdown.is_set():
            try:
                cmd = self._command_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            if cmd == CMD_SHUTDOWN:
                break
        ColorPrint.yellow("[AuxiliaryFunctionThread] Stopped")


_instance: Optional[AuxiliaryFunctionThread] = None


def get_auxiliary_function_thread() -> Optional[AuxiliaryFunctionThread]:
    return _instance


def set_auxiliary_function_thread(thread: Optional[AuxiliaryFunctionThread]) -> None:
    global _instance
    _instance = thread
