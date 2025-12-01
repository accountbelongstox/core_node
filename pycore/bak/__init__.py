# -*- coding: utf-8 -*-
"""
Pycore Call Module - Dynamic Module Caller with FastAPI

A FastAPI service for dynamically calling pycore modules via HTTP API.

Platform-aware launcher:
- Windows: System tray + singleton detection
- Linux: Service mode (systemd compatible)
"""

from .app import create_app
from .global_config import get_global_config, init_global_config
from .platform import launch_platform_aware

__version__ = '1.0.0'
__all__ = [
    'create_app',
    'get_global_config',
    'init_global_config',
    'launch_platform_aware'
]
