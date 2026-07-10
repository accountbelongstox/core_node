# -*- coding: utf-8 -*-
"""
Device Sync - Independent Device Synchronization Module

This module provides device synchronization capabilities without
depending on other pycore.pyutils modules.

Architecture (Version 3.0 - Restructured):
- core/: Core functionality (config, logging, scanner, IPC)
- server/: PRIMARY server components
- client/: SECONDARY client components
- ui/: User interface (tray menu, main entry)
- utils/: Utility tools (status check, diagnostics, shortcuts)

Features:
- Modular architecture with clear separation of concerns
- System tray interface
- File synchronization
- Network discovery
- Single instance enforcement
- Status monitoring and diagnostics
"""

# Core module exports
from .core import (
    GlobalConfig,
    get_global_config,
    init_global_config,
    get_cache_dir,
    DEFAULT_HTTP_PORT,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_ROOT_DIR,
    setup_logging,
    SimpleDeviceScanner,
    IPCServer,
    DEFAULT_IPC_PORT,
)

# Server module exports
from .server import SimplePrimaryServer

# Client module exports
from .client import SimpleClient

# UI module exports
from .ui import SimpleTrayMenu, main

# Utils module exports
from .utils import (
    check_status,
    diagnose,
    create_desktop_shortcut,
)

__version__ = '3.0.0'

__all__ = [
    # Core
    'GlobalConfig',
    'get_global_config',
    'init_global_config',
    'get_cache_dir',
    'DEFAULT_HTTP_PORT',
    'DEFAULT_SYNC_INTERVAL',
    'DEFAULT_ROOT_DIR',
    'setup_logging',
    'SimpleDeviceScanner',
    'IPCServer',
    'DEFAULT_IPC_PORT',

    # Server
    'SimplePrimaryServer',

    # Client
    'SimpleClient',

    # UI
    'SimpleTrayMenu',
    'main',

    # Utils
    'check_status',
    'diagnose',
    'create_desktop_shortcut',
]
