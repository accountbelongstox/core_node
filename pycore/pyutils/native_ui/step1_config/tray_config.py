#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified System Tray Configuration

Provides a unified interface for system tray configuration that works with both:
- Tkinter backend (pystray) - lightweight, no Qt dependency
- PySide6 backend (QSystemTrayIcon) - full Qt integration

All communication happens via THREAD_BUS, no parameter passing required.

Usage:
    from pycore.pyutils.native_ui.tray_config import TrayConfig, TrayMenuItem, TrayBackend

    # Define tray configuration
    tray_config = TrayConfig(
        app_name="My Application",
        icon_path="/path/to/icon.png",
        backend=TrayBackend.TKINTER,  # or TrayBackend.PYSIDE6
        menu_items=[
            TrayMenuItem(text="Show", signal="tray_show", default=True),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(text="Exit", signal="tray_exit")
        ]
    )

    # Store in THREAD_BUS (accessible globally)
    from pycore import THREAD_BUS
    THREAD_BUS.set('tray_config', tray_config)

    # Listen for tray signals
    THREAD_BUS.on('tray_show', lambda data: print("Show clicked"))
    THREAD_BUS.on('tray_exit', lambda data: print("Exit clicked"))
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusSignals



class TrayBackend(Enum):
    """System tray backend options"""
    TKINTER = "tkinter"        # Uses pystray (lightweight, cross-platform)
    PYSIDE6 = "pyside6"        # Uses QSystemTrayIcon (Qt-based)
    APPINDICATOR = "appindicator"  # Uses AppIndicator3 (native Ubuntu/GNOME)
    AUTO = "auto"              # Auto-detect best available backend


