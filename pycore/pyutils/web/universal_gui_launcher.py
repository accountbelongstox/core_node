#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Universal GUI Launcher
Provides cross-platform GUI launcher with system tray support (Windows/Linux desktop)
or pure HTTP server mode (headless environments)
"""

import os
import sys
import platform
import logging
import webbrowser
from typing import Dict, List, Callable, Optional, Any
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint


class SystemTrayManager:
    """Cross-platform system tray manager"""

    def __init__(self, app_name: str, menu_items: List[Dict[str, Any]]):
        """
        Initialize system tray manager

        Args:
            app_name: Application name for tray icon
            menu_items: List of menu item dicts with keys: 'key', 'label', 'callback'
                       Example: [{'key': 'open_web', 'label': 'Open Web UI', 'callback': func}]
        """
        self.app_name = app_name
        self.menu_items = menu_items
        self.logger = logging.getLogger('SystemTray')
        self.tray_instance = None
        self.running = False

        # Detect platform and desktop environment
        self.has_desktop = self._detect_desktop_environment()

        ColorPrint.blue(f"[SystemTray] Platform: {platform.system()}, Desktop: {self.has_desktop}")

    def _detect_desktop_environment(self) -> bool:
        """
        Detect if desktop environment is available

        Returns:
            bool: True if desktop environment detected
        """
        system = platform.system()

        if system == 'Windows':
            # Windows always has desktop for our purposes
            return True

        elif system == 'Linux':
            # Check for common desktop environment variables
            desktop_vars = ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_CURRENT_DESKTOP', 'DESKTOP_SESSION']
            for var in desktop_vars:
                if os.environ.get(var):
                    ColorPrint.green(f"[SystemTray] Desktop detected via {var}={os.environ.get(var)}")
                    return True

            ColorPrint.yellow("[SystemTray] No desktop environment detected on Linux")
            return False

        else:
            # Darwin (macOS) or other - assume desktop available
            return True

    def start(self) -> bool:
        """
        Start system tray

        Returns:
            bool: True if tray started successfully
        """
        if not self.has_desktop:
            ColorPrint.yellow("[SystemTray] No desktop environment - skipping tray creation")
            return False

        try:
            # Import pystray only if desktop is available
            import pystray
            from PIL import Image, ImageDraw

            # Create icon image
            icon_image = self._create_icon_image()

            # Build menu
            menu = self._build_menu(pystray)

            # Create tray icon
            self.tray_instance = pystray.Icon(
                self.app_name,
                icon_image,
                self.app_name,
                menu
            )

            # Run tray in background thread
            import threading
            tray_thread = threading.Thread(target=self.tray_instance.run, daemon=True)
            tray_thread.start()

            self.running = True
            ColorPrint.green(f"[SystemTray] Tray started for {self.app_name}")
            return True

        except ImportError as e:
            ColorPrint.yellow(f"[SystemTray] pystray not available: {e}")
            ColorPrint.yellow("[SystemTray] Install with: pip install pystray pillow")
            return False

        except Exception as e:
            ColorPrint.red(f"[SystemTray] Failed to start tray: {e}")
            return False

    def _create_icon_image(self):
        """
        Create simple icon image

        Returns:
            PIL.Image: Icon image
        """
        from PIL import Image, ImageDraw

        # Create 64x64 icon with simple design
        width = 64
        height = 64
        image = Image.new('RGB', (width, height), 'black')
        draw = ImageDraw.Draw(image)

        # Draw simple geometric shape (circle)
        draw.ellipse([8, 8, 56, 56], fill='blue', outline='white', width=2)

        return image

    def _build_menu(self, pystray):
        """
        Build tray menu from menu items

        Args:
            pystray: pystray module reference

        Returns:
            pystray.Menu: Menu object
        """
        menu_entries = []

        for item in self.menu_items:
            key = item.get('key')
            label = item.get('label', key)
            callback = item.get('callback')

            if callback:
                menu_entries.append(
                    pystray.MenuItem(label, lambda icon, item, cb=callback: cb())
                )

        return pystray.Menu(*menu_entries)

    def stop(self):
        """Stop system tray"""
        if self.tray_instance and self.running:
            try:
                self.tray_instance.stop()
                self.running = False
                ColorPrint.blue("[SystemTray] Tray stopped")
            except Exception as e:
                ColorPrint.yellow(f"[SystemTray] Error stopping tray: {e}")

    def is_running(self) -> bool:
        """Check if tray is running"""
        return self.running


class UniversalGUILauncher:
    """Universal GUI launcher with tray + HTTP bridge support"""

    def __init__(
        self,
        app_name: str,
        bridge_host: str = '127.0.0.1',
        bridge_port: int = 8765,
        menu_items: Optional[List[Dict[str, Any]]] = None
    ):
        """
        Initialize universal GUI launcher

        Args:
            app_name: Application name
            bridge_host: HTTP bridge host
            bridge_port: HTTP bridge port
            menu_items: Custom menu items (will add default items if None)
        """
        self.app_name = app_name
        self.bridge_host = bridge_host
        self.bridge_port = bridge_port
        self.logger = logging.getLogger('UniversalGUI')

        # HTTP Bridge
        from pycore.pyutils.web.http_bridge import HTTPBridgeServer
        self.bridge = HTTPBridgeServer(bridge_host, bridge_port)

        # Menu items
        if menu_items is None:
            menu_items = self._create_default_menu_items()
        else:
            # Ensure required menu items exist
            menu_items = self._ensure_required_menu_items(menu_items)

        # System tray
        self.tray = SystemTrayManager(app_name, menu_items)

        # Store in ENCYCLOPEDIA
        ENCYCLOPEDIA['universal_gui_launcher'] = self

        ColorPrint.blue(f"[UniversalGUI] Initialized for {app_name}")

    def _create_default_menu_items(self) -> List[Dict[str, Any]]:
        """
        Create default menu items

        Returns:
            List of menu item dicts
        """
        return [
            {
                'key': 'open_web',
                'label': self._get_menu_label('open_web', 'Open Web UI'),
                'callback': self._open_web_ui
            },
            {
                'key': 'restart',
                'label': self._get_menu_label('restart', 'Restart'),
                'callback': self._restart_application
            },
            {
                'key': 'exit',
                'label': self._get_menu_label('exit', 'Exit'),
                'callback': self._exit_application
            }
        ]

    def _ensure_required_menu_items(self, menu_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ensure menu items contain required entries

        Args:
            menu_items: User-provided menu items

        Returns:
            Complete menu items list
        """
        required_keys = {'open_web', 'restart', 'exit'}
        existing_keys = {item.get('key') for item in menu_items}

        # Add missing required items with defaults
        if 'open_web' not in existing_keys:
            menu_items.insert(0, {
                'key': 'open_web',
                'label': self._get_menu_label('open_web', 'Open Web UI'),
                'callback': self._open_web_ui
            })

        if 'exit' not in existing_keys:
            menu_items.append({
                'key': 'exit',
                'label': self._get_menu_label('exit', 'Exit'),
                'callback': self._exit_application
            })

        return menu_items

    def _get_menu_label(self, key: str, default: str) -> str:
        """
        Get menu label from ENCYCLOPEDIA (for i18n support)

        Args:
            key: Menu item key
            default: Default label if not found

        Returns:
            Menu label string
        """
        # Check ENCYCLOPEDIA for i18n labels
        # Format: ENCYCLOPEDIA['gui_menu_labels'][key] = 'Translated Label'
        menu_labels = ENCYCLOPEDIA.get('gui_menu_labels', {})
        return menu_labels.get(key, default)

    def _open_web_ui(self):
        """Open web UI in browser"""
        url = f"http://{self.bridge_host}:{self.bridge_port}"
        ColorPrint.green(f"[UniversalGUI] Opening web UI: {url}")

        try:
            webbrowser.open(url)
        except Exception as e:
            ColorPrint.red(f"[UniversalGUI] Failed to open browser: {e}")

    def _restart_application(self):
        """Restart application"""
        ColorPrint.yellow("[UniversalGUI] Restarting application...")

        # Set restart flag in ENCYCLOPEDIA
        ENCYCLOPEDIA['restart_requested'] = True

        # Stop services
        self.stop()

        # Restart process
        import subprocess
        subprocess.Popen([sys.executable] + sys.argv)
        sys.exit(0)

    def _exit_application(self):
        """Exit application"""
        ColorPrint.yellow("[UniversalGUI] Exiting application...")

        # Set exit flag in ENCYCLOPEDIA
        ENCYCLOPEDIA['exit_requested'] = True

        # Stop services
        self.stop()

        sys.exit(0)

    def get_bridge(self):
        """Get HTTP bridge instance"""
        return self.bridge

    def register_bridge_handler(self, method: str, path: str, handler: Callable):
        """
        Register HTTP bridge handler

        Args:
            method: 'GET' or 'POST'
            path: URL path
            handler: Handler function
        """
        if method.upper() == 'GET':
            self.bridge.register_get_handler(path, handler)
        elif method.upper() == 'POST':
            self.bridge.register_post_handler(path, handler)
        else:
            raise ValueError(f"Invalid method: {method}")

    def start(self):
        """Start GUI launcher (bridge + tray)"""
        ColorPrint.blue(f"[UniversalGUI] Starting {self.app_name}...")

        # Start HTTP bridge
        self.bridge.start()

        # Start system tray (if desktop available)
        tray_started = self.tray.start()

        if not tray_started:
            ColorPrint.yellow("[UniversalGUI] Running in headless mode (HTTP bridge only)")
            ColorPrint.green(f"[UniversalGUI] Access at: http://{self.bridge_host}:{self.bridge_port}")

        ColorPrint.green(f"[UniversalGUI] {self.app_name} started successfully")

    def stop(self):
        """Stop GUI launcher"""
        ColorPrint.blue(f"[UniversalGUI] Stopping {self.app_name}...")

        # Stop tray
        self.tray.stop()

        # Stop bridge
        self.bridge.stop()

        ColorPrint.green(f"[UniversalGUI] {self.app_name} stopped")

    def is_running(self) -> bool:
        """Check if launcher is running"""
        return self.bridge.is_running()

    def run_forever(self):
        """Run GUI launcher until interrupted"""
        import signal
        import time

        def signal_handler(sig, frame):
            ColorPrint.yellow("\n[UniversalGUI] Shutdown signal received...")
            self.stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)

        ColorPrint.green(f"[UniversalGUI] {self.app_name} running. Press Ctrl+C to stop.")

        # Keep main thread alive
        while self.is_running():
            time.sleep(1)


def get_universal_gui_launcher() -> Optional[UniversalGUILauncher]:
    """
    Get global universal GUI launcher instance

    Returns:
        UniversalGUILauncher instance or None
    """
    return ENCYCLOPEDIA.get('universal_gui_launcher')


def set_menu_labels(labels: Dict[str, str]):
    """
    Set menu labels for i18n support

    Args:
        labels: Dict mapping menu keys to translated labels
                Example: {'open_web': 'Open Web UI', 'exit': 'Exit'}
    """
    ENCYCLOPEDIA['gui_menu_labels'] = labels
    ColorPrint.blue(f"[UniversalGUI] Menu labels set: {list(labels.keys())}")
