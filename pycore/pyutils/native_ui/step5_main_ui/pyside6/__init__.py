#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI - PySide6 Components

This package contains all PySide6-based UI components.

IMPORTANT: All UI components (except startup_window.py) must use PySide6.
"""

# Import PySide6 via third_party manager (will auto-install if needed)
from pycore.pyfoundations.third_party import get_third_package_pyside6

# Ensure PySide6 is available
get_third_package_pyside6()

# Import PySide6 modules
from PySide6.QtCore import Qt, QObject, Signal, Slot, QTimer
from PySide6.QtWidgets import QApplication, QMainWindow, QWidget
from PySide6.QtGui import QIcon

_PYSIDE6_AVAILABLE = True

# Import components
from .config import PySide6UIConfig, StartupWindowConfig, ActionType, WindowState, WebViewEngine
from .main_window import PySide6MainWindow, MainWindowContainer, ResizeEdge
from .window_state import WindowStateManager, WindowState as WindowStateData
from .title_bar import PySide6TitleBar, TitleBarButton
from .title_bar_styles import (
    TitleBarStyles,
    get_default_style,
    get_dark_style,
    get_light_style,
    get_vibrant_style,
    get_minimal_style,
    merge_styles,
    create_custom_style,
    StyleSheetGenerator,
)
from .system_tray import PySide6SystemTray, PySide6TrayMenuItem, create_default_tray_menu
from .webview import PySide6WebView
from .framework import PySide6Framework, TickTimer, create_framework
from .ui_thread import PySide6UIThread

__all__ = [
    # Availability flag
    '_PYSIDE6_AVAILABLE',

    # Configuration
    'PySide6UIConfig',
    'StartupWindowConfig',
    'ActionType',
    'WindowState',
    'WebViewEngine',

    # Main Window
    'PySide6MainWindow',
    'MainWindowContainer',
    'ResizeEdge',

    # Window State Management
    'WindowStateManager',
    'WindowStateData',

    # Title Bar
    'PySide6TitleBar',
    'TitleBarButton',

    # Title Bar Styles
    'TitleBarStyles',
    'get_default_style',
    'get_dark_style',
    'get_light_style',
    'get_vibrant_style',
    'get_minimal_style',
    'merge_styles',
    'create_custom_style',
    'StyleSheetGenerator',

    # System Tray
    'PySide6SystemTray',
    'PySide6TrayMenuItem',
    'create_default_tray_menu',

    # WebView
    'PySide6WebView',

    # Framework
    'PySide6Framework',
    'TickTimer',
    'create_framework',

    # UI Thread
    'PySide6UIThread',
]

