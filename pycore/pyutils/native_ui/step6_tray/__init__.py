#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
<<<<<<< HEAD
Native UI - System Tray Components

System tray implementation for both Windows and Linux.
=======
System Tray Package

Provides cross-platform system tray implementations:
- TkinterSystemTray: Lightweight pystray-based implementation (cross-platform)
- TkinterSystemTrayThread: Thread-safe wrapper for TkinterSystemTray
- AppIndicatorSystemTray: Native Ubuntu/GNOME implementation (Linux only)
- AppIndicatorSystemTrayThread: Thread-safe wrapper for AppIndicatorSystemTray

All implementations follow project threading standards and use THREAD_BUS for communication.
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
"""

from .tkinter_system_tray import (
    TkinterSystemTray,
    TrayMenuItem,
    PYSTRAY_AVAILABLE
)
<<<<<<< HEAD
from .tray_thread import TkinterSystemTrayThread

__all__ = [
    'TkinterSystemTray',
    'TrayMenuItem',
    'TkinterSystemTrayThread',
    'PYSTRAY_AVAILABLE',
=======

from .tray_thread import TkinterSystemTrayThread

# AppIndicator support (Linux only)
try:
    from .appindicator_system_tray import (
        AppIndicatorSystemTray,
        AppIndicatorMenuItem,
        APPINDICATOR_AVAILABLE,
        check_appindicator_available,
        print_appindicator_status
    )
    from .appindicator_thread import (
        AppIndicatorSystemTrayThread,
        is_appindicator_recommended
    )
except ImportError:
    # AppIndicator not available (expected on non-Linux or without dependencies)
    AppIndicatorSystemTray = None
    AppIndicatorMenuItem = None
    AppIndicatorSystemTrayThread = None
    APPINDICATOR_AVAILABLE = False
    check_appindicator_available = lambda: False
    print_appindicator_status = lambda: None
    is_appindicator_recommended = lambda: False

__all__ = [
    # Tkinter/pystray backend
    'TkinterSystemTray',
    'TkinterSystemTrayThread',
    'TrayMenuItem',
    'PYSTRAY_AVAILABLE',

    # AppIndicator backend (Linux)
    'AppIndicatorSystemTray',
    'AppIndicatorSystemTrayThread',
    'AppIndicatorMenuItem',
    'APPINDICATOR_AVAILABLE',
    'check_appindicator_available',
    'print_appindicator_status',
    'is_appindicator_recommended',
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
]
