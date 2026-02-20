# -*- coding: utf-8 -*-
"""
Lifecycle: the only package (besides main) allowed to reference threads.
- Holds thread_registry, shutdown_runner, log_monitor (single thread API), re-exports for runtime.
- d3utils must not reference threads; callers use runtime or lifecycle.log_monitor.
"""

from d3utils.shutdown_manager import register_shutdown_runner
from .shutdown_runner import run_thread_shutdown_sequence

register_shutdown_runner(run_thread_shutdown_sequence)

from .thread_registry import ThreadRegistry, get_thread_registry
from threads.task_thread_manager import get_task_manager, TaskStatus
from threads.main_function_thread import get_main_function_thread
from threads.auxiliary_function_thread import get_auxiliary_function_thread
from threads.d3_extension_thread import D3ExtensionThread, get_d3_extension_thread
from threads.d4_extension_thread import get_d4_extension_thread

from d3utils.shutdown_manager import register_stop_log_watching
from .log_monitor import stop_log_watching, get_log_monitor, get_last_log_modified_time

register_stop_log_watching(stop_log_watching)

from d3utils.log_monitor_api import register, register_get_last_log_modified_time
register(get_log_monitor)
register_get_last_log_modified_time(get_last_log_modified_time)

__all__ = [
    "ThreadRegistry",
    "get_thread_registry",
    "get_task_manager",
    "TaskStatus",
    "get_main_function_thread",
    "get_auxiliary_function_thread",
    "D3ExtensionThread",
    "get_d3_extension_thread",
    "get_d4_extension_thread",
]
