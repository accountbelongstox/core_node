#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyFoundations - Core foundational utilities for Python projects

This module provides:
- Color printing utilities
- Global cache/encyclopedia
- Event bus for cross-app communication
- Global variable management
- Device abstractions
- Secret management (encryption/decryption)
"""

# Kernel exports (pybasecommon): ColorPrint, Encyclopedia cache, CUDA detection
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import Encyclopedia, ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.compute_caps import (
    CUDADetector,
    is_cuda_available,
    get_cuda_info
)

# Event bus
from pycore.pyfoundations.event_bus import EventBus, EventTypes, Event
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Secret management
from pycore.pyfoundations.secret_manager import (
    get_secret_directories,
    get_secret_key,
    get_all_secret_keys
)

# System information
from pycore.pyfoundations.system_info import (
    ScreenInfo,
    MemoryInfo,
    DiskInfo,
    get_screen_resolution,
    get_memory_info,
    get_disk_info,
    get_system_summary,
    SCREEN_RESOLUTION,
    MEMORY_INFO,
    DISK_INFO,
    SYSTEM_SUMMARY
)

# Global task system (task_models + global_task_queue merged into tasks)
from pycore.pyfoundations.tasks import (
    Task,
    TaskState,
    TaskPriority,
    GlobalTaskQueue,
    get_global_task_queue
)

# Unified user data store (merged into system_paths)
from pycore.pyfoundations.system_paths import (
    APP_CACHE_DIR,
    UserDataStore,
    get_user_data_store
)

__all__ = [
    # Utilities
    'ColorPrint',
    'Encyclopedia',
    'ENCYCLOPEDIA',

    # Events
    'EventBus',
    'EventTypes',
    'Event',
    'THREAD_BUS',

    # Secret management
    'get_secret_directories',
    'get_secret_key',
    'get_all_secret_keys',

    # System information
    'ScreenInfo',
    'MemoryInfo',
    'DiskInfo',
    'get_screen_resolution',
    'get_memory_info',
    'get_disk_info',
    'get_system_summary',
    'SCREEN_RESOLUTION',
    'MEMORY_INFO',
    'DISK_INFO',
    'SYSTEM_SUMMARY',

    # CUDA detection
    'CUDADetector',
    'is_cuda_available',
    'get_cuda_info',

    # Global task system
    'Task',
    'TaskState',
    'TaskPriority',
    'GlobalTaskQueue',
    'get_global_task_queue',

    # User data store
    'APP_CACHE_DIR',
    'UserDataStore',
    'get_user_data_store',
]

__version__ = '1.0.0'
