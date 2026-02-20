#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Component
Provides system tray functionality for Windows 10/11.
Icon and run() are created and executed in the tray thread so the Windows
message loop runs in the same thread that owns the icon (required for visibility).
Optional deps loaded in _tray_deps (no catch in this file).
"""

import time
import threading
from typing import Optional, Callable

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.i18n_manager import i18n_manager

from ._tray_deps import (
    pythoncom,
    trigger_window_show,
    trigger_window_maximize,
    trigger_app_restart,
    trigger_app_exit,
    _pystray,
    _Image,
    _ImageDraw,
    TRAY_AVAILABLE,
)


def _create_icon_image():
    """Create tray icon image (PIL). Call only when TRAY_AVAILABLE (so _Image, _ImageDraw are set)."""
    if _Image is None or _ImageDraw is None:
        return None
    w, h = 64, 64
    image = _Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = _ImageDraw.Draw(image)
    draw.ellipse([8, 8, w - 8, h - 8], fill=(200, 0, 0, 255), outline=(255, 255, 255, 255), width=2)
    draw.rectangle([20, 20, 24, 44], fill=(255, 255, 255, 255))
    draw.rectangle([20, 20, 32, 24], fill=(255, 255, 255, 255))
    draw.rectangle([20, 40, 32, 44], fill=(255, 255, 255, 255))
    draw.rectangle([30, 24, 32, 40], fill=(255, 255, 255, 255))
    draw.rectangle([36, 20, 40, 44], fill=(255, 255, 255, 255))
    draw.rectangle([36, 20, 44, 24], fill=(255, 255, 255, 255))
    draw.rectangle([36, 32, 44, 36], fill=(255, 255, 255, 255))
    draw.rectangle([36, 40, 44, 44], fill=(255, 255, 255, 255))
    return image


class SystemTray(threading.Thread):
    """System tray: Icon is created and run() in this thread so Windows shows the icon."""

    def __init__(self, parent_ui):
        threading.Thread.__init__(self, daemon=True, name="TrayRunner")
        self.parent_ui = parent_ui
        self.tray_icon = None
        self._tray_icon_lock = threading.Lock()
        self.is_running = False
        if not TRAY_AVAILABLE:
            ColorPrint.yellow("[TRAY] System tray not available - install pystray and PIL")

    def run(self) -> None:
        """Create icon and run message loop in this thread (required on Windows for icon to show)."""
        if not TRAY_AVAILABLE or _pystray is None:
            return
        if pythoncom is not None:
            pythoncom.CoInitialize()
        icon_image = _create_icon_image()
        if icon_image is None:
            ColorPrint.red("[TRAY] No icon image, tray not shown")
            return
        try:
            show_text = i18n_manager.get_ui_text("system_tray.show_software")
            maximize_text = i18n_manager.get_ui_text("system_tray.maximize")
            restart_text = i18n_manager.get_ui_text("system_tray.restart")
            exit_text = i18n_manager.get_ui_text("system_tray.exit")
            title = i18n_manager.get_ui_text("main_window.title")
            debug_tab_items = [
                _pystray.MenuItem(f"Tab {i}", self._make_switch_tab(i))
                for i in range(5)
            ]
            debug_menu = _pystray.Menu(*debug_tab_items)
            menu = _pystray.Menu(
                _pystray.MenuItem(show_text, self._show_window),
                _pystray.MenuItem(maximize_text, self._maximize_window),
                _pystray.MenuItem(restart_text, self._restart_application),
                _pystray.Menu.SEPARATOR,
                _pystray.MenuItem("Debug", debug_menu),
                _pystray.Menu.SEPARATOR,
                _pystray.MenuItem(exit_text, self._exit_application),
            )
            icon = _pystray.Icon("D3Check", icon=icon_image, title=title, menu=menu)
            with self._tray_icon_lock:
                self.tray_icon = icon
            ColorPrint.blue("[TRAY] System tray icon created (in tray thread)")
            icon.run()
        finally:
            self.is_running = False
            with self._tray_icon_lock:
                self.tray_icon = None

    def start(self) -> bool:
        """Start the tray thread (icon is created inside the thread). Idempotent."""
        if not TRAY_AVAILABLE:
            return False
        if self.is_alive():
            self.is_running = True
            return True
        self.is_running = True
        super().start()
        ColorPrint.green("[TRAY] System tray started")
        return True

    def stop(self) -> None:
        """Stop the tray icon and thread."""
        if not TRAY_AVAILABLE:
            return
        self.is_running = False
        with self._tray_icon_lock:
            icon = self.tray_icon
            self.tray_icon = None
        if icon is not None:
            icon.stop()
            time.sleep(0.15)
        ColorPrint.blue("[TRAY] System tray stopped")

    def _show_window(self, icon=None, item=None) -> None:
        if trigger_window_show is not None:
            trigger_window_show()
        else:
            root = self.parent_ui.root
            if root.winfo_exists():
                root.deiconify()
                root.lift()
                root.focus_force()
        ColorPrint.blue("[TRAY] Show window requested")

    def _maximize_window(self, icon=None, item=None) -> None:
        if trigger_window_maximize is not None:
            trigger_window_maximize()
        else:
            r = self.parent_ui.root
            if r.winfo_exists():
                r.state("zoomed" if r.state() != "zoomed" else "normal")
        ColorPrint.blue("[TRAY] Maximize requested")

    def _restart_application(self, icon=None, item=None) -> None:
        if trigger_app_restart is not None:
            trigger_app_restart()
        ColorPrint.blue("[TRAY] Restart requested")

    def _exit_application(self, icon=None, item=None) -> None:
        if trigger_app_exit is not None:
            trigger_app_exit()
        else:
            if self.parent_ui.root.winfo_exists():
                self.parent_ui.root.quit()
        ColorPrint.blue("[TRAY] Exit requested")

    def _make_switch_tab(self, tab_index: int):
        """Return a callback that invokes main UI switch_to_tab on main thread (for Debug menu)."""
        def _on_tab(icon=None, item=None) -> None:
            self.parent_ui.root.after(0, lambda: self.parent_ui.switch_to_tab(tab_index))
            ColorPrint.gray(f"[TRAY] Debug: switch to tab {tab_index}")
        return _on_tab

    def set_show_callback(self, callback: Callable) -> None:
        """No-op: tray uses event center trigger_window_show."""
        pass

    def set_exit_callback(self, callback: Callable) -> None:
        """No-op: tray uses event center trigger_app_exit."""
        pass

    def update_tooltip(self, text: str) -> None:
        with self._tray_icon_lock:
            icon = self.tray_icon
        if icon is not None:
            icon.title = text

    def show_notification(self, title: str, message: str) -> None:
        with self._tray_icon_lock:
            icon = self.tray_icon
        if icon is not None:
            icon.notify(message, title)
