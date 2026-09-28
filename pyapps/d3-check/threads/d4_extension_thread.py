#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Extension Thread (D4 extension).
Runs injected process callable every 3s when exp_farming or debug_window. No controller import.
"""

import threading
import time
from typing import Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from share.game_interface_data import get_d4_interface_data

from providor.constants.d4 import D4_TICK_INTERVAL


class D4ExtensionThread(threading.Thread):
    """Dedicated thread for D4: every 3s calls process_fn() when exp_farming or debug_window_open."""

    def __init__(self, process_fn: Callable[[], None]):
        threading.Thread.__init__(self, daemon=True)
        self._shutdown = threading.Event()
        self._process_fn = process_fn
        self._d4_data = get_d4_interface_data()

    def request_shutdown(self) -> None:
        self._shutdown.set()

    def run(self) -> None:
        ColorPrint.blue("[D4ExtensionThread] Started")
        while not self._shutdown.is_set():
            try:
                if self._d4_data.is_exp_farming_running() or self._d4_data.debug_window_open:
                    self._process_fn()
                for _ in range(int(D4_TICK_INTERVAL * 10)):
                    if self._shutdown.is_set():
                        break
                    time.sleep(0.1)
            except Exception as e:
                ColorPrint.red(f"[D4ExtensionThread] Error: {e}")
                time.sleep(1)
        ColorPrint.yellow("[D4ExtensionThread] Stopped")


_instance: Optional[D4ExtensionThread] = None


def get_d4_extension_thread() -> Optional[D4ExtensionThread]:
    return _instance


def set_d4_extension_thread(thread: Optional[D4ExtensionThread]) -> None:
    global _instance
    _instance = thread
