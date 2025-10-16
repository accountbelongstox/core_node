#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Timer Manager
Centralized timer management system for periodic task execution
"""

import os
import sys
import threading
import time
from typing import Dict, Callable, Optional, Any
from dataclasses import dataclass

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint


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
    last_run: float = 0.0
    error_count: int = 0
    interceptor: Optional[Callable[[], bool]] = None


# Global task registry
_tasks: Dict[str, TimerTask] = {}
_lock = threading.Lock()
_running = False
_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def register_task(
    name: str,
    interval: float,
    callback: Callable,
    enabled: bool = True
) -> bool:
    """
    Register a timer task

    Args:
        name: Task name (unique identifier)
        interval: Interval in seconds
        callback: Callback function to execute
        enabled: Whether to enable the task immediately

    Returns:
        True if registered successfully, False if name already exists
    """
    global _tasks, _lock

    with _lock:
        if name in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' already exists")
            return False

        task = TimerTask(
            name=name,
            interval=interval,
            callback=callback,
            enabled=enabled
        )
        _tasks[name] = task

        ColorPrint.green(
            f"[TimerManager] Registered task '{name}' "
            f"with interval {interval}s (enabled={enabled})"
        )
        return True


def unregister_task(name: str) -> bool:
    """
    Unregister a timer task

    Args:
        name: Task name to unregister

    Returns:
        True if unregistered successfully, False if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False

        del _tasks[name]
        ColorPrint.blue(f"[TimerManager] Unregistered task '{name}'")
        return True


def enable_task(name: str) -> bool:
    """
    Enable a timer task

    Args:
        name: Task name to enable

    Returns:
        True if enabled successfully, False if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False

        _tasks[name].enabled = True
        ColorPrint.blue(f"[TimerManager] Enabled task '{name}'")
        return True


def disable_task(name: str) -> bool:
    """
    Disable a timer task

    Args:
        name: Task name to disable

    Returns:
        True if disabled successfully, False if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False

        _tasks[name].enabled = False
        ColorPrint.blue(f"[TimerManager] Disabled task '{name}'")
        return True


def set_task_interval(name: str, interval: float) -> bool:
    """
    Set task interval

    Args:
        name: Task name to update
        interval: New interval in seconds

    Returns:
        True if updated successfully, False if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False

        _tasks[name].interval = interval
        ColorPrint.blue(f"[TimerManager] Updated task '{name}' interval to {interval}s")
        return True


def set_task_interceptor(name: str, interceptor: Optional[Callable[[], bool]]) -> bool:
    """
    Set task interceptor function

    Args:
        name: Task name to update
        interceptor: Interceptor function that returns True to allow execution, False to skip

    Returns:
        True if updated successfully, False if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False

        _tasks[name].interceptor = interceptor
        ColorPrint.blue(f"[TimerManager] Updated task '{name}' interceptor")
        return True


def _execute_task(task: TimerTask):
    """
    Execute a timer task

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
        ColorPrint.red(
            f"[TimerManager] Error executing task '{task.name}' "
            f"(error #{task.error_count}): {e}"
        )

        # Disable task after 5 consecutive errors
        if task.error_count >= 5:
            ColorPrint.red(
                f"[TimerManager] Task '{task.name}' disabled "
                f"after {task.error_count} consecutive errors"
            )
            task.enabled = False


def _timer_loop():
    """Main timer loop (runs in separate thread)"""
    global _stop_event, _tasks, _lock

    ColorPrint.blue("[TimerManager] Timer loop started")

    while not _stop_event.is_set():
        try:
            current_time = time.time()

            # Collect tasks to execute OUTSIDE the lock
            tasks_to_execute = []

            with _lock:
                for task in _tasks.values():
                    if not task.enabled:
                        continue

                    # Check if it's time to execute
                    if current_time - task.last_run >= task.interval:
                        task.last_run = current_time
                        tasks_to_execute.append(task)

            # Execute tasks OUTSIDE the lock to prevent deadlock
            for task in tasks_to_execute:
                _execute_task(task)

            # Sleep for 100ms to reduce CPU usage
            time.sleep(0.1)

        except Exception as e:
            ColorPrint.red(f"[TimerManager] Error in timer loop: {e}")
            time.sleep(1.0)  # Sleep longer on error

    ColorPrint.blue("[TimerManager] Timer loop stopped")


def start() -> bool:
    """
    Start the timer manager

    Returns:
        True if started successfully, False if already running
    """
    global _running, _thread, _stop_event

    if _running:
        ColorPrint.yellow("[TimerManager] Already running")
        return False

    _running = True
    _stop_event.clear()

    # Start timer thread
    _thread = threading.Thread(
        target=_timer_loop,
        daemon=True,
        name="TimerManagerThread"
    )
    _thread.start()

    ColorPrint.green("[TimerManager] Started")
    return True


def stop() -> bool:
    """
    Stop the timer manager

    Returns:
        True if stopped successfully, False if not running
    """
    global _running, _thread, _stop_event

    if not _running:
        ColorPrint.yellow("[TimerManager] Not running")
        return False

    ColorPrint.blue("[TimerManager] Stopping...")
    _stop_event.set()

    # Wait for thread to finish
    if _thread and _thread.is_alive():
        _thread.join(timeout=5.0)

    _running = False
    ColorPrint.green("[TimerManager] Stopped")
    return True


def is_running() -> bool:
    """Check if timer manager is running"""
    return _running


def get_task_status(name: str) -> Optional[Dict[str, Any]]:
    """
    Get status of a timer task

    Args:
        name: Task name

    Returns:
        Task status dictionary or None if not found
    """
    global _tasks, _lock

    with _lock:
        if name not in _tasks:
            return None

        task = _tasks[name]
        return {
            "name": task.name,
            "interval": task.interval,
            "enabled": task.enabled,
            "last_run": task.last_run,
            "error_count": task.error_count
        }


def get_all_tasks_status() -> Dict[str, Dict[str, Any]]:
    """Get status of all registered tasks"""
    global _tasks, _lock

    with _lock:
        return {
            name: {
                "interval": task.interval,
                "enabled": task.enabled,
                "last_run": task.last_run,
                "error_count": task.error_count
            }
            for name, task in _tasks.items()
        }


# Initialize on module import
ColorPrint.blue("[TimerManager] Module initialized (static global)")
