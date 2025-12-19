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
    from pycore.pyutils.timer_manager import TimerManager

    # Get singleton instance
    manager = TimerManager()

    # Register a task
    def my_task():
        print("Task executed")

    manager.register_task("my_task", interval=5.0, callback=my_task)

    # Start manager
    manager.start()

    # Enable/disable task
    manager.enable_task("my_task")
    manager.disable_task("my_task")

    # Stop manager
    manager.stop()

Author: Extracted from d3-check, adapted for pycore
"""

import threading
import time
from typing import Dict, Callable, Optional, Any
from dataclasses import dataclass, field

from pycore import ColorPrint


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

    Singleton pattern implementation for global timer management.
    """

    _instance: Optional['TimerManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize timer manager (only once)"""
        if getattr(self, '_initialized', False):
            return

        self._tasks: Dict[str, TimerTask] = {}
        self._task_lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        ColorPrint.print_info("[TimerManager] Initialized (singleton)")
        self._initialized = True

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
        with self._task_lock:
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

    def unregister_task(self, name: str) -> bool:
        """
        Unregister a timer task

        Args:
            name: Task name to unregister

        Returns:
            True if unregistered successfully, False if not found
        """
        with self._task_lock:
            if name not in self._tasks:
                ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
                return False

            del self._tasks[name]
            ColorPrint.print_info(f"[TimerManager] Unregistered task '{name}'")
            return True

    def enable_task(self, name: str) -> bool:
        """Enable a timer task"""
        with self._task_lock:
            if name not in self._tasks:
                ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
                return False

            self._tasks[name].enabled = True
            self._tasks[name].error_count = 0  # Reset error count
            ColorPrint.print_info(f"[TimerManager] Enabled task '{name}'")
            return True

    def disable_task(self, name: str) -> bool:
        """Disable a timer task"""
        with self._task_lock:
            if name not in self._tasks:
                ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
                return False

            self._tasks[name].enabled = False
            ColorPrint.print_info(f"[TimerManager] Disabled task '{name}'")
            return True

    def set_task_interval(self, name: str, interval: float) -> bool:
        """Set task interval"""
        with self._task_lock:
            if name not in self._tasks:
                ColorPrint.print_warn(f"[TimerManager] Task '{name}' not found")
                return False

            self._tasks[name].interval = interval
            ColorPrint.print_info(f"[TimerManager] Updated task '{name}' interval to {interval}s")
            return True

    def set_task_interceptor(
        self,
        name: str,
        interceptor: Optional[Callable[[], bool]]
    ) -> bool:
        """Set task interceptor function"""
        with self._task_lock:
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

    def _timer_loop(self):
        """Main timer loop (runs in separate thread)"""
        ColorPrint.print_info("[TimerManager] Timer loop started")

        while not self._stop_event.is_set():
            try:
                current_time = time.time()

                # Collect tasks to execute OUTSIDE the lock
                tasks_to_execute = []

                with self._task_lock:
                    for task in self._tasks.values():
                        if not task.enabled:
                            continue

                        # Check if it's time to execute
                        if current_time - task.last_run >= task.interval:
                            task.last_run = current_time
                            tasks_to_execute.append(task)

                # Execute tasks OUTSIDE the lock to prevent deadlock
                for task in tasks_to_execute:
                    self._execute_task(task)

                # Sleep for 100ms to reduce CPU usage
                time.sleep(0.1)

            except Exception as e:
                ColorPrint.print_error(f"[TimerManager] Error in timer loop: {e}")
                time.sleep(1.0)  # Sleep longer on error

        ColorPrint.print_info("[TimerManager] Timer loop stopped")

    def start(self) -> bool:
        """
        Start the timer manager

        Returns:
            True if started successfully, False if already running
        """
        if self._running:
            ColorPrint.print_warn("[TimerManager] Already running")
            return False

        self._running = True
        self._stop_event.clear()

        # Start timer thread
        self._thread = threading.Thread(
            target=self._timer_loop,
            daemon=True,
            name="TimerManagerThread"
        )
        self._thread.start()

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
        if not self._running:
            ColorPrint.print_warn("[TimerManager] Not running")
            return False

        ColorPrint.print_info("[TimerManager] Stopping...")
        self._stop_event.set()

        # Wait for thread to finish
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)

        self._running = False
        ColorPrint.print_success("[TimerManager] Stopped")
        return True

    def is_running(self) -> bool:
        """Check if timer manager is running"""
        return self._running

    def get_task_status(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Get status of a timer task

        Args:
            name: Task name

        Returns:
            Task status dictionary or None if not found
        """
        with self._task_lock:
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

    def get_all_tasks_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all registered tasks"""
        with self._task_lock:
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

    def get_task_count(self) -> int:
        """Get total number of registered tasks"""
        with self._task_lock:
            return len(self._tasks)


# Factory function for convenience
def get_timer_manager() -> TimerManager:
    """
    Get the singleton TimerManager instance

    Returns:
        TimerManager singleton instance
    """
    return TimerManager()


# Export
__all__ = [
    'TimerManager',
    'TimerTask',
    'get_timer_manager'
]
