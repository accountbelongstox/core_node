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
from providor.app_constants import CMD_START_MACRO, CMD_STOP_MACRO, CMD_SHUTDOWN


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
        super().__init__(daemon=True)
        self._schedule = schedule_on_main_thread
        self._on_macro_started = on_macro_started
        self._on_macro_stopped = on_macro_stopped
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()
        self._macro_running = False
        self._current_skill_config = "config1"
        self._log = logging.getLogger(__name__)

    def put_command(self, cmd: str) -> None:
        """Send command (call from main thread / UI)."""
        self._command_queue.put(cmd)

    def request_shutdown(self) -> None:
        """Request thread exit (app shutdown)."""
        self._shutdown.set()
        self._macro_running = False
        self._command_queue.put(CMD_SHUTDOWN)

    def set_current_skill_config(self, config_name: str) -> None:
        """Set current skill config name (thread-safe, called from main)."""
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
                    try:
                        self._schedule(lambda: self._on_macro_started and self._on_macro_started())
                    except Exception:
                        pass
                elif cmd == CMD_STOP_MACRO:
                    self._macro_running = False
                    try:
                        self._schedule(lambda: self._on_macro_stopped and self._on_macro_stopped())
                    except Exception:
                        pass
            except Exception as e:
                self._log.error("MainFunctionThread: %s", e)
                time.sleep(1)
        self._macro_running = False
        ColorPrint.yellow("[MainFunctionThread] Stopped")

    def _macro_loop_once(self) -> None:
        """One iteration of macro loop (skill execution)."""
        try:
            skill_config = get_config_value_safe(
                f"macro_configs.skill_configs.{self._current_skill_config}", {}
            ) or {}
            auxiliary_config = get_config_value_safe("macro_configs.auxiliary_config") or {}
            config = {**skill_config, **auxiliary_config}
            skills = config.get("skills", {})

            for skill_name, sc in skills.items():
                if not self._macro_running or self._shutdown.is_set():
                    break
                if sc.get("strategy") == "禁用":  # Disabled (CN config value)
                    continue
                self._execute_skill(skill_name, sc)
                time.sleep(0.01)
            time.sleep(0.1)
        except Exception as e:
            self._log.error("Macro loop: %s", e)
            time.sleep(1)

    def _execute_skill(self, skill_name: str, skill_config: dict) -> None:
        """Execute a single skill (placeholder)."""
        self._log.debug(
            "Executing %s: %s - Key: %s",
            skill_name,
            skill_config.get("strategy"),
            skill_config.get("key"),
        )


_instance: Optional[MainFunctionThread] = None


def get_main_function_thread() -> Optional[MainFunctionThread]:
    return _instance


def set_main_function_thread(thread: Optional[MainFunctionThread]) -> None:
    global _instance
    _instance = thread
