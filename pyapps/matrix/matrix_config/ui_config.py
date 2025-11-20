#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - UI Configuration

PySide6 UI configuration for Matrix application.
Uses I18nManager for all text display (no hardcoded strings).
"""

from pathlib import Path
from pycore.pygvar import SYSTEM_SCREEN_RESOLUTION
from pycore.pyfoundations import ColorPrint
from pycore.pyutils.native_ui.i18n import get_i18n_manager

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
ICON_PATH = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")
LOGO_PATH = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")


def get_default_window_size():
    """
    Get default window size based on system screen resolution

    Returns:
        tuple: (width, height)
    """
    if SYSTEM_SCREEN_RESOLUTION:
        width = SYSTEM_SCREEN_RESOLUTION.width
        height = SYSTEM_SCREEN_RESOLUTION.height
        ColorPrint.blue(f"[Matrix UI Config] Using full screen size: {width}x{height}")
        return (width, height)
    else:
        ColorPrint.yellow("[Matrix UI Config] Screen resolution not detected, using default: 1280x900")
        return (1280, 900)


def create_ui_config(frontend_port: int, tray_menu_items: list = None):
    """
    Create PySide6 UI configuration for Matrix application

    Uses I18nManager for all text display (no hardcoded strings).
    All text retrieved using i18n keys with namespace pattern: matrix.*

    Args:
        frontend_port: Frontend server port
        tray_menu_items: List of PySide6TrayMenuItem instances

    Returns:
        PySide6UIConfig: UI configuration object
    """
    from pycore.pyutils.native_ui.pyside6 import PySide6UIConfig

    # Get i18n manager singleton
    i18n = get_i18n_manager()

    default_width, default_height = get_default_window_size()

    return PySide6UIConfig(
        # Application identity (use i18n key, NO default value)
        app_name=i18n.get("matrix.app_name"),
        app_id="matrix",  # Unique ID for window state caching

        # Window settings
        window_size=(default_width, default_height),
        frameless=True,
        show_on_start=True,

        # Icons
        icon_path=ICON_PATH,
        logo_path=LOGO_PATH,
        logo_size=24,

        # WebView settings
        enable_webview=True,
        webview_url=f"http://localhost:{frontend_port}",
        enable_loading_page=True,
        loading_style=10,  # Loading animation style (uses loadin10.html)
        loading_text=i18n.get("matrix.loading"),

        # System tray
        enable_tray=True,
        tray_icon_path=ICON_PATH,
        tray_menu_items=tray_menu_items or [],
        minimize_to_tray=True,

        # Tick timer
        enable_tick_timer=True,
        tick_interval=1.0,

        # Callbacks (set by caller, messages use i18n, NO default values)
        on_ready=lambda: ColorPrint.green(f"[Matrix] {i18n.get('matrix.ui_ready')}"),
        on_closed=lambda: ColorPrint.yellow(f"[Matrix] {i18n.get('matrix.ui_closed')}"),

        # Debug
        debug=False
    )
