#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Function Thread (main function / macro).
Dedicated thread for macro loop: skill execution when started.
Commands: start_macro, stop_macro, shutdown. Config read via get_config_value_safe (queue).
"""

import logging
import queue
import threading
import time
from typing import Callable, Optional

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import get_config_value_safe
from providor.constants.common import CMD_START_MACRO, CMD_STOP_MACRO, CMD_SHUTDOWN
from share.game_interface_data import get_game_interface_data
from d3utils.macro_config_ops import run_one_skill_tick, refresh_d3_window_cache, clear_d3_window_cache


class MainFunctionThread(threading.Thread):
    """
    Dedicated thread for main function (macro loop).
    UI sends start_macro/stop_macro; completion reported via schedule_on_main_thread.
    """

    def __init__(
        self,
        schedule_on_main_thread: Callable[[Callable], None],
        on_macro_started: Optional[Callable[[], None]] = None,
        on_macro_stopped: Optional[Callable[[], None]] = None,
    ):
        threading.Thread.__init__(self, daemon=True)
        self._schedule = schedule_on_main_thread
        self._on_macro_started = on_macro_started
        self._on_macro_stopped = on_macro_stopped
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()
        self._macro_running = False
        self._d3_cache_refreshed = False
        self._current_skill_config = "config1"
        self._last_skill_times: dict = {}
        self._log = logging.getLogger(__name__)

    def put_command(self, cmd: str) -> None:
        self._command_queue.put(cmd)

    def request_shutdown(self) -> None:
        self._shutdown.set()
        self._macro_running = False
        self._command_queue.put(CMD_SHUTDOWN)

    def set_current_skill_config(self, config_name: str) -> None:
        self._current_skill_config = config_name

    def run(self) -> None:
        ColorPrint.blue("[MainFunctionThread] Started")
        while not self._shutdown.is_set():
            try:
                try:
                    cmd = self._command_queue.get(timeout=0.1)
                except queue.Empty:
                    if self._macro_running:
                        self._macro_loop_once()
                    continue
                if cmd == CMD_SHUTDOWN:
                    break
                if cmd == CMD_START_MACRO:
                    self._macro_running = True
                    self._schedule(lambda: self._on_macro_started and self._on_macro_started())
                elif cmd == CMD_STOP_MACRO:
                    self._macro_running = False
                    self._d3_cache_refreshed = False
                    clear_d3_window_cache()
                    self._schedule(lambda: self._on_macro_stopped and self._on_macro_stopped())
            except Exception as e:
                self._log.error("MainFunctionThread: %s", e)
                time.sleep(1)
        self._macro_running = False
        ColorPrint.yellow("[MainFunctionThread] Stopped")

    def _macro_loop_once(self) -> None:
        """One iteration of macro loop: send keys to D3 per current config (interval/delay/strategy)."""
        try:
            hwnd = get_game_interface_data()._window_hwnd
            if not hwnd:
                time.sleep(0.1)
                return
            if not self._d3_cache_refreshed:
                refresh_d3_window_cache(hwnd)
                self._d3_cache_refreshed = True
            skill_config = get_config_value_safe(
                f"macro_configs.skill_configs.{self._current_skill_config}", {}
            ) or {}
            auxiliary_config = get_config_value_safe("macro_configs.auxiliary_config") or {}
            config = {**skill_config, **auxiliary_config}
            self._last_skill_times = run_one_skill_tick(hwnd, config, self._last_skill_times)
            time.sleep(0.1)
        except Exception as e:
            self._log.error("Macro loop: %s", e)
            time.sleep(1)


_instance: Optional[MainFunctionThread] = None


def get_main_function_thread() -> Optional[MainFunctionThread]:
    return _instance


def set_main_function_thread(thread: Optional[MainFunctionThread]) -> None:
    global _instance
    _instance = thread
