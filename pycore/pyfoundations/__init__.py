#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lowest-level Pycore primitives exposed through lazy compatibility exports."""

from importlib import import_module
from typing import Dict, Tuple


__version__ = "1.0.0"

_EXPORTS: Dict[str, Tuple[str, str]] = {
    "ColorPrint": ("pycore.pyfoundations.pybasecommon.color_print", "ColorPrint"),
    "Encyclopedia": (
        "pycore.pyfoundations.pybasecommon.encyclopedia",
        "Encyclopedia",
    ),
    "ENCYCLOPEDIA": (
        "pycore.pyfoundations.pybasecommon.encyclopedia",
        "ENCYCLOPEDIA",
    ),
    "CUDADetector": (
        "pycore.pyfoundations.pybasecommon.compute_caps",
        "CUDADetector",
    ),
    "is_cuda_available": (
        "pycore.pyfoundations.pybasecommon.compute_caps",
        "is_cuda_available",
    ),
    "get_cuda_info": (
        "pycore.pyfoundations.pybasecommon.compute_caps",
        "get_cuda_info",
    ),
    "EventBus": ("pycore.pyfoundations.event_bus", "EventBus"),
    "EventTypes": ("pycore.pyfoundations.event_bus", "EventTypes"),
    "Event": ("pycore.pyfoundations.event_bus", "Event"),
    "THREAD_BUS": ("pycore.pyfoundations.thread_bus", "THREAD_BUS"),
    "get_secret_directories": (
        "pycore.pyfoundations.secret_manager",
        "get_secret_directories",
    ),
    "get_secret_key": ("pycore.pyfoundations.secret_manager", "get_secret_key"),
    "get_all_secret_keys": (
        "pycore.pyfoundations.secret_manager",
        "get_all_secret_keys",
    ),
    "ScreenInfo": ("pycore.pyfoundations.system_info", "ScreenInfo"),
    "MemoryInfo": ("pycore.pyfoundations.system_info", "MemoryInfo"),
    "DiskInfo": ("pycore.pyfoundations.system_info", "DiskInfo"),
    "get_screen_resolution": (
        "pycore.pyfoundations.system_info",
        "get_screen_resolution",
    ),
    "get_memory_info": ("pycore.pyfoundations.system_info", "get_memory_info"),
    "get_disk_info": ("pycore.pyfoundations.system_info", "get_disk_info"),
    "get_system_summary": (
        "pycore.pyfoundations.system_info",
        "get_system_summary",
    ),
    "SCREEN_RESOLUTION": (
        "pycore.pyfoundations.system_info",
        "SCREEN_RESOLUTION",
    ),
    "MEMORY_INFO": ("pycore.pyfoundations.system_info", "MEMORY_INFO"),
    "DISK_INFO": ("pycore.pyfoundations.system_info", "DISK_INFO"),
    "SYSTEM_SUMMARY": ("pycore.pyfoundations.system_info", "SYSTEM_SUMMARY"),
    "Task": ("pycore.pyutils.common.tasks", "Task"),
    "TaskState": ("pycore.pyutils.common.tasks", "TaskState"),
    "TaskPriority": ("pycore.pyutils.common.tasks", "TaskPriority"),
    "GlobalTaskQueue": ("pycore.pyutils.common.tasks", "GlobalTaskQueue"),
    "get_global_task_queue": (
        "pycore.pyutils.common.tasks",
        "get_global_task_queue",
    ),
    "APP_CACHE_DIR": ("pycore.pyfoundations.system_paths", "APP_CACHE_DIR"),
    "UserDataStore": ("pycore.database.repositories.user_data_store", "UserDataStore"),
    "get_user_data_store": (
        "pycore.database.repositories.user_data_store",
        "get_user_data_store",
    ),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    export = _EXPORTS.get(name)
    if export is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_name, attribute_name = export
    value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
