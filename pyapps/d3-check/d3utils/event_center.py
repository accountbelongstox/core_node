#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Center - Central event bus.
Uses pycore THREAD_BUS. All threads do not communicate directly; they send signals
to the event center, and the event center dispatches to registered handlers (which
may forward to specific threads or schedule main-thread UI updates).
"""

from typing import Any, Callable, Optional

from pycore.pyfoundations.thread_bus import THREAD_BUS
from providor.common_imports import ColorPrint

# App/window events (handlers run on main thread via root.after in handler)
APP_EXIT = "app.exit"
APP_RESTART = "app.restart"
WINDOW_SHOW = "window.show"
WINDOW_MINIMIZE = "window.minimize"
WINDOW_MAXIMIZE = "window.maximize"

# Extension thread command events (handler forwards to thread queue)
EXTENSION_MAIN_START_MACRO = "extension.main.start_macro"
EXTENSION_MAIN_STOP_MACRO = "extension.main.stop_macro"
EXTENSION_ROSBOT_START = "extension.rosbot.start"
EXTENSION_ROSBOT_STOP = "extension.rosbot.stop"
EXTENSION_SHUTDOWN = "extension.shutdown"

# Extension thread completion events (handler schedules main-thread UI update)
EXTENSION_ROSBOT_STARTED = "extension.rosbot.started"
EXTENSION_ROSBOT_STOPPED = "extension.rosbot.stopped"


def _do_show(ui) -> None:
    """Run on main thread: show window."""
    try:
        ui.root.deiconify()
        ui.root.lift()
        ui.root.focus_force()
    except Exception:
        pass


def _do_toggle_maximize(ui) -> None:
    """Run on main thread: toggle maximize/restore and sync title bar button text."""
    try:
        root = ui.root
        if root.state() == "zoomed":
            root.state("normal")
            if hasattr(ui, "title_bar") and hasattr(ui.title_bar, "maximize_btn"):
                ui.title_bar.maximize_btn.configure(text="□")
        else:
            root.state("zoomed")
            if hasattr(ui, "title_bar") and hasattr(ui.title_bar, "maximize_btn"):
                ui.title_bar.maximize_btn.configure(text="❐")
    except Exception:
        pass


def register_main_thread_handlers(ui) -> None:
    """
    Register main-thread handlers: all events run on main thread via root.after(0, ...).
    Must be called after UI is created and before main loop starts.
    """
    from providor.common_imports import ColorPrint
    from d3utils.shutdown_manager import (
        request_shutdown,
        request_restart,
        is_shutdown_requested,
    )

    def on_exit(_data: Any = None) -> None:
        if is_shutdown_requested():
            return
        ui.root.after(0, request_shutdown)

    def on_restart(_data: Any = None) -> None:
        if is_shutdown_requested():
            return
        ui.root.after(0, request_restart)

    def on_show(_data: Any = None) -> None:
        ui.root.after(0, lambda: _do_show(ui))

    def on_minimize(_data: Any = None) -> None:
        ui.root.after(0, lambda: ui.root.withdraw())

    def on_maximize(_data: Any = None) -> None:
        ui.root.after(0, lambda: _do_toggle_maximize(ui))

    THREAD_BUS.register_event_handler(APP_EXIT, on_exit, priority=100)
    THREAD_BUS.register_event_handler(APP_RESTART, on_restart, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_SHOW, on_show, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_MINIMIZE, on_minimize, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_MAXIMIZE, on_maximize, priority=100)
    ColorPrint.blue("[EventCenter] Main-thread handlers registered: exit/restart/show/minimize/maximize")


def trigger_app_exit() -> None:
    """Trigger exit (callable from any thread; runs on main thread)."""
    THREAD_BUS.trigger_event(APP_EXIT, None)


def trigger_app_restart() -> None:
    """Trigger restart (callable from any thread)."""
    THREAD_BUS.trigger_event(APP_RESTART, None)


def trigger_window_show() -> None:
    """Trigger show window (e.g. tray 'Show')."""
    THREAD_BUS.trigger_event(WINDOW_SHOW, None)


def trigger_window_minimize() -> None:
    """Trigger minimize."""
    THREAD_BUS.trigger_event(WINDOW_MINIMIZE, None)


def trigger_window_maximize() -> None:
    """Trigger maximize/restore."""
    THREAD_BUS.trigger_event(WINDOW_MAXIMIZE, None)


# ---------- Extension thread events: UI/threads only trigger; handlers forward to threads ----------


def register_extension_handlers(
    ui: Any,
    panel: Any,
    get_main_function_thread: Callable[[], Optional[Any]],
    get_auxiliary_function_thread: Callable[[], Optional[Any]],
    get_d3_extension_thread: Callable[[], Optional[Any]],
    get_d4_extension_thread: Callable[[], Optional[Any]],
) -> None:
    """
    Register handlers so that all extension-thread communication goes through event center.
    - Command events: handler forwards to the corresponding thread's queue (put_command/request_shutdown).
    - Completion events: handler schedules panel callback on main thread (root.after(0, ...)).
    Call from controller after UI and threads are created.
    """
    # Command -> thread queue
    def on_main_start_macro(_data: Any = None) -> None:
        th = get_main_function_thread()
        if th:
            th.put_command("start_macro")

    def on_main_stop_macro(_data: Any = None) -> None:
        th = get_main_function_thread()
        if th:
            th.put_command("stop_macro")

    def on_rosbot_start(_data: Any = None) -> None:
        th = get_d3_extension_thread()
        if th:
            th.put_command("start_rosbot")

    def on_rosbot_stop(_data: Any = None) -> None:
        th = get_d3_extension_thread()
        if th:
            th.put_command("stop_rosbot")

    def on_extension_shutdown(_data: Any = None) -> None:
        for getter in (get_main_function_thread, get_auxiliary_function_thread, get_d3_extension_thread, get_d4_extension_thread):
            th = getter()
            if th and hasattr(th, "request_shutdown"):
                th.request_shutdown()

    # Completion -> main thread UI update
    def on_rosbot_started(data: Any = None) -> None:
        success = False
        err = None
        if isinstance(data, (list, tuple)) and len(data) >= 2:
            success, err = data[0], data[1]
        elif isinstance(data, dict):
            success = data.get("success", False)
            err = data.get("error")
        try:
            ui.root.after(0, lambda: panel._on_login_check_done(success, err))
        except Exception:
            pass

    def on_rosbot_stopped(_data: Any = None) -> None:
        try:
            ui.root.after(0, lambda: panel._on_rosbot_stop_done())
        except Exception:
            pass

    THREAD_BUS.register_event_handler(EXTENSION_MAIN_START_MACRO, on_main_start_macro, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_MAIN_STOP_MACRO, on_main_stop_macro, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_ROSBOT_START, on_rosbot_start, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_ROSBOT_STOP, on_rosbot_stop, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_SHUTDOWN, on_extension_shutdown, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_ROSBOT_STARTED, on_rosbot_started, priority=50)
    THREAD_BUS.register_event_handler(EXTENSION_ROSBOT_STOPPED, on_rosbot_stopped, priority=50)
    ColorPrint.blue("[EventCenter] Extension thread handlers registered (main/aux/rosbot/d4)")


def trigger_extension_main_start_macro() -> None:
    """Trigger from UI/controller; event center forwards to main function thread."""
    THREAD_BUS.trigger_event(EXTENSION_MAIN_START_MACRO, None)


def trigger_extension_main_stop_macro() -> None:
    """Trigger from UI/controller; event center forwards to main function thread."""
    THREAD_BUS.trigger_event(EXTENSION_MAIN_STOP_MACRO, None)


def trigger_extension_rosbot_start() -> None:
    """Trigger from UI/controller; event center forwards to D3 extension thread."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_START, None)


def trigger_extension_rosbot_stop() -> None:
    """Trigger from UI/controller; event center forwards to D3 extension thread."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STOP, None)


def trigger_extension_rosbot_started(success: bool, error: Optional[Exception] = None) -> None:
    """Trigger from D3 extension thread when login check done; event center schedules panel callback on main thread."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STARTED, (success, error))


def trigger_extension_rosbot_stopped() -> None:
    """Trigger from D3 extension thread when stop done; event center schedules panel callback on main thread."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STOPPED, None)


def trigger_extension_shutdown() -> None:
    """Trigger from shutdown manager; event center forwards request_shutdown to all four extension threads."""
    THREAD_BUS.trigger_event(EXTENSION_SHUTDOWN, None)
