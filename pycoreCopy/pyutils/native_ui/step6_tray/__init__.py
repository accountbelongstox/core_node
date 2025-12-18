#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI - System Tray Components

System tray implementation for both Windows and Linux.
"""

from .tkinter_system_tray import (
    TkinterSystemTray,
    TrayMenuItem,
    PYSTRAY_AVAILABLE
)
from .tray_thread import TkinterSystemTrayThread

__all__ = [
    'TkinterSystemTray',
    'TrayMenuItem',
    'TkinterSystemTrayThread',
    'PYSTRAY_AVAILABLE',
]
