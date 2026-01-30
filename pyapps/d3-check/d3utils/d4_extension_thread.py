#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Extension Thread (D4功能)
Dedicated thread for D4 controller: runs d4_controller.process() every 3s when
exp_farming or debug_window. Replaces timer_manager registration for d4_controller.
"""

import threading
import time
from typing import Optional

from providor.common_imports import ColorPrint
from controller.d4_controller import get_d4_controller
from share.game_interface_data import get_d4_interface_data

D4_TICK_INTERVAL = 3.0


class D4ExtensionThread(threading.Thread):
    """
    Dedicated thread for D4: every 3s calls d4_controller.process() when
    d4_data.is_exp_farming_running() or debug_window_open. Shared data via d4_data (thread-safe).
    """

    def __init__(self):
        super().__init__(daemon=True)
        self._shutdown = threading.Event()
        self._d4_controller = get_d4_controller()
        self._d4_data = get_d4_interface_data()

    def request_shutdown(self) -> None:
        """Request thread exit (app shutdown)."""
        self._shutdown.set()

    def run(self) -> None:
        ColorPrint.blue("[D4ExtensionThread] Started")
        while not self._shutdown.is_set():
            try:
                if self._d4_data.is_exp_farming_running() or self._d4_data.debug_window_open:
                    self._d4_controller.process()
                # Sleep in small steps so shutdown is responsive
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
