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

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import Encyclopedia, ENCYCLOPEDIA

# Event bus
from pycore.pyfoundations.event_bus import EventBus, EventTypes, Event

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

# CUDA detection
from pycore.pyfoundations.cuda_detector import (
    CUDADetector,
    is_cuda_available,
    get_cuda_info
)

# Global task system
from pycore.pyfoundations.task_models import (
    Task,
    TaskState,
    TaskPriority
)
from pycore.pyfoundations.global_task_queue import (
    GlobalTaskQueue,
    get_global_task_queue
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
]

__version__ = '1.0.0'