#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shutdown Manager - Unified Application Shutdown Controller
Handles all application shutdown logic in a single place
"""

import os
import sys
import time
import threading
from typing import Callable, List, Optional

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from share.ui_registry import get_ui

import timers.timer_manager as timer_manager
from pycore.pyutils.hotkey.global_hotkey_listener import HotkeyListener
from d3utils.event_signals import trigger_extension_shutdown

# Global hotkey listener reference
_hotkey_listener: Optional[HotkeyListener] = None

# Hooks run during execute_shutdown (step 2). Modules like rosbot_flow_battlenet register here.
_shutdown_hooks: List[Callable[[], None]] = []

# Stop log watcher: registered by system_initializer (avoids importing log_monitor here and circular import).
_stop_log_watching_fn: Optional[Callable[[], None]] = None

# Thread-shutdown runner: registered by lifecycle (only main/event bus import lifecycle; utils must not reference threads).
_shutdown_runner: Optional[Callable[[], None]] = None


def register_shutdown_runner(fn: Callable[[], None]) -> None:
    """Register the thread-shutdown sequence (join threads + stop task manager). Called by lifecycle on import."""
    global _shutdown_runner
    _shutdown_runner = fn


def register_stop_log_watching(fn: Callable[[], None]) -> None:
    """Register callable to stop log file watcher on shutdown. Called by system_initializer."""
    global _stop_log_watching_fn
    _stop_log_watching_fn = fn


def register_shutdown_hook(hook: Callable[[], None]) -> None:
    """Register a callable to run during execute_shutdown (e.g. reset BN flow state)."""
    if hook not in _shutdown_hooks:
        _shutdown_hooks.append(hook)

# Global shutdown events
_shutdown_requested = threading.Event()
_restart_requested = threading.Event()
_shutdown_completed = threading.Event()


def register_hotkey_listener(hotkey_listener):
    """Register hotkey listener reference"""
    global _hotkey_listener
    _hotkey_listener = hotkey_listener
    ColorPrint.blue("[ShutdownManager] Hotkey listener registered")


def request_restart():
    """
    Request application restart

    This is the ONLY method that should be called from anywhere to trigger restart.
    It sets both restart and shutdown event flags and quits UI mainloop.
    """
    global _restart_requested, _shutdown_requested

    if _shutdown_requested.is_set():
        return

    ColorPrint.yellow("[ShutdownManager] ========================================")
    ColorPrint.yellow("[ShutdownManager] Restart requested")
    ColorPrint.yellow("[ShutdownManager] ========================================")
    _restart_requested.set()
    _shutdown_requested.set()

    ui = get_ui()
    if ui:
        try:
            ColorPrint.blue("[ShutdownManager] Quitting UI mainloop for restart...")
            ui.root.quit()
        except Exception as e:
            ColorPrint.red(f"[ShutdownManager] Error quitting UI mainloop: {e}")


def request_shutdown():
    """
    Request application shutdown

    This is the ONLY method that should be called from anywhere to trigger shutdown.
    It sets the shutdown event flag and quits UI mainloop to let main thread execute shutdown.
    """
    global _shutdown_requested

    if _shutdown_requested.is_set():
        return

    ColorPrint.yellow("[ShutdownManager] ========================================")
    ColorPrint.yellow("[ShutdownManager] Shutdown requested")
    ColorPrint.yellow("[ShutdownManager] ========================================")
    _shutdown_requested.set()

    ui = get_ui()
    if ui:
        try:
            ColorPrint.blue("[ShutdownManager] Quitting UI mainloop...")
            ui.root.quit()
        except Exception as e:
            ColorPrint.red(f"[ShutdownManager] Error quitting UI mainloop: {e}")


def is_shutdown_requested() -> bool:
    """Check if shutdown has been requested"""
    return _shutdown_requested.is_set()


def is_restart_requested() -> bool:
    """Check if restart has been requested"""
    return _restart_requested.is_set()


def execute_shutdown():
    """
    Execute the actual shutdown sequence

    This should ONLY be called from the main thread monitoring loop.
    Never call this directly from UI, signal handlers, or other components.
    """
    global _shutdown_completed
    global _hotkey_listener

    if _shutdown_completed.is_set():
        return  # Already completed (main thread only; no lock needed)

    ColorPrint.yellow("[ShutdownManager] ========================================")
    ColorPrint.yellow("[ShutdownManager] Executing shutdown sequence...")
    ColorPrint.yellow("[ShutdownManager] ========================================")

    try:
        # Unregister ColorPrint callbacks so worker threads' logs do not touch Tk during join
        ColorPrint.clear_all_callbacks()

        # Step 0: Signal extension shutdown, then run lifecycle runner (join threads + stop task manager)
        trigger_extension_shutdown()
        if _shutdown_runner is not None:
            _shutdown_runner()

        # Step 1: Stop hotkey listener (prevent new input)
        if _hotkey_listener:
            try:
                ColorPrint.blue("[ShutdownManager] [1/5] Stopping hotkey listener...")
                _hotkey_listener.stop_listening()
                ColorPrint.green("[ShutdownManager] [OK] Hotkey listener stopped")
            except Exception as e:
                ColorPrint.red(f"[ShutdownManager] [ERROR] Hotkey listener error: {e}")

        # Step 2: Run registered shutdown hooks (e.g. reset BN flow state)
        try:
            for hook in _shutdown_hooks:
                try:
                    hook()
                except Exception as e:
                    ColorPrint.red(f"[ShutdownManager] Shutdown hook error: {e}")
        except Exception as e:
            ColorPrint.red(f"[ShutdownManager] [ERROR] Shutdown hooks error: {e}")

        # Step 2.5: Stop log file watcher (watchdog observer)
        if _stop_log_watching_fn is not None:
            try:
                _stop_log_watching_fn()
            except Exception:
                pass

        # Step 3: Stop timer manager
        try:
            ColorPrint.blue("[ShutdownManager] [3/5] Stopping timer manager...")
            timer_manager.stop()
            ColorPrint.green("[ShutdownManager] [OK] Timer manager stopped")
        except Exception as e:
            ColorPrint.red(f"[ShutdownManager] [ERROR] Timer manager error: {e}")

        # Step 4: Destroy UI (cleanup window and system tray)
        ui = get_ui()
        if ui:
            try:
                ColorPrint.blue("[ShutdownManager] [4/5] Destroying UI...")
                # Stop system tray first (system_tray always exists after UI create)
                try:
                    ui.system_tray.stop()
                    time.sleep(0.2)  # Brief wait for tray cleanup
                except Exception:
                    pass

                # Destroy UI window
                try:
                    ui.root.quit()
                except Exception:
                    pass

                try:
                    ui.root.destroy()
                except Exception:
                    pass

                ColorPrint.green("[ShutdownManager] [OK] UI destroyed")
            except Exception as e:
                ColorPrint.red(f"[ShutdownManager] [ERROR] UI destruction error: {e}")

        _shutdown_completed.set()

        ColorPrint.green("[ShutdownManager] ========================================")
        ColorPrint.green("[ShutdownManager] Shutdown sequence completed")
        ColorPrint.green("[ShutdownManager] ========================================")

        # Check if restart was requested
        if is_restart_requested():
            ColorPrint.blue("[ShutdownManager] Restarting application...")
            time.sleep(0.3)
            os.execv(sys.executable, [sys.executable] + sys.argv)
        else:
            ColorPrint.blue("[ShutdownManager] Exiting application...")
            time.sleep(0.3)
            os._exit(0)

    except Exception as e:
        ColorPrint.red(f"[ShutdownManager] [ERROR] Critical error: {e}")
        os._exit(1)


def wait_for_shutdown(timeout: Optional[float] = None):
    """Wait for shutdown request"""
    return _shutdown_requested.wait(timeout)
