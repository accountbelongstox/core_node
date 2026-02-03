#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Timer Manager
Centralized timer management system for periodic task execution
"""

import os
import sys
import queue
import threading
import time
from typing import Dict, Callable, Optional, Any
from dataclasses import dataclass

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint


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


# Global task registry (no lock: direct write when not running; when running, serialized via cmd queue in timer thread)
_tasks: Dict[str, TimerTask] = {}
_cmd_queue: queue.Queue = queue.Queue()
_running = False
_thread: Optional["TimerManagerThread"] = None
_stop_event = threading.Event()


class TimerManagerThread(threading.Thread):
    """Native thread for timer loop. Override run() to execute _timer_loop."""

    def __init__(self):
        super().__init__(daemon=True, name="TimerManagerThread")

    def run(self):
        _timer_loop()


def _apply_register(name: str, interval: float, callback: Callable, enabled: bool) -> bool:
    global _tasks
    if name in _tasks:
        return False
    _tasks[name] = TimerTask(name=name, interval=interval, callback=callback, enabled=enabled)
    return True


def _apply_unregister(name: str) -> bool:
    global _tasks
    if name not in _tasks:
        return False
    del _tasks[name]
    return True


def _drain_cmd_queue():
    """Called by timer thread; drain and process cmd queue (serialized, no lock)."""
    global _tasks
    while True:
        try:
            item = _cmd_queue.get_nowait()
        except queue.Empty:
            break
        cmd, args, result_q = item
        if cmd == "register":
            ok = _apply_register(*args)
            if ok:
                ColorPrint.green(f"[TimerManager] Registered task '{args[0]}' with interval {args[1]}s (enabled={args[3]})")
            else:
                ColorPrint.yellow(f"[TimerManager] Task '{args[0]}' already exists")
            result_q.put(ok)
        elif cmd == "unregister":
            ok = _apply_unregister(*args)
            if ok:
                ColorPrint.blue(f"[TimerManager] Unregistered task '{args[0]}'")
            else:
                ColorPrint.yellow(f"[TimerManager] Task '{args[0]}' not found")
            result_q.put(ok)
        elif cmd == "enable":
            name, = args
            if name not in _tasks:
                result_q.put(False)
            else:
                _tasks[name].enabled = True
                ColorPrint.blue(f"[TimerManager] Enabled task '{name}'")
                result_q.put(True)
        elif cmd == "disable":
            name, = args
            if name not in _tasks:
                result_q.put(False)
            else:
                _tasks[name].enabled = False
                ColorPrint.blue(f"[TimerManager] Disabled task '{name}'")
                result_q.put(True)
        elif cmd == "set_interval":
            name, interval = args
            if name not in _tasks:
                result_q.put(False)
            else:
                _tasks[name].interval = interval
                ColorPrint.blue(f"[TimerManager] Updated task '{name}' interval to {interval}s")
                result_q.put(True)
        elif cmd == "set_interceptor":
            name, interceptor = args
            if name not in _tasks:
                result_q.put(False)
            else:
                _tasks[name].interceptor = interceptor
                ColorPrint.blue(f"[TimerManager] Updated task '{name}' interceptor")
                result_q.put(True)
        elif cmd == "one_shot":
            cb, = args
            try:
                cb()
            except Exception as e:
                ColorPrint.red(f"[TimerManager] One-shot task error: {e}")


def submit_one_shot(callback: Callable[[], None]) -> None:
    """Submit a one-shot task to the timer thread. No new thread is created. Call from main thread."""
    global _running, _cmd_queue
    if not _running:
        ColorPrint.yellow("[TimerManager] submit_one_shot ignored: timer not started yet")
        return
    _cmd_queue.put(("one_shot", (callback,), None))


def register_task(
    name: str,
    interval: float,
    callback: Callable,
    enabled: bool = True
) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' already exists")
            return False
        _apply_register(name, interval, callback, enabled)
        ColorPrint.green(f"[TimerManager] Registered task '{name}' with interval {interval}s (enabled={enabled})")
        return True
    rq = queue.Queue()
    _cmd_queue.put(("register", (name, interval, callback, enabled), rq))
    return rq.get()


def unregister_task(name: str) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name not in _tasks:
            ColorPrint.yellow(f"[TimerManager] Task '{name}' not found")
            return False
        _apply_unregister(name)
        ColorPrint.blue(f"[TimerManager] Unregistered task '{name}'")
        return True
    rq = queue.Queue()
    _cmd_queue.put(("unregister", (name,), rq))
    return rq.get()


def enable_task(name: str) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name not in _tasks:
            return False
        _tasks[name].enabled = True
        return True
    rq = queue.Queue()
    _cmd_queue.put(("enable", (name,), rq))
    return rq.get()


def disable_task(name: str) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name not in _tasks:
            return False
        _tasks[name].enabled = False
        return True
    rq = queue.Queue()
    _cmd_queue.put(("disable", (name,), rq))
    return rq.get()


def set_task_interval(name: str, interval: float) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name not in _tasks:
            return False
        _tasks[name].interval = interval
        return True
    rq = queue.Queue()
    _cmd_queue.put(("set_interval", (name, interval), rq))
    return rq.get()


def set_task_interceptor(name: str, interceptor: Optional[Callable[[], bool]]) -> bool:
    global _tasks, _running, _cmd_queue
    if not _running:
        if name not in _tasks:
            return False
        _tasks[name].interceptor = interceptor
        return True
    rq = queue.Queue()
    _cmd_queue.put(("set_interceptor", (name, interceptor), rq))
    return rq.get()


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
    """Main timer loop (runs in separate thread): drain cmd queue then run due tasks (serialized, no lock)."""
    global _stop_event, _tasks

    ColorPrint.blue("[TimerManager] Timer loop started")

    while not _stop_event.is_set():
        try:
            _drain_cmd_queue()
            current_time = time.time()
            tasks_to_execute = []
            for task in list(_tasks.values()):
                if not task.enabled:
                    continue
                if current_time - task.last_run >= task.interval:
                    task.last_run = current_time
                    tasks_to_execute.append(task)
            for task in tasks_to_execute:
                _execute_task(task)
            time.sleep(0.1)
        except Exception as e:
            ColorPrint.red(f"[TimerManager] Error in timer loop: {e}")
            time.sleep(1.0)

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

    _thread = TimerManagerThread()
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
    global _tasks
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
    global _tasks
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
