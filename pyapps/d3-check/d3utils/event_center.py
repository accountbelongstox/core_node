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
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from providor.common_imports import ColorPrint
from d3utils.event_signals import (
    EXTENSION_ROSBOT_STARTED,
    EXTENSION_ROSBOT_STOPPED,
    EXTENSION_SHUTDOWN,
    trigger_extension_rosbot_started,
    trigger_extension_rosbot_stopped,
    trigger_extension_shutdown,
)
from d3utils.shutdown_manager import (
    is_shutdown_requested,
    request_restart,
    request_shutdown,
)

from providor.app_constants import (
    APP_EXIT,
    APP_RESTART,
    WINDOW_SHOW,
    WINDOW_MINIMIZE,
    WINDOW_MAXIMIZE,
    EXTENSION_MAIN_START_MACRO,
    EXTENSION_MAIN_STOP_MACRO,
    EXTENSION_ROSBOT_START,
    EXTENSION_ROSBOT_STOP,
)


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

    def on_exit(_data: Any = None) -> None:
        if is_shutdown_requested():
            return
        request_shutdown()

    def on_restart(_data: Any = None) -> None:
        if is_shutdown_requested():
            return
        request_restart()

    def on_show(_data: Any = None) -> None:
        _do_show(ui)

    def on_minimize(_data: Any = None) -> None:
        ui.root.withdraw()

    def on_maximize(_data: Any = None) -> None:
        _do_toggle_maximize(ui)

    THREAD_BUS.register_event_handler(APP_EXIT, on_exit, priority=100)
    THREAD_BUS.register_event_handler(APP_RESTART, on_restart, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_SHOW, on_show, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_MINIMIZE, on_minimize, priority=100)
    THREAD_BUS.register_event_handler(WINDOW_MAXIMIZE, on_maximize, priority=100)
    ColorPrint.blue("[EventCenter] Main-thread handlers registered: exit/restart/show/minimize/maximize")


def _schedule_on_main_thread(event_name: str, event_data: Any = None) -> None:
    """Schedule THREAD_BUS.trigger_event on main thread so handlers run on main thread."""
    ui = ENCYCLOPEDIA.get("ui")
    if ui and hasattr(ui, "root"):
        ui.root.after(0, lambda: THREAD_BUS.trigger_event(event_name, event_data))
    else:
        THREAD_BUS.trigger_event(event_name, event_data)


def trigger_app_exit() -> None:
    """Trigger exit (callable from any thread; handler runs on main thread)."""
    _schedule_on_main_thread(APP_EXIT, None)


def trigger_app_restart() -> None:
    """Trigger restart (callable from any thread; handler runs on main thread)."""
    _schedule_on_main_thread(APP_RESTART, None)


def trigger_window_show() -> None:
    """Trigger show window (e.g. tray 'Show'); handler runs on main thread."""
    _schedule_on_main_thread(WINDOW_SHOW, None)


def trigger_window_minimize() -> None:
    """Trigger minimize; handler runs on main thread."""
    _schedule_on_main_thread(WINDOW_MINIMIZE, None)


def trigger_window_maximize() -> None:
    """Trigger maximize/restore; handler runs on main thread."""
    _schedule_on_main_thread(WINDOW_MAXIMIZE, None)


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


# trigger_extension_rosbot_started, trigger_extension_rosbot_stopped, trigger_extension_shutdown from event_signals (re-exported)
