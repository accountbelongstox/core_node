#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Component
Provides system tray functionality for Windows 10/11.
Icon and run() are created and executed in the tray thread so the Windows
message loop runs in the same thread that owns the icon (required for visibility).
"""

import time
import threading
from typing import Optional, Callable

try:
    import pythoncom
except ImportError:
    pythoncom = None

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.i18n_manager import i18n_manager
from pycore.pyfoundations.third_party import get_third_package_pystray, get_third_package_PIL_Image, get_third_package_PIL_ImageDraw

try:
    from runtime import trigger_window_show, trigger_window_maximize, trigger_app_restart, trigger_app_exit
except ImportError:
    trigger_window_show = trigger_window_maximize = trigger_app_restart = trigger_app_exit = None

try:
    _pystray = get_third_package_pystray()
    _Image = get_third_package_PIL_Image()
    _ImageDraw = get_third_package_PIL_ImageDraw()
    TRAY_AVAILABLE = _pystray is not None and _Image is not None and _ImageDraw is not None
except Exception:
    _pystray = None
    _Image = None
    _ImageDraw = None
    TRAY_AVAILABLE = False

def _create_icon_image():
    """Create tray icon image (PIL). Can be called from any thread."""
    if _Image is None or _ImageDraw is None:
        return None
    try:
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
    except Exception as e:
        ColorPrint.red(f"[TRAY] Failed to create icon image: {e}")
        return _Image.new("RGB", (64, 64), (200, 0, 0)) if _Image else None


class SystemTray(threading.Thread):
    """System tray: Icon is created and run() in this thread so Windows shows the icon."""

    def __init__(self, parent_ui):
        super().__init__(daemon=True, name="TrayRunner")
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
        try:
            if pythoncom is not None:
                pythoncom.CoInitialize()
        except Exception:
            pass
        try:
            icon_image = _create_icon_image()
            if icon_image is None:
                ColorPrint.red("[TRAY] No icon image, tray not shown")
                return
            show_text = i18n_manager.get_ui_text("system_tray.show_software")
            maximize_text = i18n_manager.get_ui_text("system_tray.maximize")
            restart_text = i18n_manager.get_ui_text("system_tray.restart")
            exit_text = i18n_manager.get_ui_text("system_tray.exit")
            title = i18n_manager.get_ui_text("main_window.title")
            menu = _pystray.Menu(
                _pystray.MenuItem(show_text, self._show_window),
                _pystray.MenuItem(maximize_text, self._maximize_window),
                _pystray.MenuItem(restart_text, self._restart_application),
                _pystray.Menu.SEPARATOR,
                _pystray.MenuItem(exit_text, self._exit_application),
            )
            icon = _pystray.Icon("D3Check", icon=icon_image, title=title, menu=menu)
            with self._tray_icon_lock:
                self.tray_icon = icon
            ColorPrint.blue("[TRAY] System tray icon created (in tray thread)")
            icon.run()
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error running tray icon: {e}")
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
        try:
            self.is_running = True
            super().start()
            ColorPrint.green("[TRAY] System tray started")
            return True
        except Exception as e:
            self.is_running = False
            ColorPrint.red(f"[TRAY] Failed to start system tray: {e}")
            return False

    def stop(self) -> None:
        """Stop the tray icon and thread."""
        if not TRAY_AVAILABLE:
            return
        try:
            self.is_running = False
            with self._tray_icon_lock:
                icon = self.tray_icon
            if icon is not None:
                try:
                    icon.stop()
                except Exception:
                    pass
                time.sleep(0.15)
            with self._tray_icon_lock:
                self.tray_icon = None
            ColorPrint.blue("[TRAY] System tray stopped")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Failed to stop system tray: {e}")

    def _show_window(self, icon=None, item=None) -> None:
        try:
            if trigger_window_show is not None:
                trigger_window_show()
            elif hasattr(self.parent_ui, "root"):
                self.parent_ui.root.deiconify()
                self.parent_ui.root.lift()
                self.parent_ui.root.focus_force()
            ColorPrint.blue("[TRAY] Show window requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error showing window: {e}")

    def _maximize_window(self, icon=None, item=None) -> None:
        try:
            if trigger_window_maximize is not None:
                trigger_window_maximize()
            elif hasattr(self.parent_ui, "root"):
                r = self.parent_ui.root
                r.state("zoomed" if r.state() != "zoomed" else "normal")
            ColorPrint.blue("[TRAY] Maximize requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error maximizing: {e}")

    def _restart_application(self, icon=None, item=None) -> None:
        try:
            if trigger_app_restart is not None:
                trigger_app_restart()
            ColorPrint.blue("[TRAY] Restart requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error restarting: {e}")

    def _exit_application(self, icon=None, item=None) -> None:
        try:
            if trigger_app_exit is not None:
                trigger_app_exit()
            elif hasattr(self.parent_ui, "root"):
                self.parent_ui.root.quit()
            ColorPrint.blue("[TRAY] Exit requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error exiting: {e}")

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
            try:
                icon.title = text
            except Exception as e:
                ColorPrint.red(f"[TRAY] Failed to update tooltip: {e}")

    def show_notification(self, title: str, message: str) -> None:
        with self._tray_icon_lock:
            icon = self.tray_icon
        if icon is not None:
            try:
                icon.notify(message, title)
            except Exception as e:
                ColorPrint.red(f"[TRAY] Failed to show notification: {e}")
