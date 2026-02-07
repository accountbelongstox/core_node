# -*- coding: utf-8 -*-
"""
Runtime - single facade for lifecycle, threads, and events.

Consumers (main, controller, ui) import from runtime for:
- System init: get_system_initializer
- Shutdown: execute_shutdown, is_shutdown_requested, request_shutdown
- Event center: register_main_thread_handlers, register_extension_handlers, trigger_*
- Task threads: get_task_manager, TaskStatus
- Thread registry: get_thread_registry

Implementation lives in d3utils (event_center, shutdown_manager, system_initializer,
task_thread_manager) and runtime (thread_registry). share = shared data only. See docs/CODE_TREE.md.
"""

# Import thread_registry first so runtime has get_thread_registry before d3utils.system_initializer (which imports runtime) runs.
from runtime.thread_registry import get_thread_registry

from d3utils.system_initializer import get_system_initializer
from d3utils.shutdown_manager import (
    execute_shutdown,
    is_shutdown_requested,
    request_shutdown,
    request_restart,
    is_restart_requested,
)
from d3utils.event_center import (
    register_main_thread_handlers,
    register_extension_handlers,
    trigger_app_exit,
    trigger_app_restart,
    trigger_window_show,
    trigger_window_minimize,
    trigger_window_maximize,
    trigger_extension_main_start_macro,
    trigger_extension_main_stop_macro,
    trigger_extension_rosbot_start,
    trigger_extension_rosbot_stop,
)
from d3utils.task_thread_manager import get_task_manager, TaskStatus

__all__ = [
    "get_system_initializer",
    "execute_shutdown",
    "is_shutdown_requested",
    "request_shutdown",
    "request_restart",
    "is_restart_requested",
    "register_main_thread_handlers",
    "register_extension_handlers",
    "trigger_app_exit",
    "trigger_app_restart",
    "trigger_window_show",
    "trigger_window_minimize",
    "trigger_window_maximize",
    "trigger_extension_main_start_macro",
    "trigger_extension_main_stop_macro",
    "trigger_extension_rosbot_start",
    "trigger_extension_rosbot_stop",
    "get_task_manager",
    "TaskStatus",
    "get_thread_registry",
]
