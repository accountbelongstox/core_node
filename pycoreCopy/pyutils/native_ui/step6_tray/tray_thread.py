#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tkinter System Tray Thread

Thread-safe system tray wrapper following project threading standards:
- Directly inherits threading.Thread (not using Thread(target=func))
- Uses THREAD_BUS for all communication
- No shared mutable state or cross-thread callbacks
"""

import threading
from typing import Optional, List

from pycore import THREAD_BUS, ColorPrint

from .tkinter_system_tray import TkinterSystemTray, TrayMenuItem, PYSTRAY_AVAILABLE


class TkinterSystemTrayThread(threading.Thread):
    """
    Tkinter System Tray Thread

    Follows project threading standards:
    - Direct Thread inheritance
    - THREAD_BUS communication
    - No parameter passing between threads
    - Clear state signals via THREAD_BUS
    """

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        menu_items: Optional[List[TrayMenuItem]] = None,
        trigger_shutdown_on_exit: bool = True,
        daemon: bool = True
    ):
        """
        Initialize system tray thread

        Args:
            app_name: Application name to display in tray
            icon_path: Path to tray icon image (.png, .ico)
            menu_items: List of TrayMenuItem objects
            trigger_shutdown_on_exit: If True, trigger THREAD_BUS shutdown when tray exits
            daemon: Run as daemon thread (default: True)
        """
        super().__init__(name="TkinterSystemTrayThread", daemon=daemon)

        self.app_name = app_name
        self.icon_path = icon_path
        self.menu_items = menu_items
        self.trigger_shutdown_on_exit = trigger_shutdown_on_exit
        self.tray: Optional[TkinterSystemTray] = None

        ColorPrint.blue(f"[TkinterSystemTrayThread] Initialized - App: {app_name}")

    def run(self):
        """Thread main execution - runs tray event loop"""
        if not PYSTRAY_AVAILABLE:
            ColorPrint.red("[TkinterSystemTrayThread] pystray not available, cannot start")
            return

        ColorPrint.green("[TkinterSystemTrayThread] Starting tray...")

        # Create tray instance
        self.tray = TkinterSystemTray(
            app_name=self.app_name,
            icon_path=self.icon_path,
            menu_items=self.menu_items,
            trigger_shutdown_on_exit=self.trigger_shutdown_on_exit
        )

        # Signal that tray is starting
        THREAD_BUS.trigger_event('tray.thread.started', {
            'app_name': self.app_name
        })

        # Run tray (blocks until stopped)
        ColorPrint.green(f"[TkinterSystemTrayThread] Tray running...")
        self.tray.run()

        # Signal that tray has stopped
        THREAD_BUS.trigger_event('tray.thread.stopped', {})
        ColorPrint.yellow("[TkinterSystemTrayThread] Stopped")

    # ========== DEPRECATED METHODS (use THREAD_BUS events instead) ==========

    def request_stop(self):
        """
        DEPRECATED: Use THREAD_BUS.trigger_event('tray.request_stop', {}) instead

        Request thread to stop (called from other threads).
        This method violates project threading standards by calling methods across threads.
        """
        ColorPrint.yellow("[TkinterSystemTrayThread] WARNING: request_stop() is deprecated, use THREAD_BUS event 'tray.request_stop'")
        if self.tray:
            ColorPrint.blue(f"[TkinterSystemTrayThread] Requesting stop...")
            self.tray.stop()

    def update_menu(self, menu_items: List[TrayMenuItem]):
        """
        DEPRECATED: Use THREAD_BUS.trigger_event('tray.update_menu', {'menu_items': items}) instead

        Update tray menu items (thread-safe).
        This method violates project threading standards by calling methods across threads.

        Args:
            menu_items: New list of menu items
        """
        ColorPrint.yellow("[TkinterSystemTrayThread] WARNING: update_menu() is deprecated, use THREAD_BUS event 'tray.update_menu'")
        if self.tray:
            self.tray.update_menu(menu_items)

    def get_tray(self) -> Optional[TkinterSystemTray]:
        """
        DEPRECATED: Direct access to tray instance violates threading standards

        Get tray instance (for controlled access).
        This method is deprecated as it exposes internal state to other threads.
        """
        ColorPrint.yellow("[TkinterSystemTrayThread] WARNING: get_tray() is deprecated")
        return self.tray