@dataclass
class TrayMenuItem:
    """
    Unified tray menu item configuration

    Works with both Tkinter and PySide6 backends.
    Communication happens via THREAD_BUS signals.

    Attributes:
        text_key: I18n translation key constant (e.g., I18nKeys.TRAY_MENU_SHOW or MCPServerI18nKeys.APP_NAME)
                 Text will be dynamically translated from i18n.get(text_key) based on current language when building menu
        signal: Signal name to emit via THREAD_BUS when clicked
        icon: Optional icon path or name
        enabled: Whether the item is enabled
        default: Whether this is the default action (double-click)
        checkable: Whether the item is checkable (toggle)
        checked: Initial checked state (if checkable)
        submenu: Optional list of sub-menu items
    """
    text_key: str  # I18n key constant - text will be dynamically translated via i18n.get(text_key)
    signal: str = ""
    icon: Optional[str] = None
    enabled: bool = True
    default: bool = False
    checkable: bool = False
    checked: bool = False
    submenu: Optional[List['TrayMenuItem']] = None

    # Separator constant
    SEPARATOR: 'TrayMenuItem' = None  # Will be set after class definition

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for THREAD_BUS storage"""
        return {
            "text_key": self.text_key,
            "signal": self.signal,
            "icon": self.icon,
            "enabled": self.enabled,
            "default": self.default,
            "checkable": self.checkable,
            "checked": self.checked,
            "submenu": [item.to_dict() for item in self.submenu] if self.submenu else None
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'TrayMenuItem':
        """Create from dictionary (from THREAD_BUS)"""
        submenu_data = data.get('submenu')
        submenu = [TrayMenuItem.from_dict(item) for item in submenu_data] if submenu_data else None

        return TrayMenuItem(
            text_key=data.get('text_key', ''),
            signal=data.get('signal', ''),
            icon=data.get('icon'),
            enabled=data.get('enabled', True),
            default=data.get('default', False),
            checkable=data.get('checkable', False),
            checked=data.get('checked', False),
            submenu=submenu
        )


# Set separator constant
TrayMenuItem.SEPARATOR = TrayMenuItem(text_key="---", signal="", enabled=False)


@dataclass
class TrayConfig:
    """
    Unified system tray configuration

    Stored in THREAD_BUS for global access without parameter passing.

    Attributes:
        enabled: Whether system tray is enabled
        backend: Which backend to use (tkinter, pyside6, auto)
        app_name: Application name for tray tooltip
        icon_path: Path to tray icon image
        menu_items: List of tray menu items
        show_on_minimize: Whether to minimize to tray instead of taskbar
        start_minimized: Whether to start minimized to tray
        close_to_tray: Whether closing window minimizes to tray
    """
    enabled: bool = True
    backend: TrayBackend = TrayBackend.AUTO
    app_name: str = "Application"
    icon_path: Optional[str] = None
    menu_items: List[TrayMenuItem] = field(default_factory=list)
    show_on_minimize: bool = True
    start_minimized: bool = False
    close_to_tray: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for THREAD_BUS storage"""
        return {
            "enabled": self.enabled,
            "backend": self.backend.value,
            "app_name": self.app_name,
            "icon_path": self.icon_path,
            "menu_items": [item.to_dict() for item in self.menu_items],
            "show_on_minimize": self.show_on_minimize,
            "start_minimized": self.start_minimized,
            "close_to_tray": self.close_to_tray
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'TrayConfig':
        """Create from dictionary (from THREAD_BUS)"""
        backend_str = data.get('backend', 'auto')
        backend = TrayBackend(backend_str)

        menu_items_data = data.get('menu_items', [])
        menu_items = [TrayMenuItem.from_dict(item) for item in menu_items_data]

        return TrayConfig(
            enabled=data.get('enabled', True),
            backend=backend,
            app_name=data.get('app_name', 'Application'),
            icon_path=data.get('icon_path'),
            menu_items=menu_items,
            show_on_minimize=data.get('show_on_minimize', True),
            start_minimized=data.get('start_minimized', False),
            close_to_tray=data.get('close_to_tray', True)
        )


def create_default_tray_menu(app_name: str) -> List[TrayMenuItem]:
    """
    Create default tray menu

    Signals emitted via THREAD_BUS (using BusSignals):
    - BusSignals.TRAY_SHOW ('ui.tray.show'): Show main window
    - BusSignals.TRAY_EXIT ('ui.tray.exit'): Exit application

    Args:
        app_name: Application name (not used, kept for compatibility)

    Returns:
        List of TrayMenuItem objects
    """
    # Import I18nKeys and BusSignals here to avoid circular import
    try:
        return [
            TrayMenuItem(
                text_key=I18nKeys.TRAY_MENU_SHOW,
                signal=BusSignals.TRAY_SHOW,  # Use BusSignals.TRAY_SHOW instead of "tray_show"
                default=True
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text_key=I18nKeys.TRAY_MENU_RESTART,
                signal=BusSignals.TRAY_RESTART  # Use BusSignals.TRAY_RESTART
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text_key=I18nKeys.TRAY_MENU_EXIT,
                signal=BusSignals.TRAY_EXIT  # Use BusSignals.TRAY_EXIT instead of "tray_exit"
            )
        ]
    except ImportError:
        # Fallback if I18nKeys not available (use hardcoded signal names)
        return [
            TrayMenuItem(
                text_key="tray.menu.show",
                signal="ui.tray.show",  # Use full signal path
                default=True
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text_key="tray.menu.restart",
                signal="ui.tray.restart"  # Use full signal path
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text_key="tray.menu.exit",
                signal="ui.tray.exit"  # Use full signal path
            )
        ]


# DEPRECATED: Use thread_bus_manager.BusKeys and BusSignals instead
# This class is kept for backward compatibility only
import warnings

class TrayBusKeys:
    """
    DEPRECATED: Use thread_bus_manager.BusKeys and BusSignals instead

    Standard THREAD_BUS keys for tray system
    """

    def __init__(self):
        warnings.warn(
            "TrayBusKeys is deprecated. Use BusKeys and BusSignals from "
            "pycore.pyutils.native_ui.step7_managers.thread_bus_manager instead.",
            DeprecationWarning,
            stacklevel=2
        )

    # Configuration - use thread_bus_manager.BusKeys.TRAY_CONFIG
    TRAY_CONFIG = "ui.tray.config"

    # Status - use thread_bus_manager.BusKeys
    TRAY_BACKEND = "ui.tray.backend"
    TRAY_READY = "ui.tray.ready"
    TRAY_VISIBLE = "ui.tray.visible"

    # Signals - use thread_bus_manager.BusSignals
    TRAY_SHOW = "ui.tray.show"
    TRAY_EXIT = "ui.tray.exit"
    TRAY_MENU_CLICKED = "ui.tray.menu_clicked"

    # Commands - use thread_bus_manager.BusSignals
    TRAY_UPDATE_MENU = "ui.tray.update_menu"
    TRAY_UPDATE_ICON = "ui.tray.update_icon"
    TRAY_SHOW_MESSAGE = "ui.tray.show_message"
    TRAY_STOP = "ui.tray.stop"

    # Lifecycle signals - use thread_bus_manager.BusSignals
    TRAY_STARTED = "ui.tray.started"
    TRAY_STOPPED = "ui.tray.stopped"


# Example usage
if __name__ == "__main__":
    from pycore import THREAD_BUS, ColorPrint

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" TRAY CONFIG TEST")
    ColorPrint.blue("=" * 70)

    # Create tray configuration
    tray_config = TrayConfig(
        enabled=True,
        backend=TrayBackend.TKINTER,
        app_name="Test Application",
        icon_path=None,
        menu_items=create_default_tray_menu("Test App")
    )

    # Store in THREAD_BUS
    THREAD_BUS.set(TrayBusKeys.TRAY_CONFIG, tray_config)

    # Retrieve from THREAD_BUS
    retrieved_config = THREAD_BUS.get(TrayBusKeys.TRAY_CONFIG)

    ColorPrint.green(f"Stored config: {tray_config.app_name}")
    ColorPrint.green(f"Retrieved config: {retrieved_config.app_name}")
    ColorPrint.green(f"Backend: {retrieved_config.backend.value}")
    ColorPrint.green(f"Menu items: {len(retrieved_config.menu_items)}")

    # Convert to dict and back
    config_dict = tray_config.to_dict()
    restored_config = TrayConfig.from_dict(config_dict)

    ColorPrint.blue(f"Serialization test: {restored_config.app_name}")

    ColorPrint.blue("=" * 70)
