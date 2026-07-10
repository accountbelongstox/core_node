#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Startup Tray Runner - tray-mode handoff for TkinterStartupThread.

After the debug window closes (and tray is enabled + no stop requested), the
owning ``TkinterStartupThread`` delegates here to run a persistent system tray.

All functions are module-level and take the owning ``TkinterStartupThread``
instance (``thread``) as their first argument. They read/write ``thread.tray``
and ``thread._tray_config``.

Backend selection:
- AppIndicator (Ubuntu/GNOME): reuses ``build_appindicator_menu_items`` from
  ``step6_tray.appindicator_thread`` (kept as a FUNCTION-LOCAL import to preserve
  the original lazy-import cycle break - never hoist to module top).
- pystray fallback (TkinterSystemTray): builds ``TkinterTrayMenuItem`` objects via
  ``build_tray_menu_items``. The generic appindicator/pyside6 converters cannot be
  reused here because they produce different target types
  (AppIndicatorMenuItem / PySide6TrayMenuItem) and lack the special
  ``.set_language.`` checked-state logic this menu depends on.
"""

from typing import Any

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import (
    TkinterSystemTray,
    TrayMenuItem as TkinterTrayMenuItem,
)
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import (
    get_bus_manager,
    BusSignals,
)
from pycore.pyutils.native_ui.platform_adapter import (
    get_platform_adapter,
    TrayBackend as PlatformTrayBackend,
)


def run_tray_mode(thread):
    """
    Run tray-only mode (after debug window closes).

    On Ubuntu/GNOME desktop uses AppIndicator when available; otherwise pystray
    (TkinterSystemTray). Blocks until tray.stop() is called.

    (was TkinterStartupThread._run_tray_mode)
    """
    bus_mgr = get_bus_manager()
    tray_config = bus_mgr.get_tray_config()

    if not tray_config or not tray_config.enabled:
        ColorPrint.print_warn("[TkinterStartupThread] No tray config found or tray disabled")
        return

    ColorPrint.print_success("[TkinterStartupThread] Tray config found in THREAD_BUS")
    thread._tray_config = tray_config

    adapter = get_platform_adapter()
    use_appindicator = (
        adapter.can_use_tray()
        and adapter.get_recommended_tray_backend() == PlatformTrayBackend.APPINDICATOR
    )
    if use_appindicator:
        try:
            # LAZY import: preserves the original function-local cycle break.
            # Do NOT hoist to module top.
            from pycore.pyutils.native_ui.step6_tray.appindicator_system_tray import (
                AppIndicatorSystemTray,
                APPINDICATOR_AVAILABLE,
            )
            from pycore.pyutils.native_ui.step6_tray.appindicator_thread import build_appindicator_menu_items
            if APPINDICATOR_AVAILABLE:
                run_appindicator_tray(thread, tray_config, bus_mgr)
                return
        except Exception as e:
            ColorPrint.print_warn(f"[TkinterStartupThread] AppIndicator failed ({e}), using pystray")

    # Fallback: pystray (TkinterSystemTray)
    menu_items = build_tray_menu_items(thread, tray_config)
    thread.tray = TkinterSystemTray(
        app_name=tray_config.app_name,
        icon_path=tray_config.icon_path,
        menu_items=menu_items
    )
    register_tray_handlers_and_run(thread, bus_mgr)


def run_appindicator_tray(thread, tray_config, bus_mgr):
    """Run AppIndicator tray (Ubuntu/GNOME). Blocks until stopped.

    (was TkinterStartupThread._run_appindicator_tray)
    """
    # LAZY import: preserves the original function-local cycle break.
    from pycore.pyutils.native_ui.step6_tray.appindicator_system_tray import AppIndicatorSystemTray
    from pycore.pyutils.native_ui.step6_tray.appindicator_thread import build_appindicator_menu_items

    # Reuse the EXISTING converter (reuse-first) instead of re-building menu items.
    appindicator_items = build_appindicator_menu_items(tray_config.menu_items)
    thread.tray = AppIndicatorSystemTray(
        app_id="pycore-startup-tray",
        app_name=tray_config.app_name,
        icon_path=tray_config.icon_path,
        trigger_shutdown_on_exit=True
    )
    thread.tray.set_menu_items(appindicator_items)

    def on_tray_stop(event_data):
        if thread.tray:
            thread.tray.stop()
    THREAD_BUS.register_event_handler(BusSignals.TRAY_STOP, on_tray_stop, priority=20)

    def on_ui_redraw(event_data):
        if event_data.get('reason') == 'language_changed' and thread.tray and thread._tray_config:
            # Reuse the EXISTING converter to rebuild translated menu on language change.
            new_items = build_appindicator_menu_items(thread._tray_config.menu_items)
            thread.tray.update_menu(new_items)
    bus_mgr.on_ui_redraw(on_ui_redraw)

    THREAD_BUS.set_thread_state('TkinterStartupThread', 'tray_running')
    ColorPrint.print_info("[TkinterStartupThread] Starting AppIndicator tray...")
    thread.tray.run()
    ColorPrint.print_info("[TkinterStartupThread] Tray stopped")


def register_tray_handlers_and_run(thread, bus_mgr):
    """Register TRAY_STOP and ui_redraw for pystray, then run tray. Blocks until stopped.

    (was TkinterStartupThread._register_tray_handlers_and_run)
    """
    def on_tray_stop(event_data):
        if thread.tray:
            thread.tray.stop()
    THREAD_BUS.register_event_handler(BusSignals.TRAY_STOP, on_tray_stop, priority=20)

    def on_ui_redraw(event_data):
        if event_data.get('reason') == 'language_changed' and thread.tray and thread._tray_config:
            new_menu_items = build_tray_menu_items(thread, thread._tray_config)
            thread.tray.update_menu(new_menu_items)
    bus_mgr.on_ui_redraw(on_ui_redraw)

    ColorPrint.print_info("[TkinterStartupThread] Starting system tray...")
    THREAD_BUS.set_thread_state('TkinterStartupThread', 'tray_running')
    thread.tray.run()
    ColorPrint.print_info("[TkinterStartupThread] Tray stopped")


def build_tray_menu_items(thread, tray_config):
    """
    Build pystray (TkinterSystemTray) menu items from tray_config.

    Dynamically translates text_key using i18n.get() based on current language.
    Supports submenus and recursively builds nested menu items.

    Args:
        thread: Owning TkinterStartupThread (kept for API symmetry with the other
                tray-runner functions; currently unused beyond future hooks).
        tray_config: TrayConfig object

    Returns:
        List of TkinterTrayMenuItem objects for TkinterSystemTray

    (was TkinterStartupThread._build_tray_menu_items)
    """
    menu_items = []
    for item in tray_config.menu_items:
        if item.text_key == "---":
            menu_items.append(TkinterTrayMenuItem.SEPARATOR)
        else:
            # Dynamically get translation from i18n.get(text_key) based on current language
            display_text = i18n.get(item.text_key)

            # Handle submenu if present
            submenu_items = None
            if item.submenu:
                submenu_items = []
                for sub_item in item.submenu:
                    if sub_item.text_key == "---":
                        submenu_items.append(TkinterTrayMenuItem.SEPARATOR)
                    else:
                        sub_display_text = i18n.get(sub_item.text_key)
                        # For checkable items, update checked state based on current language.
                        # None = no checkbox indicator; True/False = [X]/[ ] prefix.
                        checked = None
                        if sub_item.checkable:
                            # Extract language from signal (format: mcpserver.tray.set_language.{lang})
                            if sub_item.signal and '.set_language.' in sub_item.signal:
                                lang_code = sub_item.signal.split('.')[-1]
                                checked = (lang_code == i18n.get_current_language())
                            else:
                                checked = sub_item.checked

                        submenu_item = TkinterTrayMenuItem(
                            text=sub_display_text,
                            action_signal=sub_item.signal,
                            enabled=sub_item.enabled,
                            default=sub_item.default,
                            checked=checked
                        )
                        submenu_items.append(submenu_item)

            # Create TkinterTrayMenuItem with action_signal (tkinter_system_tray format)
            menu_item = TkinterTrayMenuItem(
                text=display_text,
                action_signal=item.signal,  # Convert 'signal' to 'action_signal'
                enabled=item.enabled,
                default=item.default
            )
            # Add submenu if present (TkinterTrayMenuItem needs submenu support)
            if submenu_items:
                menu_item.submenu = submenu_items

            menu_items.append(menu_item)

    return menu_items
