#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tkinter-based System Tray using pystray

This module provides system tray functionality that runs in the Tkinter thread.
Uses pystray library for cross-platform system tray support.
Communicates with main thread via THREAD_BUS signals.

Usage:
    from pycore import THREAD_BUS
    from pycore.pyutils.native_ui.tkinter_system_tray import TkinterSystemTray, TrayMenuItem

    # Define menu items with callbacks
    menu_items = [
        TrayMenuItem(
            text="Open Application",
            action_signal="tray_action_open",  # Signal to emit via THREAD_BUS
            icon_name=None  # Optional icon
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Exit",
            action_signal="tray_action_exit"
        )
    ]

    # Create tray
    tray = TkinterSystemTray(
        app_name="My Application",
        icon_path="/path/to/icon.png",
        menu_items=menu_items
    )

    # Start tray (blocks until tray.stop() is called)
    tray.run()

    # In main thread, listen for signals
    def handle_open():
        print("Open clicked")

    THREAD_BUS.on('tray_action_open', handle_open)
"""

import threading
from pathlib import Path
from typing import List, Optional, Callable
from dataclasses import dataclass

try:
    import pystray
    from PIL import Image, ImageDraw
    PYSTRAY_AVAILABLE = True
except ImportError:
    PYSTRAY_AVAILABLE = False
    pystray = None
    Image = None

from pycore import THREAD_BUS, ColorPrint


@dataclass
class TrayMenuItem:
    """
    System tray menu item configuration

    Attributes:
        text: Display text for the menu item
        action_signal: Signal name to emit via THREAD_BUS when clicked
        icon_name: Optional icon name (not implemented yet)
        enabled: Whether the item is enabled (default: True)
        default: Whether this is the default action (double-click) (default: False)
        submenu: Optional list of submenu items
    """
    text: str
    action_signal: str
    icon_name: Optional[str] = None
    enabled: bool = True
    default: bool = False
    submenu: Optional[List['TrayMenuItem']] = None

    # Separator constant
    SEPARATOR = None  # Will be set after class definition


# Set separator constant
TrayMenuItem.SEPARATOR = TrayMenuItem(text="---", action_signal="", enabled=False)


class TkinterSystemTray:
    """
    System tray implementation using pystray

    Runs in the Tkinter thread and communicates via THREAD_BUS.
    """

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        menu_items: Optional[List[TrayMenuItem]] = None
    ):
        """
        Initialize system tray

        Args:
            app_name: Application name to display in tray
            icon_path: Path to tray icon image (.png, .ico)
            menu_items: List of TrayMenuItem objects
        """
        if not PYSTRAY_AVAILABLE:
            raise ImportError("pystray is not installed. Install it with: pip install pystray pillow")

        self.app_name = app_name
        self.icon_path = icon_path
        self.menu_items = menu_items or []

        self._tray_icon: Optional[pystray.Icon] = None
        self._running = False
        self._stop_requested = False

    def _load_icon(self) -> Image:
        """
        Load tray icon image

        Returns:
            PIL Image object
        """
        if self.icon_path and Path(self.icon_path).exists():
            try:
                return Image.open(self.icon_path)
            except Exception as e:
                ColorPrint.yellow(f"[TRAY] Failed to load icon from {self.icon_path}: {e}")

        # Create default icon (simple circle)
        return self._create_default_icon()

    def _create_default_icon(self) -> Image:
        """
        Create a default icon (blue circle)

        Returns:
            PIL Image object
        """
        width = 64
        height = 64
        image = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(image)

        # Draw blue circle
        margin = 8
        draw.ellipse(
            [margin, margin, width - margin, height - margin],
            fill='#2196F3',
            outline='#1976D2',
            width=2
        )

        return image

    def _create_menu_item(self, item: TrayMenuItem) -> pystray.MenuItem:
        """
        Create pystray menu item from TrayMenuItem

        Args:
            item: TrayMenuItem configuration (from tray_config or tkinter_system_tray)

        Returns:
            pystray.MenuItem
        """
        # Handle separator
        if item.text == "---":
            return pystray.Menu.SEPARATOR

        # Get signal name - support both 'signal' (from tray_config) and 'action_signal' (from tkinter_system_tray)
        signal_name = getattr(item, 'action_signal', None) or getattr(item, 'signal', None)

        # Handle submenu if present
        submenu_items = getattr(item, 'submenu', None)
        if submenu_items:
            # Create submenu items recursively
            submenu = pystray.Menu(*[self._create_menu_item(sub_item) for sub_item in submenu_items])
            return pystray.MenuItem(
                text=item.text,
                submenu=submenu,
                enabled=item.enabled
            )

        # Create menu item with callback
        def callback(icon, menu_item):
            """Callback that triggers THREAD_BUS event"""
            if signal_name:
                ColorPrint.blue(f"[TRAY] Menu item clicked: {item.text} -> signal: {signal_name}")
                THREAD_BUS.trigger_event(signal_name, {
                    "text": item.text,
                    "signal": signal_name  # Include signal name in event_data
                })

        return pystray.MenuItem(
            text=item.text,
            action=callback,
            enabled=item.enabled,
            default=item.default
        )

    def _build_menu(self) -> pystray.Menu:
        """
        Build pystray menu from menu items

        Returns:
            pystray.Menu
        """
        menu_items = [self._create_menu_item(item) for item in self.menu_items]
        return pystray.Menu(*menu_items)

    def run(self):
        """
        Start system tray (blocking)

        This method blocks until stop() is called.
        """
        if self._running:
            ColorPrint.yellow("[TRAY] Already running")
            return

        ColorPrint.blue(f"[TRAY] Starting system tray: {self.app_name}")

        # Load icon
        icon_image = self._load_icon()

        # Create menu
        menu = self._build_menu()

        # Create tray icon
        self._tray_icon = pystray.Icon(
            name=self.app_name,
            icon=icon_image,
            title=self.app_name,
            menu=menu
        )

        # Signal that tray is ready
        THREAD_BUS.signal('TkinterTray_ready', {"app_name": self.app_name})

        self._running = True

        # Run tray (blocking)
        try:
            self._tray_icon.run()
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error: {e}")
        finally:
            self._running = False
            ColorPrint.blue("[TRAY] System tray stopped")
            THREAD_BUS.signal('TkinterTray_stopped', {"app_name": self.app_name})

    def stop(self):
        """
        Stop system tray

        This will cause run() to return.
        """
        if not self._running:
            return

        ColorPrint.blue("[TRAY] Stopping system tray...")
        self._stop_requested = True

        if self._tray_icon:
            self._tray_icon.stop()

    def update_menu(self, menu_items: List[TrayMenuItem]):
        """
        Update tray menu items

        Args:
            menu_items: New list of TrayMenuItem objects
        """
        self.menu_items = menu_items

        if self._tray_icon and self._running:
            menu = self._build_menu()
            self._tray_icon.menu = menu
            ColorPrint.blue("[TRAY] Menu updated")


# Example menu items
def create_default_tray_menu(
    app_name: str,
    show_action_signal: str = "tray_action_show",
    exit_action_signal: str = "tray_action_exit"
) -> List[TrayMenuItem]:
    """
    Create default tray menu

    Args:
        app_name: Application name
        show_action_signal: Signal to emit when "Show" is clicked
        exit_action_signal: Signal to emit when "Exit" is clicked

    Returns:
        List of TrayMenuItem objects
    """
    return [
        TrayMenuItem(
            text=f"Show {app_name}",
            action_signal=show_action_signal,
            default=True
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Exit",
            action_signal=exit_action_signal
        )
    ]


# Test
if __name__ == "__main__":
    # Example usage
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" TKINTER SYSTEM TRAY TEST")
    ColorPrint.blue("=" * 70)

    # Setup signal handlers
    def handle_show():
        ColorPrint.green("[MAIN] Show action received")

    def handle_exit():
        ColorPrint.yellow("[MAIN] Exit action received")
        tray.stop()

    THREAD_BUS.on('tray_action_show', handle_show)
    THREAD_BUS.on('tray_action_exit', handle_exit)

    # Create menu
    menu_items = create_default_tray_menu("Test App")

    # Create and run tray
    tray = TkinterSystemTray(
        app_name="Test Application",
        menu_items=menu_items
    )

    ColorPrint.green("System tray running. Right-click tray icon to test menu.")
    ColorPrint.yellow("Click 'Exit' in tray menu to stop.")

    # Run (blocking)
    tray.run()

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" TEST ENDED")
    ColorPrint.blue("=" * 70)
