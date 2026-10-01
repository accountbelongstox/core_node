#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tray-mode handoff for TkinterStartupThread after the debug window closes.

Functions take the owning thread (``thread``) and set ``thread.tray`` and
``thread._tray_config``. AppIndicator is used on Ubuntu/GNOME when the session
bus is reachable; otherwise pystray (TkinterSystemTray).
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.native_ui.platform_adapter import platform_adapter
from pycore.pyutils.native_ui.step1_config.tray_config import TrayBackend
from pycore.pyutils.native_ui.step6_tray.appindicator_system_tray import (
    APPINDICATOR_AVAILABLE,
    AppIndicatorSystemTray,
    check_session_bus_available,
)
from pycore.pyutils.native_ui.step6_tray._types import build_appindicator_menu_items
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TkinterSystemTray
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import bus_manager

STARTUP_TRAY_APP_ID = "pycore-startup-tray"
TRAY_HANDLER_PRIORITY = 20


def run_tray_mode(thread):
    """Run the persistent tray; blocks until tray.stop()."""
    tray_config = bus_manager.get_tray_config()
    if not tray_config or not tray_config.enabled:
        ColorPrint.print_warn("[TkinterStartupThread] No tray config found or tray disabled")
        return
    thread._tray_config = tray_config

    use_appindicator = (
        platform_adapter.can_use_tray()
        and platform_adapter.recommended_tray_backend() == TrayBackend.APPINDICATOR
        and APPINDICATOR_AVAILABLE
    )
    if use_appindicator and check_session_bus_available():
        run_appindicator_tray(thread, tray_config)
        return
    if use_appindicator:
        ColorPrint.print_warn(
            "[TkinterStartupThread] D-Bus session bus unreachable from this "
            "process (root outside the desktop session?); using pystray")

    thread.tray = TkinterSystemTray(
        app_name=tray_config.app_name,
        icon_path=tray_config.icon_path,
        menu_items=tray_config.menu_items,
    )
    _register_and_run(thread, lambda: thread.tray.update_menu(thread._tray_config.menu_items))


def run_appindicator_tray(thread, tray_config):
    """Run the AppIndicator tray (Ubuntu/GNOME); blocks until stopped."""
    thread.tray = AppIndicatorSystemTray(
        app_id=STARTUP_TRAY_APP_ID,
        app_name=tray_config.app_name,
        icon_path=tray_config.icon_path,
        trigger_shutdown_on_exit=True,
    )
    thread.tray.set_menu_items(build_appindicator_menu_items(tray_config.menu_items))
    _register_and_run(
        thread,
        lambda: thread.tray.update_menu(build_appindicator_menu_items(thread._tray_config.menu_items)),
    )


def _register_and_run(thread, rebuild_menu):
    """Register TRAY_STOP and language-change redraw handlers, then run the tray."""
    def on_tray_stop(event_data):
        if thread.tray:
            thread.tray.stop()
    THREAD_BUS.register_event_handler(BusSignals.TRAY_STOP, on_tray_stop, priority=TRAY_HANDLER_PRIORITY)

    def on_ui_redraw(event_data):
        if event_data.get('reason') == 'language_changed' and thread.tray and thread._tray_config:
            rebuild_menu()
    bus_manager.on_ui_redraw(on_ui_redraw)

    ColorPrint.print_info("[TkinterStartupThread] Starting system tray...")
    THREAD_BUS.set_thread_state('TkinterStartupThread', 'tray_running')
    thread.tray.run()
    ColorPrint.print_info("[TkinterStartupThread] Tray stopped")
