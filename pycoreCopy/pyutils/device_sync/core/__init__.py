# -*- coding: utf-8 -*-
"""
Core Module - Core functionality for Device Sync

Contains configuration, logging, network scanning, and IPC functionality.
"""

from .config import (
    GlobalConfig,
    get_global_config,
    init_global_config,
    get_cache_dir,
    DEFAULT_HTTP_PORT,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_ROOT_DIR
)
from .logging import setup_logging, get_log_directory, get_log_file, open_log_directory
from .scanner import SimpleDeviceScanner
from .ipc import IPCServer, DEFAULT_IPC_PORT
from .database import SyncDatabase, get_sync_database

__all__ = [
    # Config
    'GlobalConfig',
    'get_global_config',
    'init_global_config',
    'get_cache_dir',
    'DEFAULT_HTTP_PORT',
    'DEFAULT_SYNC_INTERVAL',
    'DEFAULT_ROOT_DIR',

    # Logging
    'setup_logging',
    'get_log_directory',
    'get_log_file',
    'open_log_directory',

    # Scanner
    'SimpleDeviceScanner',

    # IPC
    'IPCServer',
    'DEFAULT_IPC_PORT',

    # Database
    'SyncDatabase',
    'get_sync_database',
]
