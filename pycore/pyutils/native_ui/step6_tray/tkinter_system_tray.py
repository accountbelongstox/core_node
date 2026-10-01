#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pystray system tray running on its own thread; menu clicks emit THREAD_BUS events."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_pystray,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step1_config.tray_config import TrayMenuItem

pystray = get_third_package_pystray()
Image = get_third_package_PIL_Image() if pystray is not None else None
ImageDraw = get_third_package_PIL_ImageDraw() if pystray is not None else None
PYSTRAY_AVAILABLE = pystray is not None and Image is not None and ImageDraw is not None

DEFAULT_ICON_SIZE = 64
TRAY_EVENT_SOURCE = "tray_menu"
DEFAULT_ICON_MARGIN = 8


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
            except OSError as e:
                ColorPrint.yellow(f"[TRAY] Failed to load icon from {self.icon_path}: {e}")

        # Create default icon (simple circle)
        return self._create_default_icon()

    def _create_default_icon(self) -> Image:
        """
        Create a default icon (blue circle)

        Returns:
            PIL Image object
        """
        width = height = DEFAULT_ICON_SIZE
        image = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(image)
        margin = DEFAULT_ICON_MARGIN
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
        if item.is_separator():
            return pystray.Menu.SEPARATOR

        signal_name = item.action_signal
        submenu_items = item.submenu
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
                    "signal": signal_name,
                    "source": TRAY_EVENT_SOURCE,
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

        latest_menu_payload = THREAD_BUS.get_signal(BusSignals.TRAY_MENU_PAYLOAD)
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
            self._apply_menu()

    def _apply_menu(self):
        """Reassign the menu; update_menu() forces the Win32 backend to rebuild its handle."""
        self._tray_icon.menu = self._build_menu()
        try:
            self._tray_icon.update_menu()
        except NotImplementedError as exc:
            ColorPrint.yellow(f"[TRAY] pystray backend cannot refresh menu: {exc}")

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
            self._apply_menu()
            ColorPrint.blue("[TRAY] Menu updated")

    @staticmethod
    def _menu_signature_value(menu_items: List[TrayMenuItem]) -> str:
        """Stable signature for tray menu payloads."""

        def normalize_item(item):
            data = {"text": item.text, "default": bool(item.default), "action": item.action_signal}
            if item.submenu:
                data["submenu"] = [normalize_item(sub_item) for sub_item in item.submenu]
            if item.checked is not None:
                data["checked"] = item.checked
            if item.enabled_getter is None:
                data["enabled"] = bool(item.enabled)
            return data

        normalized = {
            "items": [normalize_item(menu_item) for menu_item in menu_items],
            "codesync": THREAD_BUS.get_signal(BusSignals.TRAY_CODESYNC_STATE, {}),
            "language": i18n.get_current_language(),
            "voice_subtitle_visible": THREAD_BUS.get_signal(
                BusSignals.VOICE_SUBTITLE_UI_WINDOW_VISIBLE, False
            ),
        }

        payload = json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
        return hashlib.md5(payload).hexdigest()
