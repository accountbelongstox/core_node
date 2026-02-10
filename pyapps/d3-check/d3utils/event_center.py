#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Center - Central event bus.
Uses pycore THREAD_BUS. All threads do not communicate directly; they send signals
to the event center, and the event center dispatches to registered handlers (which
may forward to specific threads or schedule main-thread UI updates).
"""

from typing import Any, Callable, Optional, Tuple

# Payload for EXTENSION_ROSBOT_STARTED: always (success, error, ran_e_block) from event_signals
RosbotStartedPayload = Tuple[bool, Optional[Exception], bool]

from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.color_print import ColorPrint
from share.ui_registry import get_ui
from d3utils.event_signals import (
    EXTENSION_ROSBOT_STARTED,
    EXTENSION_ROSBOT_STOPPED,
    EXTENSION_SHUTDOWN,
    trigger_extension_rosbot_started,
    trigger_extension_rosbot_stopped,
    trigger_extension_shutdown,
)
from providor.constants.common import (
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

# Shutdown provider: set by runtime after event_center and shutdown_manager are loaded.
_ShutdownProvider = Tuple[Callable[[], bool], Callable[[], None], Callable[[], None]]
_shutdown_provider: Optional[_ShutdownProvider] = None


def register_shutdown_provider(
    is_shutdown_requested_fn: Callable[[], bool],
    request_shutdown_fn: Callable[[], None],
    request_restart_fn: Callable[[], None],
) -> None:
    """Register shutdown functions (called from runtime after both event_center and shutdown_manager are loaded)."""
    global _shutdown_provider
    _shutdown_provider = (is_shutdown_requested_fn, request_shutdown_fn, request_restart_fn)


def _do_show(ui) -> None:
    """Run on main thread: show window."""
    ui.root.deiconify()
    ui.root.lift()
    ui.root.focus_force()


def _do_toggle_maximize(ui) -> None:
    """Run on main thread: toggle maximize/restore (saved geometry for overrideredirect) and sync title bar button text."""
    root = ui.root
    is_max = ui._is_maximized
    if is_max and ui._saved_geometry_restore:
        root.geometry(ui._saved_geometry_restore)
        ui._is_maximized = False
        ui.title_bar.maximize_btn.configure(text="□")
    else:
        ui._saved_geometry_restore = root.geometry()
        w, h = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+0+0")
        ui._is_maximized = True
        ui.title_bar.maximize_btn.configure(text="❐")


def register_main_thread_handlers(ui) -> None:
    """
    Register main-thread handlers: all events run on main thread via root.after(0, ...).
    Must be called after UI is created and before main loop starts.
    """

    def on_exit(_data: Any = None) -> None:
        if _shutdown_provider is None:
            return
        is_req, req_shutdown, _ = _shutdown_provider
        if is_req():
            return
        req_shutdown()

    def on_restart(_data: Any = None) -> None:
        if _shutdown_provider is None:
            return
        is_req, _, req_restart = _shutdown_provider
        if is_req():
            return
        req_restart()

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
    ui = get_ui()
    if ui:
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
            if th:
                th.request_shutdown()

    # Completion -> main thread UI update. Payload is (success, error, ran_e_block) from trigger_extension_rosbot_started.
    def on_rosbot_started(data: Optional[RosbotStartedPayload] = None) -> None:
        if data is None:
            success, err, ran_e_block = False, None, False
        else:
            success, err, ran_e_block = data[0], data[1], data[2]
        ui.root.after(0, lambda: panel._on_login_check_done(success, err, ran_e_block=ran_e_block))

    def on_rosbot_stopped(_data: Any = None) -> None:
        ui.root.after(0, lambda: panel._on_rosbot_stop_done())

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
