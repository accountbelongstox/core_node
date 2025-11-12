#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Utilities Package

Provides utilities for native UI applications including:
- Simplified application launcher (launch_native_app)
- Built-in timer manager (singleton, auto-started)
- Internationalization (i18n) support
- Shutdown management for graceful application termination
- PySide6/Tkinter UI frameworks
- System tray integration

RECOMMENDED: Use the simplified launcher API
    from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

    config = NativeUIConfig(
        app_id="matrix",
        app_name="Matrix Application",
        main_entry=main_app_entry,
        url="http://localhost:3000",
        enable_timer=True,  # Auto-start timer manager
        enable_tray=True
    )
    launch_native_app(config)

Timer Management (Built-in Singleton):
    The timer manager is automatically started if enable_timer=True in config.
    You don't need to create or start it manually.

    # Just register tasks anywhere in your code
    from pycore.pyutils.native_ui import get_timer_manager

    timer_mgr = get_timer_manager()
    timer_mgr.register_task("my_task", interval=5.0, callback=my_callback)
    # That's it! The timer is already running if enabled

I18n Management (Singleton):
    from pycore.pyutils.native_ui import get_i18n_manager

    i18n = get_i18n_manager()
    text = i18n.get("welcome_message")
    i18n.set_language("zh")

Shutdown Management:
    from pycore.pyutils.native_ui import get_shutdown_manager

    shutdown_mgr = get_shutdown_manager()
    shutdown_mgr.add_shutdown_hook("cleanup", cleanup_function, priority=10)
    shutdown_mgr.request_shutdown()
"""

# Timer Manager
from pycore.pyutils.native_ui.step7_managers.timer_manager import (
    TimerManager,
    TimerTask,
    get_timer_manager
)

# I18n Manager
from pycore.pyutils.native_ui.step9_i18n import (
    I18nManager,
    get_i18n_manager
)

# File Monitor (DEPRECATED - Not UI related, will be moved to pyutils)
# from pycore.pyutils.native_ui.step7_managers.file_monitor import (
#     FileMonitor,
#     LogFileMonitor
# )

# Shutdown Manager
from pycore.pyutils.native_ui.step7_managers.shutdown_manager import (
    ShutdownManager,
    ShutdownHook,
    get_shutdown_manager
)

# System Tray (now in pyside6 package)
# Legacy tkinter system tray has been removed
# Use: from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6SystemTray

# THREAD_BUS Manager (scoped access)
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import (
    NativeUIBusManager,
    get_bus_manager,
    BusNamespaces,
    BusKeys,
    BusSignals,
    DependencyInfo
)

# Startup Window and Launcher
from pycore.pyutils.native_ui.step4_startup.startup_window import StartupWindow, ColorPrintCapture
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
from pycore.pyutils.native_ui.step3_launcher.launcher_with_startup import launch_app_with_startup

# NEW: Simplified Native App Launcher (RECOMMENDED)
from pycore.pyutils.native_ui.step1_config.app_config import NativeUIConfig, TrayMenuItem
from pycore.pyutils.native_ui.step3_launcher.launch_native_app import launch_native_app, launch
from pycore.pyutils.native_ui.step2_port_url.port_allocator import get_port_range
from pycore.pyutils.native_ui.step2_port_url.url_handler import URLHandler, process_url

# Tkinter UI Components (if available)
try:
    from pycore.pyutils.native_ui.step5_main_ui.tkinter import ThemeSystem, StyledWidgets
    _TKINTER_AVAILABLE = True
except ImportError:
    _TKINTER_AVAILABLE = False

# Base components (always available)
try:
    from pycore.pyutils.native_ui.step1_config.config import UIConfig, WindowState
    from pycore.pyutils.native_ui.step8_utils.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
    _BASE_AVAILABLE = True
except ImportError:
    _BASE_AVAILABLE = False

# PySide6 Framework (recommended)
try:
    from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
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
    # Timer Manager (Built-in singleton, auto-started if enabled)
    'TimerManager',
    'TimerTask',
    'get_timer_manager',

    # I18n Manager
    'I18nManager',
    'get_i18n_manager',

    # File Monitor - DEPRECATED (Not UI related)
    # 'FileMonitor',
    # 'LogFileMonitor',

    # Shutdown Manager
    'ShutdownManager',
    'ShutdownHook',
    'get_shutdown_manager',

    # THREAD_BUS Manager (NEW - recommended for all UI components)
    'NativeUIBusManager',
    'get_bus_manager',
    'BusNamespaces',
    'BusKeys',
    'BusSignals',
    'DependencyInfo',

    # System Tray - moved to pyside6 package
    # 'SystemTray',  # DEPRECATED - use PySide6SystemTray
    # 'TrayMenuItem',  # DEPRECATED - use PySide6TrayMenuItem
    # 'create_system_tray',  # DEPRECATED

    # Startup Window and Launcher
    'StartupWindow',
    'TkinterStartupThread',
    'ColorPrintCapture',
    'launch_app_with_startup',

    # NEW: Simplified Native App Launcher (RECOMMENDED)
    'NativeUIConfig',
    'TrayMenuItem',
    'launch_native_app',
    'launch',
    'get_port_range',
    'URLHandler',
    'process_url',
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
