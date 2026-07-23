#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AppIndicator3 System Tray - Native Ubuntu/GNOME System Tray

Native implementation using GTK3 + AppIndicator3 for Ubuntu/GNOME Shell.
This provides the best system tray experience on Ubuntu 22.04+.

Features:
- Native GNOME Shell integration (no extensions required for basic functionality)
- Better AppIndicator extension compatibility than Qt QSystemTrayIcon
- StatusNotifierItem (SNI) protocol support via D-Bus
- More reliable icon display on startup
- System-level menu integration

Requirements:
    System packages (recommended):
        sudo apt-get install python3-gi gir1.2-appindicator3-0.1

    OR pip packages (requires compilation):
        pip install PyGObject
        sudo apt-get install gir1.2-appindicator3-0.1

Usage:
    from pycore.pyutils.native_ui.step6_tray import AppIndicatorSystemTray

    tray = AppIndicatorSystemTray(
        app_id="my-app",
        app_name="My Application",
        icon_path="/path/to/icon.png"
    )
    tray.set_menu_items(menu_items)
    tray.run()  # Blocks until stopped
"""

import sys
import platform
from typing import Optional, List, Callable, TYPE_CHECKING
from pathlib import Path

from pycore.pyutils.native_ui.step6_tray._types import (
    AppIndicatorMenuItem,
    build_appindicator_menu_items,
)


# Try to import GTK3 + an AppIndicator binding.
#
# Ubuntu differentiation: modern Ubuntu (22.04+/24.04) deprecates the old
# AppIndicator3 (gir1.2-appindicator3-0.1) in favour of Ayatana AppIndicator
# (gir1.2-ayatanaappindicator3-0.1 / AyatanaAppIndicator3). Their APIs are
# identical (Indicator.new / IndicatorCategory / IndicatorStatus / set_menu /
# set_status / set_title / set_icon_full), so we try Ayatana first and fall back
# to the legacy binding, exposing whichever we get as `AppIndicator3`.
APPINDICATOR_AVAILABLE = False
IMPORT_ERROR = None
APPINDICATOR_BACKEND = None  # "ayatana" | "legacy" | None
Gtk = None
AppIndicator3 = None
GLib = None

try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk, GLib

    # 1) Modern Ubuntu: Ayatana AppIndicator
    try:
        gi.require_version('AyatanaAppIndicator3', '0.1')
        from gi.repository import AyatanaAppIndicator3 as AppIndicator3
        APPINDICATOR_AVAILABLE = True
        APPINDICATOR_BACKEND = "ayatana"
    except (ImportError, ValueError):
        # 2) Legacy AppIndicator (older Ubuntu / Debian)
        gi.require_version('AppIndicator3', '0.1')
        from gi.repository import AppIndicator3
        APPINDICATOR_AVAILABLE = True
        APPINDICATOR_BACKEND = "legacy"
except (ImportError, ValueError) as e:
    APPINDICATOR_AVAILABLE = False
    IMPORT_ERROR = str(e)
    Gtk = None
    AppIndicator3 = None
    GLib = None

from pycore import THREAD_BUS, ColorPrint


class AppIndicatorSystemTray:
    """
    Native AppIndicator3 system tray for Ubuntu/GNOME.

    Provides the most reliable system tray experience on Ubuntu 22.04+ with
    GNOME Shell by using the native AppIndicator protocol.

    Advantages over QSystemTrayIcon/pystray:
    - No /tmp icon path issues (Qt problem)
    - Better compatibility with AppIndicator extension
    - Native GNOME Shell integration
    - More reliable startup display
    - Proper StatusNotifierItem protocol support
    """

    def __init__(
        self,
        app_id: str = "pycore-app",
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        icon_name: Optional[str] = None,
        trigger_shutdown_on_exit: bool = True
    ):
        """
        Initialize AppIndicator system tray.

        Args:
            app_id: Unique application ID (used for D-Bus naming)
            app_name: Application name for tooltip
            icon_path: Path to icon file (PNG recommended)
            icon_name: Icon theme name (e.g., "application-default-icon")
                      If both icon_path and icon_name provided, icon_name is used
            trigger_shutdown_on_exit: Trigger THREAD_BUS shutdown when tray exits
        """
        if not APPINDICATOR_AVAILABLE:
            raise RuntimeError(
                f"AppIndicator not available: {IMPORT_ERROR}\n"
                f"Install (modern Ubuntu): sudo apt-get install python3-gi gir1.2-ayatanaappindicator3-0.1\n"
                f"Install (legacy):        sudo apt-get install python3-gi gir1.2-appindicator3-0.1"
            )

        self.app_id = app_id
        self.app_name = app_name
        self.icon_path = icon_path
        self.icon_name = icon_name
        self.trigger_shutdown_on_exit = trigger_shutdown_on_exit

        # Menu items storage
        self.menu_items: List[AppIndicatorMenuItem] = []

        # GTK menu widget
        self.gtk_menu: Optional["Gtk.Menu"] = None

        # AppIndicator instance
        self.indicator: Optional["AppIndicator3.Indicator"] = None

        # Running state
        self._running_signal = f"native_ui.appindicator_tray.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        ColorPrint.blue(f"[AppIndicatorSystemTray] Initialized - App ID: {app_id}")

    def _create_indicator(self):
        """Create AppIndicator3.Indicator instance."""
        # Determine icon to use
        if self.icon_name:
            # Use icon from theme
            icon_id = self.icon_name
            ColorPrint.cyan(f"[AppIndicatorSystemTray] Using theme icon: {icon_id}")
        elif self.icon_path and Path(self.icon_path).exists():
            # Use file path
            icon_id = self.icon_path
            ColorPrint.cyan(f"[AppIndicatorSystemTray] Using icon file: {icon_id}")
        else:
            # Use default application icon
            icon_id = "application-default-icon"
            ColorPrint.yellow(f"[AppIndicatorSystemTray] Using default icon: {icon_id}")

        # Create indicator
        self.indicator = AppIndicator3.Indicator.new(
            self.app_id,
            icon_id,
            AppIndicator3.IndicatorCategory.APPLICATION_STATUS
        )

        # Set status to active (visible)
        self.indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)

        # Set tooltip (GNOME Shell may not show this)
        self.indicator.set_title(self.app_name)

        ColorPrint.green("[AppIndicatorSystemTray] Indicator created")

    def _create_menu(self):
        """Create GTK menu."""
        self.gtk_menu = Gtk.Menu()
        ColorPrint.green("[AppIndicatorSystemTray] Menu created")

    def set_menu_items(self, items: List[AppIndicatorMenuItem]):
        """
        Set tray menu items.

        Args:
            items: List of AppIndicatorMenuItem configurations
        """
        self.menu_items = items
        self._rebuild_menu()

    def _rebuild_menu(self):
        """Rebuild menu from menu items."""
        if not self.gtk_menu:
            self._create_menu()

        # Clear existing menu
        for child in self.gtk_menu.get_children():
            self.gtk_menu.remove(child)

        # Add items
        for item in self.menu_items:
            self._add_menu_item(self.gtk_menu, item)

        # Show all items
        self.gtk_menu.show_all()

        # Set menu to indicator
        if self.indicator:
            self.indicator.set_menu(self.gtk_menu)

        ColorPrint.green(f"[AppIndicatorSystemTray] Menu rebuilt with {len(self.menu_items)} items")

    def _add_menu_item(self, menu: "Gtk.Menu", item: AppIndicatorMenuItem):
        """
        Add menu item to GTK menu.

        Args:
            menu: GTK Menu to add item to
            item: Menu item configuration
        """
        # Separator
        if item.separator or item.text == "---":
            separator = Gtk.SeparatorMenuItem()
            menu.append(separator)
            return

        # Submenu
        if item.submenu:
            submenu_item = Gtk.MenuItem(label=item.text)
            submenu = Gtk.Menu()

            for subitem in item.submenu:
                self._add_menu_item(submenu, subitem)

            submenu_item.set_submenu(submenu)
            menu.append(submenu_item)
            return

        # Regular item
        if item.checkable:
            menu_item = Gtk.CheckMenuItem(label=item.text)
            menu_item.set_active(item.checked)
        else:
            menu_item = Gtk.MenuItem(label=item.text)

        # Set enabled state
        menu_item.set_sensitive(item.enabled)

        # Connect callback
        if item.callback:
            # Wrap callback to trigger via THREAD_BUS if callback is a signal name
            if isinstance(item.callback, str):
                # Callback is a signal name
                signal_name = item.callback
                menu_item.connect("activate", lambda widget: THREAD_BUS.trigger_event(signal_name))
            else:
                # Callback is a function
                menu_item.connect("activate", lambda widget: item.callback())

        # Add to menu
        menu.append(menu_item)

    def update_menu(self, items: List[AppIndicatorMenuItem]):
        """
        Update menu items (thread-safe via GLib.idle_add).

        Args:
            items: New list of menu items
        """
        def _update():
            self.set_menu_items(items)
            return False  # Don't repeat

        GLib.idle_add(_update)

    def update_icon(self, icon_path: Optional[str] = None, icon_name: Optional[str] = None):
        """
        Update tray icon.

        Args:
            icon_path: Path to new icon file
            icon_name: Icon theme name
        """
        if icon_name:
            self.icon_name = icon_name
            if self.indicator:
                self.indicator.set_icon_full(icon_name, self.app_name)
            ColorPrint.cyan(f"[AppIndicatorSystemTray] Icon updated to: {icon_name}")
        elif icon_path and Path(icon_path).exists():
            self.icon_path = icon_path
            if self.indicator:
                self.indicator.set_icon_full(icon_path, self.app_name)
            ColorPrint.cyan(f"[AppIndicatorSystemTray] Icon updated to: {icon_path}")

    def _register_thread_bus_handlers(self):
        """Register THREAD_BUS event handlers (tray.request_stop, tray.update_menu)."""
        def handle_stop_request(event_data):
            ColorPrint.blue("[AppIndicatorSystemTray] Received stop request via THREAD_BUS")
            self.stop()

        def handle_update_menu(event_data):
            items = event_data.get('menu_items')
            if items is not None:
                # THREAD_BUS payload is backend-aware: TrayMenuItem objects
                # (native pystray) OR dicts (PySide6 Qt). This backend needs
                # AppIndicatorMenuItem, so adapt via the shared builder (same
                # one the direct startup callers use). Raw items lack
                # .separator/.callback and crash _add_menu_item.
                ColorPrint.blue("[AppIndicatorSystemTray] Received menu update via THREAD_BUS")
                self.update_menu(build_appindicator_menu_items(items))

        THREAD_BUS.register_event_handler('tray.request_stop', handle_stop_request, priority=10)
        THREAD_BUS.register_event_handler('tray.update_menu', handle_update_menu, priority=10)
        ColorPrint.blue("[AppIndicatorSystemTray] THREAD_BUS event handlers registered")

    def run(self):
        """
        Run tray (blocks until stopped).

        This starts the GTK main loop and blocks until Gtk.main_quit() is called.
        """
        if THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.yellow("[AppIndicatorSystemTray] Already running")
            return

        # Create indicator and menu
        self._create_indicator()

        if not self.gtk_menu:
            self._create_menu()

        # If no menu items were set, add a default Quit item so the menu is not
        # empty (AppIndicator3 shows nothing on click if the menu has 0 children).
        if self.gtk_menu and len(self.gtk_menu.get_children()) == 0:
            quit_item = Gtk.MenuItem(label="Quit")
            quit_item.connect("activate", lambda _: self.stop())
            self.gtk_menu.append(quit_item)
            self.gtk_menu.show_all()

        # Always call set_menu() after the indicator is created.
        # When set_menu_items() was called before run(), _rebuild_menu() built
        # self.gtk_menu but could not call set_menu() because self.indicator was
        # None at that point.  We must set it here unconditionally.
        self.indicator.set_menu(self.gtk_menu)

        # Mark as running
        THREAD_BUS.signal(self._running_signal, True)

        # Register THREAD_BUS handlers so shutdown/update_menu work
        self._register_thread_bus_handlers()

        # Signal that tray is ready
        THREAD_BUS.trigger_event('tray.ready', {'app_id': self.app_id})

        ColorPrint.green(f"[AppIndicatorSystemTray] Running (blocking)...")
        ColorPrint.blue(f"[AppIndicatorSystemTray] App: {self.app_name}")
        ColorPrint.blue(f"[AppIndicatorSystemTray] Icon: {self.icon_name or self.icon_path or 'default'}")

        try:
            # Start GTK main loop (blocks)
            Gtk.main()
        except KeyboardInterrupt:
            ColorPrint.yellow("[AppIndicatorSystemTray] Interrupted by user")
        finally:
            THREAD_BUS.signal(self._running_signal, False)

            # Trigger shutdown if configured
            if self.trigger_shutdown_on_exit:
                ColorPrint.blue("[AppIndicatorSystemTray] Triggering shutdown...")
                THREAD_BUS.trigger_event('app.shutdown', {'source': 'tray_exit'})

            ColorPrint.yellow("[AppIndicatorSystemTray] Stopped")

    def stop(self):
        """
        Stop tray (called from other threads).

        This is thread-safe via GLib.idle_add().
        """
        def _stop():
            ColorPrint.blue("[AppIndicatorSystemTray] Stopping...")
            Gtk.main_quit()
            return False  # Don't repeat

        GLib.idle_add(_stop)

    def is_running(self) -> bool:
        """Check if tray is running."""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))


def check_appindicator_available() -> bool:
    """
    Check if AppIndicator3 is available.

    Returns:
        True if AppIndicator3 can be imported, False otherwise
    """
    return APPINDICATOR_AVAILABLE


def get_appindicator_error() -> Optional[str]:
    """
    Get AppIndicator3 import error message.

    Returns:
        Error message if import failed, None if available
    """
    return IMPORT_ERROR if not APPINDICATOR_AVAILABLE else None


def print_appindicator_status():
    """Print AppIndicator3 availability status."""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" APPINDICATOR3 STATUS")
    ColorPrint.blue("=" * 70)

    if APPINDICATOR_AVAILABLE:
        ColorPrint.green(f"✓ AppIndicator is available (backend: {APPINDICATOR_BACKEND})")

        # Try to get version info
        try:
            ColorPrint.cyan(f"  PyGObject version: {gi.__version__}")
        except:
            pass
    else:
        ColorPrint.red("✗ AppIndicator is NOT available")
        ColorPrint.yellow(f"  Error: {IMPORT_ERROR}")
        ColorPrint.yellow("")
        ColorPrint.yellow("  Installation (modern Ubuntu 22.04+/24.04 - Ayatana):")
        ColorPrint.yellow("    sudo apt-get install python3-gi gir1.2-ayatanaappindicator3-0.1")
        ColorPrint.yellow("")
        ColorPrint.yellow("  Installation (legacy AppIndicator):")
        ColorPrint.yellow("    sudo apt-get install python3-gi gir1.2-appindicator3-0.1")

    ColorPrint.blue("=" * 70)


# Example usage
if __name__ == "__main__":
    print_appindicator_status()

    if not APPINDICATOR_AVAILABLE:
        sys.exit(1)

    # Test tray creation
    tray = AppIndicatorSystemTray(
        app_id="test-app",
        app_name="Test Application",
        icon_name="application-default-icon"
    )

    # Create test menu
    menu_items = [
        AppIndicatorMenuItem(
            text="Show Window",
            callback=lambda: ColorPrint.green("Show clicked")
        ),
        AppIndicatorMenuItem(text="---", separator=True),
        AppIndicatorMenuItem(
            text="Exit",
            callback=lambda: tray.stop()
        )
    ]

    tray.set_menu_items(menu_items)

    # Run (blocks)
    try:
        tray.run()
    except KeyboardInterrupt:
        ColorPrint.yellow("Interrupted")
