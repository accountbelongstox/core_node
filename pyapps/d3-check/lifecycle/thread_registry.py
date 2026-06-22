# -*- coding: utf-8 -*-
"""
Thread Registry - Central owner of all threads. Lives in lifecycle (only place allowed to reference threads).
All thread instances are created and held only here; no dynamic thread creation.
"""

from typing import Any, Callable, Optional

import timers.timer_manager as timer_manager
from pycore.pyfoundations.color_print import ColorPrint

from threads.log_monitor_thread import LogMonitorThread, register_log_monitor_init_handler
from threads.main_function_thread import MainFunctionThread, set_main_function_thread
from threads.auxiliary_function_thread import AuxiliaryFunctionThread, set_auxiliary_function_thread
from threads.d3_extension_thread import D3ExtensionThread, set_d3_extension_thread
from threads.d4_extension_thread import D4ExtensionThread, set_d4_extension_thread
from d3utils.signal_utils import reapply_sigint_sigbreak_ignore_for_gui

_LogMonitorThreadT = Any


class ThreadRegistry:
    """Central registry for all app threads. Only the main thread (controller/initializer) should call this."""

    def __init__(self):
        self._main_function_thread: Optional[MainFunctionThread] = None
        self._auxiliary_function_thread: Optional[AuxiliaryFunctionThread] = None
        self._d3_extension_thread: Optional[D3ExtensionThread] = None
        self._d4_extension_thread: Optional[D4ExtensionThread] = None
        self._macro_loop_thread: Optional[Any] = None
        self._tray_thread: Optional[Any] = None
        self._game_interface_macro_thread: Optional[Any] = None
        self._log_monitor_thread: Optional[_LogMonitorThreadT] = None

    def create_extension_threads(
        self,
        schedule: Callable[[Callable], None],
        panel: Any,
        current_skill_config: str = "config1",
        battlenet_login_check_provider: Optional[Callable[[], bool]] = None,
        d4_process_fn: Optional[Callable[[], None]] = None,
    ) -> None:
        """Create and store the four extension threads; start them. Call from main thread once after UI ready."""
        self._main_function_thread = MainFunctionThread(schedule_on_main_thread=schedule)
        self._main_function_thread.set_current_skill_config(current_skill_config)
        self._main_function_thread.start()

        self._auxiliary_function_thread = AuxiliaryFunctionThread()
        self._auxiliary_function_thread.start()

        self._d3_extension_thread = D3ExtensionThread(battlenet_login_check_provider=battlenet_login_check_provider)
        panel.set_d3_extension_thread(self._d3_extension_thread)
        self._d3_extension_thread.start()

        if d4_process_fn is None:
            raise ValueError("d4_process_fn is required for D4ExtensionThread")
        self._d4_extension_thread = D4ExtensionThread(process_fn=d4_process_fn)
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
        if self._macro_loop_thread is not None and self._macro_loop_thread.is_alive():
            return
        self._macro_loop_thread = controller.create_macro_fallback_thread()
        self._macro_loop_thread.start()

    def stop_macro_fallback(self) -> None:
        if self._macro_loop_thread and self._macro_loop_thread.is_alive():
            self._macro_loop_thread.join(timeout=1)
        self._macro_loop_thread = None

    def start_tray(self, tray: Any) -> bool:
        if self._tray_thread is not None and self._tray_thread.is_alive():
            return True
        self._tray_thread = tray
        tray.start()
        return True

    def start_game_interface_macro(self, controller: Any, skill_config: Any) -> None:
        if self._game_interface_macro_thread is not None and self._game_interface_macro_thread.is_alive():
            return
        self._game_interface_macro_thread = controller.create_macro_thread(skill_config)
        self._game_interface_macro_thread.start()

    def stop_game_interface_macro(self) -> None:
        if self._game_interface_macro_thread and self._game_interface_macro_thread.is_alive():
            self._game_interface_macro_thread.join(timeout=2.0)
        self._game_interface_macro_thread = None

    def start_log_monitor(self, log_file_path: str) -> None:
        if self._log_monitor_thread is not None and self._log_monitor_thread.is_alive():
            return
        register_log_monitor_init_handler()
        self._log_monitor_thread = LogMonitorThread(log_file_path)
        self._log_monitor_thread.start()
        ColorPrint.green("[ThreadRegistry] LogMonitorThread started")

    def get_log_monitor_thread(self) -> Optional[_LogMonitorThreadT]:
        return self._log_monitor_thread

    def stop_log_monitor(self) -> None:
        if self._log_monitor_thread is None:
            return
        if self._log_monitor_thread.is_alive():
            self._log_monitor_thread.request_stop()
            self._log_monitor_thread.join(timeout=5.0)
        self._log_monitor_thread = None

    def start_timer_loop_after_ui_ready(self) -> None:
        from timers.one_shot_tasks import do_window_monitor_initial_check
        reapply_sigint_sigbreak_ignore_for_gui()
        do_window_monitor_initial_check()
        if not timer_manager.is_running():
            timer_manager.start()
            ColorPrint.green("[ThreadRegistry] Timer loop started (UI ready)")
        timer_manager.submit_one_shot(do_window_monitor_initial_check)


_registry: Optional[ThreadRegistry] = None


def get_thread_registry() -> ThreadRegistry:
    global _registry
    if _registry is None:
        _registry = ThreadRegistry()
        ColorPrint.blue("[ThreadRegistry] Initialized (central thread owner)")
    return _registry
