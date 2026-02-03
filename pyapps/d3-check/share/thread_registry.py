#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thread Registry - Central owner of all threads (THREAD BUS lifecycle side).

- All thread instances are created and held only here; no dynamic thread creation.
  Main thread references threads only via this registry (get_xxx_thread, start_xxx, etc.).
  No component holds self.xxx_thread.
- All threads start together with UI; execution is driven by global state and tick
  (timer_manager loop). One-shot work (path scan, login check, refresh, battlenet UI
  analyze, window monitor initial check) is submitted to the timer thread via
  timer_manager.submit_one_shot(); no new thread is ever created for these.
- Long-lived threads (extension threads, macro fallback, tray, game_interface_macro):
  registry creates once at startup, stores, and provides getters.
- Inter-thread communication: pycore THREAD_BUS / event_center only; threads do not
  reference each other.
"""

from typing import Any, Callable, Optional

import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
from pycore.pyfoundations.color_print import ColorPrint

from share.threads import do_window_monitor_initial_check
from d3utils.main_function_thread import MainFunctionThread, set_main_function_thread
from d3utils.auxiliary_function_thread import AuxiliaryFunctionThread, set_auxiliary_function_thread
from d3utils.d3_extension_thread import D3ExtensionThread, set_d3_extension_thread
from d3utils.d4_extension_thread import D4ExtensionThread, set_d4_extension_thread


class ThreadRegistry:
    """
    Central registry for all app threads. Only the main thread (controller/initializer)
    should call this; no thread holds references to other threads.
    """

    def __init__(self):
        self._main_function_thread: Optional[MainFunctionThread] = None
        self._auxiliary_function_thread: Optional[AuxiliaryFunctionThread] = None
        self._d3_extension_thread: Optional[D3ExtensionThread] = None
        self._d4_extension_thread: Optional[D4ExtensionThread] = None
        self._macro_loop_thread: Optional[Any] = None
        self._tray_thread: Optional[Any] = None
        self._game_interface_macro_thread: Optional[Any] = None

    def create_extension_threads(
        self,
        schedule: Callable[[Callable], None],
        panel: Any,
        current_skill_config: str = "config1",
    ) -> None:
        """Create and store the four extension threads; start them. Call from main thread once after UI ready."""
        self._main_function_thread = MainFunctionThread(schedule_on_main_thread=schedule)
        self._main_function_thread.set_current_skill_config(current_skill_config)
        self._main_function_thread.start()

        self._auxiliary_function_thread = AuxiliaryFunctionThread()
        self._auxiliary_function_thread.start()

        self._d3_extension_thread = D3ExtensionThread()
        panel.set_d3_extension_thread(self._d3_extension_thread)
        self._d3_extension_thread.start()

        self._d4_extension_thread = D4ExtensionThread()
        self._d4_extension_thread.start()

        set_main_function_thread(self._main_function_thread)
        set_auxiliary_function_thread(self._auxiliary_function_thread)
        set_d3_extension_thread(self._d3_extension_thread)
        set_d4_extension_thread(self._d4_extension_thread)

        ColorPrint.green("[ThreadRegistry] Extension threads created and started")

    def get_main_function_thread(self) -> Optional[MainFunctionThread]:
        return self._main_function_thread

    def get_auxiliary_function_thread(self) -> Optional[AuxiliaryFunctionThread]:
        return self._auxiliary_function_thread

    def get_d3_extension_thread(self) -> Optional[D3ExtensionThread]:
        return self._d3_extension_thread

    def get_d4_extension_thread(self) -> Optional[D4ExtensionThread]:
        return self._d4_extension_thread

    def start_macro_fallback(self, controller: Any) -> None:
        """Start macro fallback thread (when MainFunctionThread not used). Thread class lives in controller module."""
        if self._macro_loop_thread is not None and self._macro_loop_thread.is_alive():
            return
        self._macro_loop_thread = controller.create_macro_fallback_thread()
        self._macro_loop_thread.start()

    def stop_macro_fallback(self) -> None:
        """Join macro fallback thread if running."""
        if self._macro_loop_thread and self._macro_loop_thread.is_alive():
            self._macro_loop_thread.join(timeout=1)
        self._macro_loop_thread = None

    def start_tray(self, tray: Any) -> bool:
        """Start tray (tray is the thread; native class extends Thread). Returns True if started."""
        if self._tray_thread is not None and self._tray_thread.is_alive():
            return True
        self._tray_thread = tray
        tray.start()
        return True

    def start_game_interface_macro(self, controller: Any, skill_config: Any) -> None:
        """Start game interface macro thread. Thread class lives in controller module."""
        if self._game_interface_macro_thread is not None and self._game_interface_macro_thread.is_alive():
            return
        self._game_interface_macro_thread = controller.create_macro_thread(skill_config)
        self._game_interface_macro_thread.start()

    def stop_game_interface_macro(self) -> None:
        """Join game interface macro thread if running."""
        if self._game_interface_macro_thread and self._game_interface_macro_thread.is_alive():
            self._game_interface_macro_thread.join(timeout=2.0)
        self._game_interface_macro_thread = None

    def start_timer_loop_after_ui_ready(self) -> None:
        """Start timer manager loop and run one window monitor check. Call from main thread once after UI ready."""
        if not timer_manager.is_running():
            timer_manager.start()
            ColorPrint.green("[ThreadRegistry] Timer loop started (UI ready)")
        timer_manager.submit_one_shot(do_window_monitor_initial_check)


_registry: Optional[ThreadRegistry] = None


def get_thread_registry() -> ThreadRegistry:
    """Singleton. Only main thread should call this."""
    global _registry
    if _registry is None:
        _registry = ThreadRegistry()
        ColorPrint.blue("[ThreadRegistry] Initialized (central thread owner)")
    return _registry
