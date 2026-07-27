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

from __future__ import annotations  # Enable deferred type hint evaluation

import hashlib
import json
import threading
from pathlib import Path
from typing import List, Optional, Callable, TYPE_CHECKING
from dataclasses import dataclass

from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_pystray

# i18n for multi-language support (pycore-internal: direct top import, never lazy)
from pycore.pyutils.native_ui.step0_i18n import i18n

# Use lazy loader to get pystray (handles X11 display errors gracefully)
pystray = get_third_package_pystray()
PYSTRAY_AVAILABLE = pystray is not None

# Import PIL only if pystray is available
if PYSTRAY_AVAILABLE:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        PYSTRAY_AVAILABLE = False
        pystray = None
        Image = None
        ImageDraw = None
else:
    Image = None
    ImageDraw = None

# Type checking imports (not evaluated at runtime)
if TYPE_CHECKING and pystray is not None:
    import pystray as pystray_types


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
        checked: Optional checked state (None = no checkbox, True = checked, False = unchecked)
        state_getter: Optional callable that returns current state for dynamic updates
        enabled_getter: Optional callable that returns whether the item is enabled
        text_args: Optional format args applied to the (translated) text, e.g.
                   text="tray.menu.rpc_server" + text_args={"port": 59000} with the
                   translation "RPC v2 Server: {port}"
    """
    text: str
    action_signal: str
    icon_name: Optional[str] = None
    enabled: bool = True
    default: bool = False
    submenu: Optional[List['TrayMenuItem']] = None
    checked: Optional[bool] = None
    state_getter: Optional[Callable] = None
    enabled_getter: Optional[Callable] = None
    text_args: Optional[dict] = None

    def is_enabled(self) -> bool:
        """Resolve enabled state; enabled_getter wins when provided."""
        if self.enabled_getter is not None:
            try:
                return bool(self.enabled_getter())
            except Exception:
                return self.enabled
        return self.enabled

    def get_display_text(self) -> str:
        """
        Get display text with state prefix and i18n support

        Returns:
            Text with optional state indicator prefix (translated if i18n key)
        """
        # Translate text if it's an i18n key (e.g., "tray.menu.show")
        translated_text = self.text
        if self.text and not self.text.startswith("["):  # Skip already formatted text
            # Try to translate the text key
            translated = i18n.get(self.text)
            # Only use translation if it's different from the key (meaning translation exists)
            if translated != self.text:
                translated_text = translated

        # Apply dynamic format args (e.g. port numbers) to the translated template
        if self.text_args:
            try:
                translated_text = translated_text.format(**self.text_args)
            except (KeyError, IndexError, ValueError):
                pass  # malformed template: show it untouched rather than crash the tray

        # If state_getter is provided, use it to get current state
        if self.state_getter:
            state_text = self.state_getter()
            return f"{state_text} {translated_text}" if state_text else translated_text

        # Otherwise use checked state
        if self.checked is None:
            return translated_text
        elif self.checked:
            return f"[X] {translated_text}"  # ASCII compatible
        else:
            return f"[ ] {translated_text}"

    # Separator constant
    SEPARATOR = None  # Will be set after class definition


# Set separator constant
TrayMenuItem.SEPARATOR = TrayMenuItem(text="---", action_signal="", enabled=False)


class TkinterSystemTray:
    """
    System tray implementation using pystray

    Runs in the Tkinter thread and communicates via THREAD_BUS.
    Supports global shutdown coordination to ensure all services exit together.
    """

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        menu_items: Optional[List[TrayMenuItem]] = None,
        trigger_shutdown_on_exit: bool = True
    ):
        """
        Initialize system tray

        Args:
            app_name: Application name to display in tray
            icon_path: Path to tray icon image (.png, .ico)
            menu_items: List of TrayMenuItem objects
            trigger_shutdown_on_exit: If True, trigger THREAD_BUS shutdown when tray exits
                                     This ensures all services (UI, RPC, etc.) exit together
        """
        if not PYSTRAY_AVAILABLE:
            raise ImportError("pystray is not installed. Install it with: pip install pystray pillow")

        self.app_name = app_name
        self.icon_path = icon_path
        self.menu_items = menu_items or []
        self.trigger_shutdown_on_exit = trigger_shutdown_on_exit

        self._tray_icon: Optional[pystray.Icon] = None
        self._running_signal = f"native_ui.tkinter_tray.running.{id(self)}"
        self._menu_signature = {'value': None}
        THREAD_BUS.signal(self._running_signal, False)

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
            # In pystray, submenu is passed as the 'action' parameter (Menu object)
            return pystray.MenuItem(
                text=item.get_display_text(),
                action=submenu,  # Menu object as action creates a submenu
                enabled=item.is_enabled()
            )

        # Create menu item with callback
        def callback(icon, menu_item):
            """Callback that triggers THREAD_BUS event and updates menu"""
            if signal_name:
                display_text = item.get_display_text()
                ColorPrint.blue(f"[TRAY] Menu item clicked: {display_text} -> signal: {signal_name}")
                THREAD_BUS.trigger_event(signal_name, {
                    "text": item.text,
                    "signal": signal_name  # Include signal name in event_data
                })

                # Auto-refresh menu after action to reflect state changes
                if self._tray_icon and THREAD_BUS.get_signal(self._running_signal, False):
                    self._refresh_menu()

        # Handle checked state
        checked_func = None
        if item.checked is not None or item.state_getter is not None:
            def checked_func(menu_item):
                """Dynamic checked state"""
                if item.state_getter:
                    # State getter returns string, we check if it's not empty/disabled
                    state = item.state_getter()
                    return state and state.strip() and state != "[ ]"
                return item.checked or False

        return pystray.MenuItem(
            text=item.get_display_text(),
            action=callback,
            enabled=item.is_enabled(),
            default=item.default,
            checked=checked_func
        )

    def _build_menu(self) -> pystray.Menu:
        """
        Build pystray menu from menu items

        Returns:
            pystray.Menu
        """
        menu_items = [self._create_menu_item(item) for item in self.menu_items]
        return pystray.Menu(*menu_items)

    def _register_thread_bus_handlers(self):
        """Register THREAD_BUS event handlers (called in tray thread)"""
        def handle_stop_request(event_data):
            """Handle tray.request_stop event"""
            ColorPrint.blue("[TRAY] Received stop request via THREAD_BUS")
            self.stop()

        def handle_update_menu(event_data):
            """Handle tray.update_menu event"""
            menu_items = event_data.get('menu_items')
            if menu_items:
                signature = self._menu_signature_value(menu_items)
                if signature == self._menu_signature.get('value'):
                    ColorPrint.blue("[TRAY] Menu unchanged, skip rebuild")
                    return
                self._menu_signature['value'] = signature
                ColorPrint.blue("[TRAY] Received menu update via THREAD_BUS")
                self.update_menu(menu_items)

        def handle_language_changed(event_data):
            """Rebuild the menu so item texts pick up the new language"""
            ColorPrint.blue("[TRAY] Language changed, refreshing menu")
            self._refresh_menu()

        THREAD_BUS.register_event_handler('tray.request_stop', handle_stop_request, priority=10)
        THREAD_BUS.register_event_handler('tray.update_menu', handle_update_menu, priority=10)
        # pystray bakes item texts at build time (unlike the Win32 backend, which
        # rebuilds on every right-click), so re-translate on language change.
        THREAD_BUS.register_event_handler('ui.i18n.language_changed', handle_language_changed, priority=10)
        ColorPrint.blue("[TRAY] THREAD_BUS event handlers registered")

        latest_menu_payload = THREAD_BUS.get_signal("tray.menu.payload")
        if isinstance(latest_menu_payload, dict):
            handle_update_menu(latest_menu_payload)

    def run(self):
        """
        Start system tray (blocking)

        This method blocks until stop() is called.
        """
        if THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.yellow("[TRAY] Already running")
            return

        ColorPrint.blue(f"[TRAY] Starting system tray: {self.app_name}")

        # Load icon
        icon_image = self._load_icon()

        # Create menu
        menu = self._build_menu()

        # Create tray icon with setup callback
        def on_setup(icon):
            """Called when tray is ready (in tray thread)"""
            # Register THREAD_BUS event handlers
            self._register_thread_bus_handlers()
            # Signal that tray is ready
            THREAD_BUS.signal('TkinterTray_ready', {"app_name": self.app_name})
            ColorPrint.green(f"[TRAY] Tray icon ready: {self.app_name}")

        self._tray_icon = pystray.Icon(
            name=self.app_name,
            icon=icon_image,
            title=self.app_name,
            menu=menu
        )

        THREAD_BUS.signal(self._running_signal, True)

        # Run tray with setup callback (blocking)
        self._tray_icon.run(setup=on_setup)

        # Cleanup after tray stops
        THREAD_BUS.signal(self._running_signal, False)
        ColorPrint.blue("[TRAY] System tray stopped")
        THREAD_BUS.signal('TkinterTray_stopped', {"app_name": self.app_name})

    def stop(self):
        """
        Stop system tray

        This will cause run() to return.
        If trigger_shutdown_on_exit=True, this will also trigger global shutdown.
        """
        if not THREAD_BUS.get_signal(self._running_signal, False):
            return

        ColorPrint.blue("[TRAY] Stopping system tray...")
        if self._tray_icon:
            self._tray_icon.stop()

        # Trigger global shutdown if configured (but avoid duplicate shutdown)
        if self.trigger_shutdown_on_exit and not THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow("[TRAY] Triggering global shutdown...")
            THREAD_BUS.request_shutdown(
                reason="System tray closed",
                execute_handlers=True
            )

    def _refresh_menu(self):
        """
        Refresh menu by rebuilding from current menu items

        This is called automatically after menu actions to reflect state changes.
        """
        if self._tray_icon and THREAD_BUS.get_signal(self._running_signal, False):
            self._tray_icon.menu = self._build_menu()
            # On Windows, reassigning .menu alone does not refresh the live popup;
            # update_menu() forces pystray to rebuild the Win32 menu handle.
            try:
                self._tray_icon.update_menu()
            except Exception:
                pass

    def update_menu(self, menu_items: List[TrayMenuItem]):
        """
        Update tray menu items

        Args:
            menu_items: New list of TrayMenuItem objects
        """
        signature = self._menu_signature_value(menu_items)
        if signature == self._menu_signature.get('value'):
            return
        self._menu_signature['value'] = signature
        self.menu_items = menu_items

        if self._tray_icon and THREAD_BUS.get_signal(self._running_signal, False):
            self._tray_icon.menu = self._build_menu()
            # On Windows, reassigning .menu alone does not refresh the live popup;
            # update_menu() forces pystray to rebuild the Win32 menu handle.
            try:
                self._tray_icon.update_menu()
            except Exception:
                pass
            ColorPrint.blue("[TRAY] Menu updated")

    @staticmethod
    def _menu_signature_value(menu_items: List[TrayMenuItem]) -> str:
        """Stable signature for tray menu payloads."""
        from pycore.pyutils.native_ui.step0_i18n import i18n

        def normalize_item(item):
            children = getattr(item, "submenu", None)
            data = {
                "text": getattr(item, "text", None),
                "default": bool(getattr(item, "default", False)),
                "action": getattr(item, "action_signal", None) or getattr(item, "signal", None),
            }
            if children:
                data["submenu"] = [normalize_item(sub_item) for sub_item in children]
            if getattr(item, "checked", None) is not None:
                data["checked"] = item.checked
            if getattr(item, "enabled_getter", None) is None:
                data["enabled"] = bool(getattr(item, "enabled", True))
            return data

        normalized = {
            "items": [normalize_item(menu_item) for menu_item in menu_items],
            "codesync": THREAD_BUS.get_signal("tray.codesync.state", {}),
            "language": i18n.get_current_language(),
            "voice_subtitle_visible": THREAD_BUS.get_signal(
                "voice_subtitle_ui.window_visible", False
            ),
        }

        try:
            payload = json.dumps(
                normalized, sort_keys=True, ensure_ascii=False, default=str
            ).encode("utf-8")
            return hashlib.md5(payload).hexdigest()
        except Exception:
            return hashlib.md5(str(menu_items).encode("utf-8")).hexdigest()


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
