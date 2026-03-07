#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Initializer
Handles system-wide initialization including configuration, hotkeys, and signal handling.
Ctrl+C (signal or global hotkey) only triggers exit when the current app's console window is foreground.
"""

import ctypes
import os
import platform
import signal
import sys
import threading
from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.hotkey_listener import HotkeyListener, get_global_hotkey_listener
from providor.providor_index import CONFIG, get_config_section, initialize_config, LOGS_FILE_PATH

import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
from d3utils import event_center, log_line_bridge
from d3utils.cnocr_engine_registry import ensure_cnocr_loaded_and_engines_initialized
from d3utils.shutdown_manager import (
    is_shutdown_requested,
    register_hotkey_listener,
    register_shutdown_hook,
)
from d3utils.d3u_common.hotkey_registry import initialize_hotkeys, unregister_all_auxiliary_hotkeys

register_shutdown_hook(unregister_all_auxiliary_hotkeys)
from d3utils.signal_utils import (
    set_gui_mode_sigint_ignored,
    _reapply_sigint_sigbreak_ignore,
)
from runtime import get_thread_registry, get_task_manager, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor

def _is_console_foreground() -> bool:
    """True if the current process console (CMD) is the foreground window, or no console. Only then allow Ctrl+C to exit."""
    if platform.system() != "win32":
        return True
    try:
        kernel32 = ctypes.windll.kernel32
        user32 = ctypes.windll.user32
        console_hwnd = kernel32.GetConsoleWindow()
        if not console_hwnd:
            return True
        foreground_hwnd = user32.GetForegroundWindow()
        return bool(foreground_hwnd and console_hwnd == foreground_hwnd)
    except Exception:
        return True


class SystemInitializer:
    """System-wide initialization manager"""

    def __init__(self):
        """Initialize the system initializer"""
        self.initialized = False
        self.hotkey_listener = None
        self.timer_initialized = False

    def _signal_handler(self, signum, frame):
        """Handle system signals (Ctrl+C, etc.); only exit when our console is foreground."""
        if not _is_console_foreground():
            return
        if not is_shutdown_requested():
            ColorPrint.yellow(f"[SYSTEM] Received signal {signum}, requesting shutdown...")
        event_center.trigger_app_exit()

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        # Handle Ctrl+C (SIGINT) and SIGTERM
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        # On Windows, also handle SIGBREAK
        if hasattr(signal, 'SIGBREAK'):
            signal.signal(signal.SIGBREAK, self._signal_handler)

        ColorPrint.blue("[SYSTEM] Signal handlers registered for graceful shutdown")

    def _setup_ctrl_c_hotkey(self):
        """Setup Ctrl+C hotkey using hotkey_listener"""
        self.hotkey_listener = get_global_hotkey_listener()

        # Register to shutdown manager
        register_hotkey_listener(self.hotkey_listener)

        # Register Ctrl+C hotkey
        success = self.hotkey_listener.register_hotkey(
            hotkey="ctrl+c",
            callback=self._on_ctrl_c_pressed,
            description="System shutdown hotkey",
            priority=100,  # High priority
            enabled=True
        )

        if success:
            # Start listening for hotkeys
            if self.hotkey_listener.start_listening():
                ColorPrint.blue("[SYSTEM] Ctrl+C hotkey registered and listening started")
                return True
            else:
                ColorPrint.red("[SYSTEM] Failed to start hotkey listening")
                return False
        else:
            ColorPrint.red("[SYSTEM] Failed to register Ctrl+C hotkey")
            return False

    def _on_ctrl_c_pressed(self):
        """Handle Ctrl+C hotkey press: only exit when our console (CMD) is the foreground window."""
        if not _is_console_foreground():
            return
        if is_shutdown_requested():
            return
        ColorPrint.yellow("[SYSTEM] Ctrl+C hotkey pressed, requesting shutdown...")
        event_center.trigger_app_exit()

    def initialize_configuration(self):
        """Initialize system configuration"""
        ColorPrint.blue("[INIT] Initializing system configuration...")
        initialize_config()
        ColorPrint.green("[INIT] Configuration initialized successfully")
        return True

    def initialize_timer_system(self):
        """
        Initialize timer system.

        Two drivers:
        - timer_manager: single-thread loop. State detection (window_monitor)
          is NOT registered here; when UI Start is used, status is updated by tick-driven flow (rosbot_task).
          Loop started after UI ready (start_timer_loop_after_ui_ready).
        - task_thread_manager: one thread per task; rosbot_task (1s) drives ROSBOT flow (ROSBOT_FLOW.md)
          and, when flow master on, refreshes D3/Battle.net state every 2s for status UI.
          Task threads start here; rosbot_task enabled/disabled by flow master (start/stop).

        Note: Timer system can only be initialized once. Multiple calls are ignored.

        Returns:
            True if initialized successfully or already initialized, False on error.
        """
        if self.timer_initialized:
            ColorPrint.yellow("[INIT] Timer system already initialized")
            return True

        ColorPrint.blue("[INIT] Initializing timer system...")

        # Initialize task thread manager
        self._init_task_thread_manager()

        # State detection (window_monitor): driven by tick_driver tick % 10 -> refresh_window_status_if_inactive.

        # Log monitor: native thread via ThreadRegistry; BUS only; watchdog via pycore third_party
        log_line_bridge.register()
        get_thread_registry().start_log_monitor(LOGS_FILE_PATH)

        # D4 controller runs in D4ExtensionThread (started after UI ready), not in timer_manager

        # Do NOT start timer loop here: start after UI is ready so status UI receives updates only when widgets exist (see start_timer_loop_after_ui_ready).

        self.timer_initialized = True
        ColorPrint.green("[INIT] Timer system initialized (loop will start after UI ready)")
        return True

    def _init_task_thread_manager(self):
        """Initialize task thread manager. Register+start+status in one synchronous sequence to avoid thread.__init__() race."""
        ColorPrint.blue("[INIT] Initializing task thread manager...")
        # Unified tick: 1s from rosbot_task; synchronous so task is fully constructed before start()
        ok = get_task_manager().register_and_start_task(
            name='rosbot_task',
            task_func=rosbot_processor.process_rosbot_task,
            interval=1.0,
            initial_status=TaskStatus.ENABLED,
        )
        if not ok:
            raise RuntimeError("rosbot_task already registered or register_and_start_task failed")
        ColorPrint.green("[INIT] Task thread manager initialized successfully")

    def initialize_system(self, gui_mode: bool = False):
        """
        Initialize the entire system.

        gui_mode: If True (GUI start), do not register SIGINT/Ctrl+C for exit;
                  exit only via UI. If False (bridge/tray), register Ctrl+C and show prompt.
        """
        if self.initialized:
            ColorPrint.yellow("[INIT] System already initialized")
            return True

        try:
            ColorPrint.blue("[INIT] Starting system initialization...")

            if not gui_mode:
                # Setup signal handlers and Ctrl+C hotkey only when not in UI mode (bridge/tray)
                self._setup_signal_handlers()
                if not self._setup_ctrl_c_hotkey():
                    ColorPrint.yellow("[INIT] Ctrl+C hotkey setup failed")
            # GUI mode: do not register any Ctrl+C handler or hotkey (handled at end of init after all imports)

            # Initialize configuration
            if not self.initialize_configuration():
                return False

            # CnOCR: load/install once and pre-init all engines (general/number/document)
            if get_config_section("log_settings").get("show_debug_logs", False):
                os.environ["PYCORE_CNOCR_DEBUG"] = "1"
            if not ensure_cnocr_loaded_and_engines_initialized():
                ColorPrint.yellow("[INIT] CnOCR load/init skipped or failed, OCR features may be limited")

            # Windows: report native OCR (WinRT) availability (optional; app uses CnOCR for recognition)
            if platform.system() == "win32":
                try:
                    from pycore.pyfoundations.third_party import get_third_package_windows_ocr
                    if get_third_package_windows_ocr() is not None:
                        ColorPrint.blue("[INIT] Windows OCR (WinRT) available (optional)")
                    else:
                        ColorPrint.gray("[INIT] Windows OCR (WinRT) not available (optional)")
                except Exception:
                    ColorPrint.gray("[INIT] Windows OCR (WinRT) not loaded (optional)")

            # Initialize hotkeys
            if not initialize_hotkeys():
                ColorPrint.yellow("[INIT] Hotkey initialization had issues, but continuing...")

            # Initialize timer system
            if not self.initialize_timer_system():
                ColorPrint.yellow("[INIT] Timer system initialization failed, but continuing...")

            # GUI mode: ignore SIGINT/SIGBREAK; tick_driver tick % 1 resets every 1s (avoid Fortran/numpy override)
            if gui_mode:
                set_gui_mode_sigint_ignored(True)
                signal.signal(signal.SIGINT, signal.SIG_IGN)
                if hasattr(signal, "SIGBREAK"):
                    signal.signal(signal.SIGBREAK, signal.SIG_IGN)
                ColorPrint.blue("[INIT] GUI mode: Ctrl+C ignored (close via UI only)")

            self.initialized = True
            ColorPrint.green("[INIT] System initialization completed successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[INIT] System initialization failed: {e}")
            return False

    def request_shutdown(self):
        """Request application shutdown; dispatched to main thread via event center."""
        event_center.trigger_app_exit()

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return is_shutdown_requested()

    def start_timer_loop_after_ui_ready(self):
        """Start the timer loop and run one window check. Delegates to ThreadRegistry (central thread owner)."""
        get_thread_registry().start_timer_loop_after_ui_ready()

    def register_ui_instance(self, ui_instance):
        """
        Register UI instance for window monitoring
        (UI is registered in share.ui_registry on creation)

        Args:
            ui_instance: UI instance

        Returns:
            True if registered successfully, False otherwise
        """
        # Register window status callback to window monitor (static global)
        callback = ui_instance.get_window_status_callback()
        window_monitor.add_callback(callback)
        ColorPrint.green("[SYSTEM] UI callback registered to window_monitor")

        ColorPrint.green("[SYSTEM] UI instance registered to system")
        return True

# Global system initializer instance
_system_initializer: Optional[SystemInitializer] = None


def get_system_initializer() -> SystemInitializer:
    """Get the global system initializer instance (singleton)"""
    global _system_initializer
    if _system_initializer is None:
        _system_initializer = SystemInitializer()
    return _system_initializer
