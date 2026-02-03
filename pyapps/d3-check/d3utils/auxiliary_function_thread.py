#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary Function Thread (auxiliary function).
Dedicated thread for auxiliary tasks. Command queue: shutdown.
Placeholder loop; can run periodic lightweight tasks later.
"""

import queue
import threading
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint

from providor.app_constants import CMD_SHUTDOWN


class AuxiliaryFunctionThread(threading.Thread):
    """
    Dedicated thread for auxiliary function.
    Waits for commands; on shutdown exits. Shared data via CONFIG (thread-safe).
    """

    def __init__(self):
        super().__init__(daemon=True)
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()

    def put_command(self, cmd: str) -> None:
        """Send command (call from main thread)."""
        self._command_queue.put(cmd)

    def request_shutdown(self) -> None:
        """Request thread exit (app shutdown)."""
        self._shutdown.set()
        self._command_queue.put(CMD_SHUTDOWN)

    def run(self) -> None:
        ColorPrint.blue("[AuxiliaryFunctionThread] Started")
        while not self._shutdown.is_set():
            try:
                try:
                    cmd = self._command_queue.get(timeout=0.2)
                except queue.Empty:
                    continue
                if cmd == CMD_SHUTDOWN:
                    break
            except Exception:
                pass
        ColorPrint.yellow("[AuxiliaryFunctionThread] Stopped")


_instance: Optional[AuxiliaryFunctionThread] = None


def get_auxiliary_function_thread() -> Optional[AuxiliaryFunctionThread]:
    return _instance


def set_auxiliary_function_thread(thread: Optional[AuxiliaryFunctionThread]) -> None:
    global _instance
    _instance = thread
