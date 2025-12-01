# -*- coding: utf-8 -*-
"""
Pycore Call Module - Dynamic Module Caller with FastAPI

A FastAPI service for dynamically calling pycore modules via HTTP API.

Architecture:
- config.py: Builds LauncherConfig (no thread starting)
- tray_menu.py: Defines tray menu items
- event_handlers.py: Registers THREAD_BUS event handlers
- Main launcher: pycore_module_caller.py
"""

from .app import create_app
from .global_config import get_global_config, init_global_config
from .config import build_launcher_config, update_tray_menu_with_singleton
from .tray_menu import build_tray_menu
from .event_handlers import register_event_handlers

__version__ = '2.0.0'
__all__ = [
    'create_app',
    'get_global_config',
    'init_global_config',
    'build_launcher_config',
    'update_tray_menu_with_singleton',
    'build_tray_menu',
    'register_event_handlers',
]
