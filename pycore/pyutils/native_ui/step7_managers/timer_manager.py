#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Timer Manager - Centralized Timer Management System

Provides periodic task execution with automatic error handling,
task enable/disable control, and interceptor support.

Features:
- Periodic task execution with configurable intervals
- Task enable/disable control
- Automatic error handling and task disabling after consecutive errors
- Interceptor support for conditional execution
- Thread-safe operations
- Singleton pattern for global access

Usage:
    from pycore.pyutils.native_ui.step7_managers.timer_manager import timer_manager

    # Register a task
    def my_task():
        print("Task executed")

    timer_manager.register_task("my_task", interval=5.0, callback=my_task)

    # Start manager
    timer_manager.start()

    # Enable/disable task
    timer_manager.enable_task("my_task")
    timer_manager.disable_task("my_task")

    # Stop manager
    timer_manager.stop()

Author: Extracted from d3-check, adapted for pycore
"""

import time
from typing import Dict, Callable, Optional, Any, List
from dataclasses import dataclass, field, replace

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)


@dataclass
class TimerTask:
    """
    Timer task data structure

    Attributes:
        name: Task name (unique identifier)
        interval: Interval in seconds
        callback: Callback function to execute
        enabled: Whether the task is enabled
        last_run: Last execution timestamp
        error_count: Number of consecutive errors
        interceptor: Optional interceptor function to control execution
    """
    name: str
    interval: float
    callback: Callable
    enabled: bool = True
    last_run: float = field(default=0.0)
    error_count: int = field(default=0)
    interceptor: Optional[Callable[[], bool]] = None


class TimerManager:
    """
    Timer Manager - Centralized periodic task execution system

    Global timer management with THREAD_BUS-owned state.
    """

    def __init__(self):
        """Initialize timer manager."""
        self._tasks: Dict[str, TimerTask] = {}
        init_serialized_owner(
            self,
            'pyutils.native_ui.timer_manager',
            'NativeUITimerStateThread',
        )
        self._running_signal = f'{self._serialized_queue_name}.running'
        self._stopped_signal = f'{self._serialized_queue_name}.stopped'
        THREAD_BUS.signal(self._running_signal, False)

        ColorPrint.print_info("[TimerManager] Initialized (singleton)")

    @serialized_method
    def register_task(
        self,
        name: str,
        interval: float,
        callback: Callable,
        enabled: bool = True,
        interceptor: Optional[Callable[[], bool]] = None
    ) -> bool:
        """
        Register a timer task

        Args:
            name: Task name (unique identifier)
            interval: Interval in seconds
            callback: Callback function to execute
            enabled: Whether to enable the task immediately
            interceptor: Optional interceptor function (returns True to allow execution)

        Returns:
            True if registered successfully, False if name already exists
        """
        if name in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' already exists")
            return False
        task = TimerTask(
            name=name,
            interval=interval,
            callback=callback,
            enabled=enabled,
            interceptor=interceptor
        )
        self._tasks[name] = task
        ColorPrint.print_success(
            f"[TimerManager] Registered task '{name}' "
            f"with interval {interval}s (enabled={enabled})"
        )
        return True

    @serialized_method
    def unregister_task(self, name: str) -> bool:
        """
        Unregister a timer task

        Args:
            name: Task name to unregister

        Returns:
            True if unregistered successfully, False if not found
        """
        if name not in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
            return False
        del self._tasks[name]
        ColorPrint.print_info(f"[TimerManager] Unregistered task '{name}'")
        return True

    @serialized_method
    def enable_task(self, name: str) -> bool:
        """Enable a timer task"""
        if name not in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
            return False
        self._tasks[name].enabled = True
        self._tasks[name].error_count = 0
        ColorPrint.print_info(f"[TimerManager] Enabled task '{name}'")
        return True

    @serialized_method
    def disable_task(self, name: str) -> bool:
        """Disable a timer task"""
        if name not in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
            return False
        self._tasks[name].enabled = False
        ColorPrint.print_info(f"[TimerManager] Disabled task '{name}'")
        return True

    @serialized_method
    def set_task_interval(self, name: str, interval: float) -> bool:
        """Set task interval"""
        if name not in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
            return False
        self._tasks[name].interval = interval
        ColorPrint.print_info(f"[TimerManager] Updated task '{name}' interval to {interval}s")
        return True

    @serialized_method
    def set_task_interceptor(
        self,
        name: str,
        interceptor: Optional[Callable[[], bool]]
    ) -> bool:
        """Set task interceptor function"""
        if name not in self._tasks:
            ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
            return False
        self._tasks[name].interceptor = interceptor
        ColorPrint.print_info(f"[TimerManager] Updated task '{name}' interceptor")
        return True

    def _execute_task(self, task: TimerTask):
        """
        Execute a timer task with error handling

        Args:
            task: TimerTask to execute
        """
        try:
            # Check interceptor first
            if task.interceptor is not None:
                if not task.interceptor():
                    return  # Skip execution if interceptor returns False

            task.callback()
            task.error_count = 0  # Reset error count on success

        except Exception as e:
            task.error_count += 1
            ColorPrint.print_error(
                f"[TimerManager] Error executing task '{task.name}' "
                f"(error #{task.error_count}): {e}"
            )

            # Disable task after 5 consecutive errors
            if task.error_count >= 5:
                ColorPrint.print_error(
                    f"[TimerManager] Task '{task.name}' disabled "
                    f"after {task.error_count} consecutive errors"
                )
                task.enabled = False

        self._store_execution_state(task)

    @serialized_method
    def _store_execution_state(self, task: TimerTask) -> None:
        """Store execution results on the task-owner thread."""
        current = self._tasks.get(task.name)
        if current is not None:
            current.error_count = task.error_count
            current.enabled = task.enabled

    @serialized_method
    def _collect_due_tasks(self, current_time: float) -> List[TimerTask]:
        """Claim due tasks on the task-owner thread."""
        tasks = []
        for task in self._tasks.values():
            if task.enabled and current_time - task.last_run >= task.interval:
                task.last_run = current_time
                tasks.append(replace(task))
        return tasks

    def _timer_loop(self):
        """Main timer loop (runs in separate thread)"""
        ColorPrint.print_info("[TimerManager] Timer loop started")

        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                current_time = time.time()

                tasks_to_execute = self._collect_due_tasks(current_time)

                # Execute tasks OUTSIDE the lock to prevent deadlock
                for task in tasks_to_execute:
                    self._execute_task(task)

                # Sleep for 100ms to reduce CPU usage
                time.sleep(0.1)

            except Exception as e:
                ColorPrint.print_error(f"[TimerManager] Error in timer loop: {e}")
                time.sleep(1.0)  # Sleep longer on error

        ColorPrint.print_info("[TimerManager] Timer loop stopped")
        THREAD_BUS.signal(self._stopped_signal, True)

    def start(self) -> bool:
        """
        Start the timer manager

        Returns:
            True if started successfully, False if already running
        """
        if THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.print_warn("[TimerManager] Already running")
            return False

        THREAD_BUS.clear_signal(self._stopped_signal)
        THREAD_BUS.signal(self._running_signal, True)

        # Start timer thread
        start_bus_task(
            self._timer_loop,
            thread_name="TimerManagerThread",
        )

        ColorPrint.print_success("[TimerManager] Started")
        return True

    def stop(self, timeout: float = 5.0) -> bool:
        """
        Stop the timer manager

        Args:
            timeout: Maximum time to wait for thread to finish

        Returns:
            True if stopped successfully, False if not running
        """
        if not THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.print_warn("[TimerManager] Not running")
            return False

        ColorPrint.print_info("[TimerManager] Stopping...")
        THREAD_BUS.signal(self._running_signal, False)
        THREAD_BUS.wait_signal(self._stopped_signal, timeout=timeout)
        THREAD_BUS.clear_signal(self._stopped_signal)
        ColorPrint.print_success("[TimerManager] Stopped")
        return True

    def is_running(self) -> bool:
        """Check if timer manager is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))

    @serialized_method
    def get_task_status(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Get status of a timer task

        Args:
            name: Task name

        Returns:
            Task status dictionary or None if not found
        """
        if name not in self._tasks:
            return None
        task = self._tasks[name]
        return {
            "name": task.name,
            "interval": task.interval,
            "enabled": task.enabled,
            "last_run": task.last_run,
            "error_count": task.error_count,
            "has_interceptor": task.interceptor is not None
        }

    @serialized_method
    def get_all_tasks_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all registered tasks"""
        return {
            name: {
                "interval": task.interval,
                "enabled": task.enabled,
                "last_run": task.last_run,
                "error_count": task.error_count,
                "has_interceptor": task.interceptor is not None
            }
            for name, task in self._tasks.items()
        }

    @serialized_method
    def get_task_count(self) -> int:
        """Get total number of registered tasks"""
        return len(self._tasks)


_TIMER_MANAGER_PROVIDER = SerializedSingletonProvider(
    TimerManager,
    "native_ui.timer_manager.provider",
    "TimerManagerProvider",
)

timer_manager = _TIMER_MANAGER_PROVIDER.get()


# Export
__all__ = [
    'TimerManager',
    'TimerTask',
    'timer_manager',
]
