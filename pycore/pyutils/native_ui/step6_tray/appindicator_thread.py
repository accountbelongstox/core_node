#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AppIndicator System Tray Thread

Thread-safe AppIndicator wrapper following project threading standards:
- Directly inherits threading.Thread
- Uses THREAD_BUS for all communication
- No shared mutable state or cross-thread callbacks
"""

import threading
from typing import Optional, List, Any
from pathlib import Path

from pycore import THREAD_BUS, ColorPrint

from .appindicator_system_tray import (
    AppIndicatorSystemTray,
    AppIndicatorMenuItem,
    APPINDICATOR_AVAILABLE,
    check_appindicator_available
)


def build_appindicator_menu_items(menu_items: List[Any]) -> List[AppIndicatorMenuItem]:
    """
    Convert tray config menu items to AppIndicatorMenuItem list.

    Accepts TrayMenuItem (tkinter: text, action_signal) or dict (text_key/text, signal/action_signal).
    Uses i18n.get() for display text when item has i18n key.
    """
    try:
        from pycore.pyutils.native_ui.step0_i18n import i18n
    except ImportError:
        i18n = None

    result = []
    for item in menu_items:
        if getattr(item, 'text', None) == "---" or (isinstance(item, dict) and item.get('text_key') == '---'):
            result.append(AppIndicatorMenuItem(text="---", separator=True))
            continue
        if isinstance(item, dict):
            text_key = item.get('text_key') or item.get('text', '')
            text = i18n.get(text_key) if i18n and text_key else text_key
            signal = item.get('signal') or item.get('action_signal', '')
            submenu_data = item.get('submenu')
            submenu = build_appindicator_menu_items(submenu_data) if submenu_data else None
            result.append(AppIndicatorMenuItem(
                text=text,
                callback=signal or None,
                enabled=item.get('enabled', True),
                checkable=item.get('checkable', False),
                checked=item.get('checked', False),
                submenu=submenu
            ))
        else:
            text_raw = getattr(item, 'text', '') or getattr(item, 'text_key', '')
            text = i18n.get(text_raw) if i18n and text_raw and text_raw != "---" else text_raw
            signal = getattr(item, 'action_signal', None) or getattr(item, 'signal', '')
            submenu_raw = getattr(item, 'submenu', None)
            submenu = build_appindicator_menu_items(submenu_raw) if submenu_raw else None
            result.append(AppIndicatorMenuItem(
                text=text,
                callback=signal or None,
                enabled=getattr(item, 'enabled', True),
                checkable=getattr(item, 'checkable', False),
                checked=getattr(item, 'checked', False),
                submenu=submenu
            ))
    return result


class AppIndicatorSystemTrayThread(threading.Thread):
    """
    AppIndicator System Tray Thread

    Follows project threading standards:
    - Direct Thread inheritance
    - THREAD_BUS communication
    - No parameter passing between threads
    - Clear state signals via THREAD_BUS

    This provides the best system tray experience on Ubuntu 22.04+ with GNOME Shell.
    """

    def __init__(
        self,
        app_id: str = "pycore-app",
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        icon_name: Optional[str] = None,
        menu_items: Optional[List[AppIndicatorMenuItem]] = None,
        trigger_shutdown_on_exit: bool = True,
        daemon: bool = True
    ):
        """
        Initialize AppIndicator system tray thread.

        Args:
            app_id: Unique application ID for D-Bus
            app_name: Application name to display in tray
            icon_path: Path to tray icon image (.png recommended)
            icon_name: Icon theme name (e.g., "application-default-icon")
            menu_items: List of AppIndicatorMenuItem objects
            trigger_shutdown_on_exit: If True, trigger THREAD_BUS shutdown when tray exits
            daemon: Run as daemon thread (default: True)
        """
        super().__init__(name="AppIndicatorSystemTrayThread", daemon=daemon)

        if not APPINDICATOR_AVAILABLE:
            raise RuntimeError(
                "AppIndicator not available. Install with:\n"
                "  (modern Ubuntu) sudo apt-get install python3-gi gir1.2-ayatanaappindicator3-0.1\n"
                "  (legacy)        sudo apt-get install python3-gi gir1.2-appindicator3-0.1"
            )

        self.app_id = app_id
        self.app_name = app_name
        self.icon_path = icon_path
        self.icon_name = icon_name
        self.menu_items = menu_items or []
        self.trigger_shutdown_on_exit = trigger_shutdown_on_exit
        self.tray: Optional[AppIndicatorSystemTray] = None

        ColorPrint.blue(f"[AppIndicatorThread] Initialized - App: {app_name}")

    def run(self):
        """Thread main execution - runs tray event loop"""
        if not APPINDICATOR_AVAILABLE:
            ColorPrint.red("[AppIndicatorThread] AppIndicator3 not available, cannot start")
            return

        ColorPrint.green("[AppIndicatorThread] Starting tray...")

        # Create tray instance
        self.tray = AppIndicatorSystemTray(
            app_id=self.app_id,
            app_name=self.app_name,
            icon_path=self.icon_path,
            icon_name=self.icon_name,
            trigger_shutdown_on_exit=self.trigger_shutdown_on_exit
        )

        # Set menu items
        if self.menu_items:
            self.tray.set_menu_items(self.menu_items)

        # Signal that tray is starting
        THREAD_BUS.trigger_event('tray.thread.started', {
            'app_id': self.app_id,
            'backend': 'appindicator'
        })

        # Run tray (blocks until stopped)
        ColorPrint.green(f"[AppIndicatorThread] Tray running...")
        self.tray.run()

        # Signal that tray has stopped
        THREAD_BUS.trigger_event('tray.thread.stopped', {})
        ColorPrint.yellow("[AppIndicatorThread] Stopped")

    def request_stop(self):
        """
        Request thread to stop (called from other threads).

        This method is thread-safe via GLib.idle_add() in the tray implementation.
        """
        if self.tray:
            ColorPrint.blue(f"[AppIndicatorThread] Requesting stop...")
            self.tray.stop()

    def update_menu(self, menu_items: List[AppIndicatorMenuItem]):
        """
        Update tray menu items (thread-safe).

        Args:
            menu_items: New list of menu items
        """
        if self.tray:
            self.tray.update_menu(menu_items)

    def get_tray(self) -> Optional[AppIndicatorSystemTray]:
        """
        Get tray instance (for controlled access).

        Note: Direct access should be minimized. Prefer THREAD_BUS events.
        """
        return self.tray


# Utility function
def is_appindicator_recommended() -> bool:
    """
    Check if AppIndicator is the recommended backend for current platform.

    Returns:
        True if running on Linux with GNOME Shell and AppIndicator available
    """
    import os
    import platform

    if platform.system() != "Linux":
        return False

    if not check_appindicator_available():
        return False

    # Check Ubuntu/GNOME desktop via environment
    desktop = os.environ.get('XDG_CURRENT_DESKTOP', '').lower()
    if 'gnome' in desktop or 'ubuntu' in desktop:
        return True

    return False


if __name__ == "__main__":
    from pycore.pyutils.native_ui.step6_tray.appindicator_system_tray import print_appindicator_status

    print_appindicator_status()

    if is_appindicator_recommended():
        ColorPrint.green("✓ AppIndicator is recommended for this system")
    else:
        ColorPrint.yellow("⚠ AppIndicator may not be the best choice for this system")
