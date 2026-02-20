# -*- coding: utf-8 -*-
"""
Runtime - single facade for lifecycle, threads, and events.

Consumers (main, controller, ui) import from runtime for:
- System init: get_system_initializer
- Shutdown: execute_shutdown, is_shutdown_requested, request_shutdown
- Event center: register_main_thread_handlers, register_extension_handlers, trigger_*
- Task threads: get_task_manager, TaskStatus
- Thread registry: get_thread_registry

Implementation: lifecycle (thread_registry, log_monitor, threads), runtime (re-exports from lifecycle), d3utils (event_center, shutdown_manager, system_initializer). Only main and lifecycle may reference threads. d3utils must not reference threads; no import from d3utils.log_monitor.
"""

# Runtime does not import threads; only lifecycle may reference threads. Re-export from lifecycle.
from lifecycle import (
    get_thread_registry,
    get_task_manager,
    TaskStatus,
    get_main_function_thread,
    get_auxiliary_function_thread,
    D3ExtensionThread,
    get_d3_extension_thread,
    get_d4_extension_thread,
)

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
    register_shutdown_provider,
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

register_shutdown_provider(is_shutdown_requested, request_shutdown, request_restart)

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
    "get_main_function_thread",
    "get_auxiliary_function_thread",
    "D3ExtensionThread",
    "get_d3_extension_thread",
    "get_d4_extension_thread",
    "get_thread_registry",
]
