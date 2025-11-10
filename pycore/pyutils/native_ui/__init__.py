#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Utilities Package

Provides utilities for native UI applications including:
- Timer management for periodic tasks
- Internationalization (i18n) support
- File monitoring for log files and configuration
- Shutdown management for graceful application termination
- Tkinter themed widgets and styling system
- WebView-based UI frameworks

Modules:
    - timer_manager: Periodic task execution system
    - i18n: Multi-language support system
    - file_monitor: File change monitoring system
    - shutdown_manager: Unified shutdown control system
    - tkinter: Themed Tkinter widgets and styling (ThemeSystem, StyledWidgets)
    - webview_framework: WebView-based UI framework

Usage:
    from pycore.pyutils.native_ui import (
        TimerManager,
        I18nManager,
        FileMonitor,
        LogFileMonitor,
        ShutdownManager,
        ThemeSystem,
        StyledWidgets
    )

    # Timer management
    timer_mgr = TimerManager()
    timer_mgr.register_task("my_task", interval=5.0, callback=my_function)
    timer_mgr.start()

    # I18n management
    i18n = I18nManager()
    i18n.initialize(config_dir="/path/to/i18n")
    text = i18n.get("welcome_message")
    i18n.set_language("zh")

    # File monitoring
    monitor = FileMonitor()
    monitor.set_file("/path/to/log.txt")
    monitor.set_callback(lambda content: print(content))
    monitor.start()

    # Shutdown management
    shutdown_mgr = ShutdownManager()
    shutdown_mgr.add_shutdown_hook("cleanup", cleanup_function, priority=10)
    shutdown_mgr.request_shutdown()

    # Tkinter themed UI
    import tkinter as tk
    root = tk.Tk()

    # Get theme colors
    bg_color = ThemeSystem.get_color('bg_primary')

    # Create styled widgets
    button = StyledWidgets.create_button(
        root,
        text="Click Me",
        button_type='primary'
    )
"""

# Timer Manager
from pycore.pyutils.native_ui.timer_manager import (
    TimerManager,
    TimerTask,
    get_timer_manager
)

# I18n Manager
from pycore.pyutils.native_ui.i18n import (
    I18nManager,
    get_i18n_manager
)

# File Monitor
from pycore.pyutils.native_ui.file_monitor import (
    FileMonitor,
    LogFileMonitor
)

# Shutdown Manager
from pycore.pyutils.native_ui.shutdown_manager import (
    ShutdownManager,
    ShutdownHook,
    get_shutdown_manager
)

# System Tray (now in pyside6 package)
# Legacy tkinter system tray has been removed
# Use: from pycore.pyutils.native_ui.pyside6 import PySide6SystemTray

# Startup Window and Launcher
from pycore.pyutils.native_ui.startup_window import StartupWindow, ColorPrintCapture
from pycore.pyutils.native_ui.launcher_with_startup import launch_app_with_startup, launch_matrix_with_startup

# Tkinter UI Components (if available)
try:
    from pycore.pyutils.native_ui.tkinter import ThemeSystem, StyledWidgets
    _TKINTER_AVAILABLE = True
except ImportError:
    _TKINTER_AVAILABLE = False

# Base components (always available)
try:
    from pycore.pyutils.native_ui.config import UIConfig, WindowState
    from pycore.pyutils.native_ui.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
    _BASE_AVAILABLE = True
except ImportError:
    _BASE_AVAILABLE = False

# PySide6 Framework (recommended)
try:
    from pycore.pyutils.native_ui.pyside6 import (
        PySide6Framework,
        PySide6UIConfig,
        PySide6MainWindow,
        PySide6TitleBar,
        PySide6SystemTray,
        PySide6WebView,
        create_framework
    )
    _PYSIDE6_AVAILABLE = True
except ImportError:
    _PYSIDE6_AVAILABLE = False

__all__ = [
    # Timer Manager
    'TimerManager',
    'TimerTask',
    'get_timer_manager',

    # I18n Manager
    'I18nManager',
    'get_i18n_manager',

    # File Monitor
    'FileMonitor',
    'LogFileMonitor',

    # Shutdown Manager
    'ShutdownManager',
    'ShutdownHook',
    'get_shutdown_manager',

    # System Tray - moved to pyside6 package
    # 'SystemTray',  # DEPRECATED - use PySide6SystemTray
    # 'TrayMenuItem',  # DEPRECATED - use PySide6TrayMenuItem
    # 'create_system_tray',  # DEPRECATED

    # Startup Window and Launcher
    'StartupWindow',
    'ColorPrintCapture',
    'launch_app_with_startup',
    'launch_matrix_with_startup',
]

# Add Tkinter exports if available
if _TKINTER_AVAILABLE:
    __all__.extend([
        # Tkinter UI Components
        'ThemeSystem',
        'StyledWidgets',
    ])

# Add base component exports if available
if _BASE_AVAILABLE:
    __all__.extend([
        'UIConfig',
        'WindowState',
        'SignalManager',
        'SignalType',
        'Signal',
        'TaskTimer',
        'MainThreadExecutor',
    ])

# Add PySide6 framework exports if available
if _PYSIDE6_AVAILABLE:
    __all__.extend([
        # PySide6 Framework (RECOMMENDED)
        'PySide6Framework',
        'PySide6UIConfig',
        'PySide6MainWindow',
        'PySide6TitleBar',
        'PySide6SystemTray',
        'PySide6WebView',
        'create_framework',
    ])
