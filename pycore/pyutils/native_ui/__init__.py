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
    from pycore.pyutils.native_ui.step0_i18n import i18n
    from pathlib import Path
    
    # i18n is pre-initialized with base translations
    # Extend with app translations in start() function (auto-detects {appname}_i18n or i18n)
    app_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(app_dir), app_name="myapp")
    
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
from pycore.pyutils.native_ui.step0_i18n import (
    I18nManager,
    get_i18n_manager,
    i18n
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
    get_native_ui_bus_manager,  # Consistent naming alias
    BusNamespaces,
    BusKeys,
    BusSignals,
    DependencyInfo
)

# Callback Manager
from pycore.pyutils.native_ui.step7_managers.callback_manager import (
    CallbackManager,
    get_callback_manager
)

# Startup Window and Launcher (single tk build: TkinterStartupThread)
from pycore.pyutils.native_ui.step4_startup.startup_window import ColorPrintCapture
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
from pycore.pyutils.native_ui.step3_launcher.launcher_with_startup import launch_app_with_startup

# NEW: Simplified Native App Launcher (RECOMMENDED)
from pycore.pyutils.native_ui.step1_config.app_config import NativeUIConfig, TrayMenuItemDict
from pycore.pyutils.native_ui.step3_launcher.launch_native_app import launch_native_app, launch
from pycore.pyutils.native_ui.step2_port_url.port_allocator import get_port_range
from pycore.pyutils.native_ui.step2_port_url.url_handler import URLHandler, process_url
from pycore.pyutils.native_ui.step2_port_url.server_manager import ServerManager, ServerProcess, get_server_manager

# Tkinter UI Components (if available)
try:
    from pycore.pyutils.native_ui.step5_main_ui.tkinter import ThemeSystem, StyledWidgets
    _TKINTER_AVAILABLE = True
except ImportError:
    _TKINTER_AVAILABLE = False

# Base components (always available)
try:
    # DEPRECATED: UIConfig is deprecated, use NativeUIConfig instead
    from pycore.pyutils.native_ui.step1_config.config import UIConfig, WindowState
    from pycore.pyutils.native_ui.step8_utils.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
    _BASE_AVAILABLE = True
except ImportError:
    _BASE_AVAILABLE = False

# PySide6 Framework (recommended) - use third_party manager
from pycore.pyfoundations.third_party import get_third_package_pyside6

# Ensure PySide6 is installed
get_third_package_pyside6()

# Import PySide6 components (no try-except)
from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
    PySide6Framework,
    PySide6UIConfig,
    PySide6MainWindow,
    PySide6TitleBar,
    PySide6SystemTray,
    PySide6WebView,
    PySide6TrayMenuItem,
    create_framework
)
_PYSIDE6_AVAILABLE = True

# Frontend Launcher (Step 9) - Integrated frontend management
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    FrontendLauncherThread,
    start_frontend_if_needed
)

# Platform Adapter - Linux/Windows/macOS difference handling
from pycore.pyutils.native_ui.platform_adapter import (
    PlatformAdapter,
    get_platform_adapter,
    Platform,
    TrayBackend,
    PlatformCapabilities,
    is_linux,
    is_windows,
    is_macos,
    can_use_tray,
    get_recommended_tray_backend
)

__all__ = [
    # I18n Manager (core utility)
    'I18nManager',
    'get_i18n_manager',

    # Startup Window and Launcher (for advanced users)
    'launch_app_with_startup',

    # NEW: Simplified Native App Launcher (RECOMMENDED - main public API)
    'NativeUIConfig',
    'TrayMenuItemDict',  # Type alias for simple dict-based tray menu items
    'launch_native_app',
    'launch',  # Alias for launch_native_app

    # Frontend Launcher (Step 9) - For advanced users
    'FrontendConfig',
    'FrontendLauncherThread',
    'start_frontend_if_needed',

    # Platform Adapter - Cross-platform compatibility
    'PlatformAdapter',
    'get_platform_adapter',
    'Platform',
    'TrayBackend',
    'PlatformCapabilities',
    'is_linux',
    'is_windows',
    'is_macos',
    'can_use_tray',
    'get_recommended_tray_backend',
]

# Note: Other utilities (TimerManager, ShutdownManager, CallbackManager, etc.)
# are for internal use only and not part of the public API.
# Access them directly if needed:
#   from pycore.pyutils.native_ui.step7_managers.timer_manager import get_timer_manager
