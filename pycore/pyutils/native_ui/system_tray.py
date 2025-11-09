#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Component

Provides system tray icon and menu functionality for native UI applications.
Uses pystray library for cross-platform system tray support.

Features:
- System tray icon with custom image
- Context menu with customizable items
- Icon updates and notifications
- Integration with NativeUIThread
- Thread-safe operation

Usage:
    from pycore.pyutils.native_ui import SystemTray, TrayMenuItem

    # Create tray menu items
    items = [
        TrayMenuItem("Show", callback=on_show),
        TrayMenuItem("Settings", callback=on_settings),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem("Exit", callback=on_exit)
    ]

    # Create system tray
    tray = SystemTray(
        app_name="My Application",
        menu_items=items,
        icon_path="icon.png"
    )

    # Start tray (blocking)
    tray.start()
"""

import sys
import threading
import time
from pathlib import Path
from typing import Optional, List, Callable, Any, Union
from dataclasses import dataclass, field

try:
    import pystray
    from pystray import MenuItem as PystrayMenuItem
    from PIL import Image, ImageDraw
    _PYSTRAY_AVAILABLE = True
except ImportError:
    _PYSTRAY_AVAILABLE = False
    pystray = None
    PystrayMenuItem = None

from pycore import ColorPrint


@dataclass
class TrayMenuItem:
    """
    Tray menu item configuration

    Attributes:
        text: Display text for menu item
        callback: Function to call when item is clicked
        enabled: Whether item is enabled
        checked: Whether item shows a checkmark
        default: Whether this is the default action (double-click)
        submenu: Nested menu items
    """
    text: str
    callback: Optional[Callable] = None
    enabled: bool = True
    checked: bool = False
    default: bool = False
    submenu: Optional[List['TrayMenuItem']] = None

    # Separator constant (will be set after class definition)
    SEPARATOR: Optional['TrayMenuItem'] = None

    def is_separator(self) -> bool:
        """Check if this item is a separator"""
        return self.text == "---" and self.callback is None and not self.enabled

    def to_pystray_item(self) -> Union[PystrayMenuItem, pystray.Menu]:
        """Convert to pystray MenuItem"""
        if not _PYSTRAY_AVAILABLE:
            return None

        # Handle separator
        if self.is_separator():
            return pystray.Menu.SEPARATOR

        # Handle submenu
        if self.submenu:
            submenu_items = [item.to_pystray_item() for item in self.submenu]
            return PystrayMenuItem(
                self.text,
                pystray.Menu(*submenu_items),
                enabled=self.enabled
            )

        # Regular menu item
        return PystrayMenuItem(
            self.text,
            self.callback,
            enabled=self.enabled,
            checked=lambda item: self.checked,
            default=self.default
        )


# Initialize SEPARATOR constant after class definition
TrayMenuItem.SEPARATOR = TrayMenuItem(
    text="---",
    callback=None,
    enabled=False
)


class SystemTray:
    """
    System Tray Manager

    Manages system tray icon and menu for native UI applications.
    Provides thread-safe operations and integration with UI frameworks.

    Example:
        ```python
        # Create tray with menu
        tray = SystemTray(
            app_name="My App",
            menu_items=[
                TrayMenuItem("Show", on_show, default=True),
                TrayMenuItem("Exit", on_exit)
            ]
        )

        # Start tray in background thread
        tray.start_async()

        # Update icon
        tray.update_icon("new_icon.png")

        # Stop tray
        tray.stop()
        ```
    """

    def __init__(
        self,
        app_name: str = "Application",
        menu_items: Optional[List[TrayMenuItem]] = None,
        icon_path: Optional[str] = None,
        tooltip: Optional[str] = None,
        on_left_click: Optional[Callable] = None
    ):
        """
        Initialize system tray

        Args:
            app_name: Application name
            menu_items: List of menu items
            icon_path: Path to icon image file
            tooltip: Tooltip text for tray icon
            on_left_click: Callback for left click on icon
        """
        if not _PYSTRAY_AVAILABLE:
            ColorPrint.yellow("pystray not available, system tray disabled")
            self.available = False
            return

        self.available = True
        self.app_name = app_name
        self.menu_items = menu_items or []
        self.icon_path = icon_path
        self.tooltip = tooltip or app_name
        self.on_left_click = on_left_click

        # Tray state
        self._icon: Optional[pystray.Icon] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._ready = threading.Event()

        # Create default icon if no icon path provided
        self._image = self._load_icon(icon_path)

        ColorPrint.blue(f"[SystemTray] Initialized for {app_name}")

    def _load_icon(self, icon_path: Optional[str] = None) -> Image.Image:
        """
        Load icon from file or create default icon

        Args:
            icon_path: Path to icon image file

        Returns:
            PIL Image object
        """
        if icon_path and Path(icon_path).exists():
            try:
                return Image.open(icon_path)
            except Exception as e:
                ColorPrint.yellow(f"[SystemTray] Failed to load icon: {e}")

        # Create default icon (simple circle)
        size = 64
        image = Image.new('RGB', (size, size), color='white')
        draw = ImageDraw.Draw(image)

        # Draw circle
        margin = 8
        draw.ellipse(
            [margin, margin, size - margin, size - margin],
            fill='#2196F3',  # Blue
            outline='#1976D2'
        )

        return image

    def _build_menu(self) -> pystray.Menu:
        """
        Build pystray menu from menu items

        Returns:
            pystray.Menu object
        """
        pystray_items = []

        for item in self.menu_items:
            pystray_item = item.to_pystray_item()
            if pystray_item is not None:
                pystray_items.append(pystray_item)

        return pystray.Menu(*pystray_items)

    def _setup_tray(self):
        """Setup tray icon"""
        try:
            # Create menu
            menu = self._build_menu() if self.menu_items else None

            # Create icon
            self._icon = pystray.Icon(
                self.app_name,
                self._image,
                self.tooltip,
                menu
            )

            # Set left click handler if provided
            if self.on_left_click:
                self._icon.on_activate = lambda: self.on_left_click()

            ColorPrint.green(f"[SystemTray] Tray icon created")

        except Exception as e:
            ColorPrint.red(f"[SystemTray] Failed to setup tray: {e}")
            import traceback
            traceback.print_exc()

    def start(self):
        """
        Start system tray (blocking)

        This method blocks until the tray is stopped.
        Use start_async() to run in background thread.
        """
        if not self.available:
            ColorPrint.print_warn("[SystemTray] Not available, skipping")
            return

        if self._running:
            ColorPrint.print_warn("[SystemTray] Already running")
            return

        ColorPrint.blue("[SystemTray] Starting tray (blocking)...")

        self._running = True
        self._setup_tray()

        if self._icon:
            self._ready.set()
            ColorPrint.green("[SystemTray] Tray started")

            try:
                # Run tray (blocking)
                self._icon.run()
            except Exception as e:
                ColorPrint.red(f"[SystemTray] Tray error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                self._running = False
                ColorPrint.yellow("[SystemTray] Tray stopped")

    def start_async(self):
        """
        Start system tray in background thread (non-blocking)

        Returns immediately after starting the tray thread.
        """
        if not self.available:
            ColorPrint.print_warn("[SystemTray] Not available, skipping")
            return

        if self._running:
            ColorPrint.print_warn("[SystemTray] Already running")
            return

        ColorPrint.blue("[SystemTray] Starting tray (async)...")

        # Start tray in background thread
        self._thread = threading.Thread(
            target=self.start,
            name=f"SystemTray-{self.app_name}",
            daemon=True
        )
        self._thread.start()

        # Wait for tray to be ready
        if self._ready.wait(timeout=5):
            ColorPrint.green("[SystemTray] Tray thread started")
        else:
            ColorPrint.yellow("[SystemTray] Tray thread start timeout")

    def stop(self):
        """Stop system tray"""
        if not self.available:
            return

        if not self._running:
            ColorPrint.yellow("[SystemTray] Not running")
            return

        ColorPrint.yellow("[SystemTray] Stopping tray...")

        if self._icon:
            try:
                self._icon.stop()
            except Exception as e:
                ColorPrint.yellow(f"[SystemTray] Error stopping tray: {e}")

        self._running = False
        self._ready.clear()

        # Wait for thread to finish
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

        ColorPrint.green("[SystemTray] Tray stopped")

    def is_running(self) -> bool:
        """Check if tray is running"""
        return self._running

    def update_icon(self, icon_path: str):
        """
        Update tray icon image

        Args:
            icon_path: Path to new icon image
        """
        if not self.available or not self._icon:
            return

        try:
            new_image = self._load_icon(icon_path)
            self._image = new_image
            self._icon.icon = new_image
            ColorPrint.blue(f"[SystemTray] Icon updated: {icon_path}")
        except Exception as e:
            ColorPrint.yellow(f"[SystemTray] Failed to update icon: {e}")

    def update_tooltip(self, tooltip: str):
        """
        Update tray icon tooltip

        Args:
            tooltip: New tooltip text
        """
        if not self.available or not self._icon:
            return

        try:
            self.tooltip = tooltip
            self._icon.title = tooltip
            ColorPrint.blue(f"[SystemTray] Tooltip updated: {tooltip}")
        except Exception as e:
            ColorPrint.yellow(f"[SystemTray] Failed to update tooltip: {e}")

    def update_menu(self, menu_items: List[TrayMenuItem]):
        """
        Update tray menu items

        Args:
            menu_items: New list of menu items
        """
        if not self.available or not self._icon:
            return

        try:
            self.menu_items = menu_items
            new_menu = self._build_menu()
            self._icon.menu = new_menu
            ColorPrint.blue("[SystemTray] Menu updated")
        except Exception as e:
            ColorPrint.yellow(f"[SystemTray] Failed to update menu: {e}")

    def notify(self, title: str, message: str):
        """
        Show notification from tray icon

        Args:
            title: Notification title
            message: Notification message
        """
        if not self.available or not self._icon:
            return

        try:
            self._icon.notify(message, title)
            ColorPrint.blue(f"[SystemTray] Notification: {title}")
        except Exception as e:
            ColorPrint.yellow(f"[SystemTray] Failed to show notification: {e}")


# Convenience function
def create_system_tray(
    app_name: str = "Application",
    menu_items: Optional[List[TrayMenuItem]] = None,
    icon_path: Optional[str] = None,
    tooltip: Optional[str] = None,
    on_left_click: Optional[Callable] = None,
    start_async: bool = True
) -> SystemTray:
    """
    Create and optionally start a system tray

    Args:
        app_name: Application name
        menu_items: List of menu items
        icon_path: Path to icon image
        tooltip: Tooltip text
        on_left_click: Left click callback
        start_async: Start tray in background thread

    Returns:
        SystemTray instance
    """
    tray = SystemTray(
        app_name=app_name,
        menu_items=menu_items,
        icon_path=icon_path,
        tooltip=tooltip,
        on_left_click=on_left_click
    )

    if start_async:
        tray.start_async()

    return tray
