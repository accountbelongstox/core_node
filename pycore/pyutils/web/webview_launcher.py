#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Webview GUI Launcher
Extends UniversalGUILauncher with native webview support for desktop applications
Uses pywebview to create a native window displaying the web interface
"""

import os
import sys
import platform
import logging
import time
from typing import Optional, Dict, Any, List, Callable
from pathlib import Path

from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.web.universal_gui_launcher import UniversalGUILauncher


class WebviewGUILauncher(UniversalGUILauncher):
    """
    GUI launcher with native webview window support

    Features:
    - Native desktop window using pywebview
    - System tray icon integration
    - HTTP bridge for backend communication
    - Cross-platform (Windows/Linux/macOS)
    - Fallback to browser if webview unavailable
    """

    def __init__(
        self,
        app_name: str,
        frontend_url: str,
        bridge_host: str = '127.0.0.1',
        bridge_port: int = 8765,
        menu_items: Optional[List[Dict[str, Any]]] = None,
        window_title: Optional[str] = None,
        window_width: int = 1280,
        window_height: int = 800,
        resizable: bool = True,
        fullscreen: bool = False,
        min_size: tuple = (800, 600),
        frameless: bool = False,
        use_webview: bool = True
    ):
        """
        Initialize webview GUI launcher

        Args:
            app_name: Application name for tray icon
            frontend_url: Frontend URL to display in webview (e.g., 'http://localhost:3007')
            bridge_host: HTTP bridge host for backend communication
            bridge_port: HTTP bridge port
            menu_items: Custom tray menu items
            window_title: Window title (defaults to app_name)
            window_width: Window width in pixels
            window_height: Window height in pixels
            resizable: Whether window is resizable
            fullscreen: Start in fullscreen mode
            min_size: Minimum window size (width, height)
            frameless: Use frameless window (borderless)
            use_webview: Enable webview (False = browser fallback only)
        """
        # Initialize parent UniversalGUILauncher
        super().__init__(
            app_name=app_name,
            bridge_host=bridge_host,
            bridge_port=bridge_port,
            menu_items=menu_items
        )

        self.frontend_url = frontend_url
        self.window_title = window_title or app_name
        self.window_width = window_width
        self.window_height = window_height
        self.resizable = resizable
        self.fullscreen = fullscreen
        self.min_size = min_size
        self.frameless = frameless
        self.use_webview = use_webview

        self.webview_available = False
        self.webview_window = None
        self.webview_thread = None

        # Check webview availability
        if use_webview:
            self.webview_available = self._check_webview_availability()

        # Store in ENCYCLOPEDIA
        ENCYCLOPEDIA['webview_gui_launcher'] = self

        ColorPrint.blue(f"[WebviewGUI] Initialized: {app_name}")
        ColorPrint.blue(f"[WebviewGUI] Frontend URL: {frontend_url}")
        ColorPrint.blue(f"[WebviewGUI] Webview: {'Available' if self.webview_available else 'Not Available (will use browser)'}")

    def _check_webview_availability(self) -> bool:
        """
        Check if webview is available

        Returns:
            bool: True if webview can be used
        """
        try:
            import webview
            ColorPrint.green("[WebviewGUI] pywebview is available")
            return True
        except ImportError:
            ColorPrint.yellow("[WebviewGUI] pywebview not installed")
            ColorPrint.yellow("[WebviewGUI] Install with: pip install pywebview")

            # Check for platform-specific requirements
            if platform.system() == 'Linux':
                ColorPrint.yellow("[WebviewGUI] Linux also requires: PyQt5 or PyGObject")
                ColorPrint.yellow("[WebviewGUI] Install with: pip install PyQt5")

            return False

    def _open_web_ui(self):
        """Override parent method to open in webview or browser"""
        if self.webview_available and self.use_webview:
            self._open_webview()
        else:
            # Fallback to browser
            super()._open_web_ui()

    def _open_webview(self):
        """Open frontend in webview window"""
        if not self.webview_available:
            ColorPrint.yellow("[WebviewGUI] Webview not available, opening in browser")
            super()._open_web_ui()
            return

        try:
            import webview

            # Close existing window if any
            if self.webview_window:
                try:
                    self.webview_window.destroy()
                except:
                    pass

            ColorPrint.green(f"[WebviewGUI] Opening webview: {self.frontend_url}")

            # Create webview window
            self.webview_window = webview.create_window(
                title=self.window_title,
                url=self.frontend_url,
                width=self.window_width,
                height=self.window_height,
                resizable=self.resizable,
                fullscreen=self.fullscreen,
                min_size=self.min_size,
                frameless=self.frameless,
                on_top=False,
                confirm_close=False
            )

            # Start webview in separate thread
            import threading
            if self.webview_thread and self.webview_thread.is_alive():
                ColorPrint.yellow("[WebviewGUI] Webview thread already running")
            else:
                self.webview_thread = threading.Thread(
                    target=lambda: webview.start(debug=False),
                    daemon=True
                )
                self.webview_thread.start()

            ColorPrint.green("[WebviewGUI] Webview window opened")

        except Exception as e:
            ColorPrint.red(f"[WebviewGUI] Failed to open webview: {e}")
            ColorPrint.yellow("[WebviewGUI] Falling back to browser")
            super()._open_web_ui()

    def start(self, open_window: bool = True):
        """
        Start webview GUI launcher

        Args:
            open_window: Whether to automatically open the webview window
        """
        ColorPrint.blue(f"[WebviewGUI] Starting {self.app_name}...")

        # Start HTTP bridge
        self.bridge.start()

        # Start system tray (if desktop available)
        tray_started = self.tray.start()

        if not tray_started:
            ColorPrint.yellow("[WebviewGUI] No system tray (headless mode)")

        # Open webview window if requested
        if open_window:
            # Give bridge a moment to start
            time.sleep(0.5)
            self._open_webview()

        ColorPrint.green(f"[WebviewGUI] {self.app_name} started successfully")
        ColorPrint.green(f"[WebviewGUI] Access at: {self.frontend_url}")

    def stop(self):
        """Stop webview GUI launcher"""
        ColorPrint.blue(f"[WebviewGUI] Stopping {self.app_name}...")

        # Close webview window
        if self.webview_window:
            try:
                self.webview_window.destroy()
                ColorPrint.blue("[WebviewGUI] Webview window closed")
            except Exception as e:
                ColorPrint.yellow(f"[WebviewGUI] Error closing webview: {e}")

        # Stop parent services (tray, bridge)
        super().stop()

        ColorPrint.green(f"[WebviewGUI] {self.app_name} stopped")

    def reload_webview(self):
        """Reload the webview window (useful for development)"""
        if self.webview_window:
            try:
                self.webview_window.load_url(self.frontend_url)
                ColorPrint.green("[WebviewGUI] Webview reloaded")
            except Exception as e:
                ColorPrint.red(f"[WebviewGUI] Failed to reload webview: {e}")
        else:
            ColorPrint.yellow("[WebviewGUI] No webview window to reload")

    def set_window_title(self, title: str):
        """
        Set webview window title

        Args:
            title: New window title
        """
        self.window_title = title
        if self.webview_window:
            try:
                self.webview_window.set_title(title)
                ColorPrint.blue(f"[WebviewGUI] Window title set to: {title}")
            except Exception as e:
                ColorPrint.yellow(f"[WebviewGUI] Failed to set title: {e}")


def create_webview_launcher(
    app_name: str,
    frontend_url: str,
    bridge_host: str = '127.0.0.1',
    bridge_port: int = 8765,
    **kwargs
) -> WebviewGUILauncher:
    """
    Create webview GUI launcher instance

    Args:
        app_name: Application name
        frontend_url: Frontend URL to display
        bridge_host: HTTP bridge host
        bridge_port: HTTP bridge port
        **kwargs: Additional arguments for WebviewGUILauncher

    Returns:
        WebviewGUILauncher instance
    """
    launcher = WebviewGUILauncher(
        app_name=app_name,
        frontend_url=frontend_url,
        bridge_host=bridge_host,
        bridge_port=bridge_port,
        **kwargs
    )
    return launcher


def get_webview_launcher() -> Optional[WebviewGUILauncher]:
    """
    Get global webview GUI launcher instance

    Returns:
        WebviewGUILauncher instance or None
    """
    return ENCYCLOPEDIA.get('webview_gui_launcher')


# ============================================================================
# Convenience Functions for pyMatrix Integration
# ============================================================================

def launch_pymatrix_gui(
    backend_host: str = '127.0.0.1',
    backend_port: int = 8000,
    frontend_url: str = 'http://localhost:3007',
    bridge_port: int = 8765,
    window_title: str = 'pyMatrix - Android Device Control',
    **kwargs
) -> WebviewGUILauncher:
    """
    Launch pyMatrix with webview GUI

    Args:
        backend_host: pyMatrix backend API host
        backend_port: pyMatrix backend API port
        frontend_url: Frontend URL (Nuxt app)
        bridge_port: HTTP bridge port for GUI communication
        window_title: Application window title
        **kwargs: Additional webview configuration

    Returns:
        WebviewGUILauncher instance
    """
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(" pyMatrix Webview GUI Launcher")
    ColorPrint.blue("=" * 60)

    # Create custom menu items for pyMatrix
    menu_items = [
        {
            'key': 'open_web',
            'label': 'Open pyMatrix',
            'callback': lambda: None  # Will be overridden
        },
        {
            'key': 'open_backend',
            'label': 'Open Backend API',
            'callback': lambda: _open_backend_url(backend_host, backend_port)
        },
        {
            'key': 'reload',
            'label': 'Reload Window',
            'callback': lambda: _reload_current_webview()
        },
        {
            'key': 'exit',
            'label': 'Exit pyMatrix',
            'callback': lambda: None  # Will be overridden
        }
    ]

    # Create launcher
    launcher = create_webview_launcher(
        app_name='pyMatrix',
        frontend_url=frontend_url,
        bridge_host='127.0.0.1',
        bridge_port=bridge_port,
        menu_items=menu_items,
        window_title=window_title,
        **kwargs
    )

    # Start launcher
    launcher.start(open_window=True)

    ColorPrint.green("=" * 60)
    ColorPrint.green(f" pyMatrix is running")
    ColorPrint.green(f" Backend API: http://{backend_host}:{backend_port}")
    ColorPrint.green(f" Frontend: {frontend_url}")
    ColorPrint.green("=" * 60)

    return launcher


def _open_backend_url(host: str, port: int):
    """Open backend API documentation in browser"""
    import webbrowser
    url = f"http://{host}:{port}/docs"
    ColorPrint.green(f"[WebviewGUI] Opening backend docs: {url}")
    webbrowser.open(url)


def _reload_current_webview():
    """Reload current webview window"""
    launcher = get_webview_launcher()
    if launcher:
        launcher.reload_webview()
    else:
        ColorPrint.yellow("[WebviewGUI] No webview launcher found")


if __name__ == '__main__':
    # Example usage
    import argparse

    parser = argparse.ArgumentParser(description='Webview GUI Launcher')
    parser.add_argument('--app-name', default='Test App', help='Application name')
    parser.add_argument('--url', default='http://localhost:8000', help='Frontend URL')
    parser.add_argument('--bridge-port', type=int, default=8765, help='Bridge port')
    parser.add_argument('--width', type=int, default=1280, help='Window width')
    parser.add_argument('--height', type=int, default=800, help='Window height')

    args = parser.parse_args()

    launcher = create_webview_launcher(
        app_name=args.app_name,
        frontend_url=args.url,
        bridge_port=args.bridge_port,
        window_width=args.width,
        window_height=args.height
    )

    launcher.start()

    try:
        launcher.run_forever()
    except KeyboardInterrupt:
        ColorPrint.yellow("\nShutting down...")
        launcher.stop()
