#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI - PySide6 Components

This package contains all PySide6-based UI components.

IMPORTANT: All UI components (except startup_window.py) must use PySide6.
"""

# Check PySide6 availability
_PYSIDE6_AVAILABLE = False

# Check if PySide6 modules are available
import importlib.util
pyside6_spec = importlib.util.find_spec("PySide6")
if pyside6_spec is not None:
    from PySide6.QtCore import Qt, QObject, Signal, Slot, QTimer
    from PySide6.QtWidgets import QApplication, QMainWindow, QWidget
    from PySide6.QtGui import QIcon
    _PYSIDE6_AVAILABLE = True

__all__ = ['_PYSIDE6_AVAILABLE']

# Import components if PySide6 is available
if _PYSIDE6_AVAILABLE:
    from .config import PySide6UIConfig, StartupWindowConfig, ActionType, WindowState, WebViewEngine
    from .main_window import PySide6MainWindow, MainWindowContainer
    from .title_bar import PySide6TitleBar, TitleBarButton
    from .system_tray import PySide6SystemTray, PySide6TrayMenuItem, create_default_tray_menu
    from .webview import PySide6WebView
    from .framework import PySide6Framework, TickTimer, create_framework

    __all__.extend([
        # Configuration
        'PySide6UIConfig',
        'StartupWindowConfig',
        'ActionType',
        'WindowState',
        'WebViewEngine',

        # Main Window
        'PySide6MainWindow',
        'MainWindowContainer',

        # Title Bar
        'PySide6TitleBar',
        'TitleBarButton',

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
    ])
