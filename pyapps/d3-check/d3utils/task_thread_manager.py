#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Thread Manager
Manages background task threads for ROSBOT operations and other tasks
"""
import os
import sys
import time
import threading
import queue
from typing import Dict, Any, Callable, Optional
from enum import Enum
from providor.common_imports import ColorPrint


class TaskStatus(Enum):
    """Task execution status"""
    DISABLED = "disabled"
    ENABLED = "enabled"
    RUNNING = "running"
    ERROR = "error"


class TaskThread(threading.Thread):
    """Native thread for a single task loop. start/stop only via TaskThreadManager worker; status read/write is atomic under GIL, no lock."""

    def __init__(self, name: str, task_func: Callable, interval: float = 1.0):
        super().__init__(daemon=True, name=name)
        self.task_func = task_func
        self.interval = interval
        self.status = TaskStatus.DISABLED
        self.stop_event = threading.Event()
        self.last_run = 0.0
        self.error_count = 0

        ColorPrint.blue(f"[TaskThread] Created task thread: {name}")

    def start(self):
        """Start the task thread (only if not already alive)."""
        if not self.is_alive():
            self.stop_event.clear()
            super().start()
            ColorPrint.green(f"[TaskThread] Started task thread: {self.name}")

    def stop(self):
        """Stop the task thread."""
        self.stop_event.set()
        if self.is_alive():
            self.join(timeout=2.0)
            ColorPrint.yellow(f"[TaskThread] Stopped task thread: {self.name}")

    def set_status(self, status: TaskStatus):
        """Set task status (single variable assignment is atomic)."""
        self.status = status
        ColorPrint.blue(f"[TaskThread] Task '{self.name}' status: {status.value}")

    def run(self):
        """Main task thread loop."""
        ColorPrint.blue(f"[TaskThread] Task thread '{self.name}' started")

        while not self.stop_event.is_set():
            try:
                current_time = time.time()

                if (self.status == TaskStatus.ENABLED and
                    current_time - self.last_run >= self.interval):

                    self.status = TaskStatus.RUNNING
                    self.task_func()
                    self.last_run = current_time
                    self.error_count = 0
                    self.status = TaskStatus.ENABLED

                time.sleep(0.1)

            except Exception as e:
                self.error_count += 1
                self.status = TaskStatus.ERROR
                ColorPrint.red(f"[TaskThread] Error in task '{self.name}': {e}")

                if self.error_count >= 5:
                    ColorPrint.red(f"[TaskThread] Task '{self.name}' disabled after {self.error_count} errors")
                    self.status = TaskStatus.DISABLED
                    break

                time.sleep(1.0)

        ColorPrint.yellow(f"[TaskThread] Task thread '{self.name}' ended")


class TaskThreadManager:
    """Manages all task threads; serialized via command queue, no lock."""
    
    def __init__(self):
        self.tasks: Dict[str, TaskThread] = {}
        self._cmd_queue: queue.Queue = queue.Queue()
        self._running = False
        self._worker = threading.Thread(target=self._worker_loop, daemon=True, name="TaskThreadManagerWorker")
        self._worker.start()
        ColorPrint.blue("[TaskThreadManager] Initialized")
    
    def _worker_loop(self):
        while True:
            try:
                cmd, args, result_q = self._cmd_queue.get()
                if cmd == "register":
                    name, task_func, interval = args
                    ok = name not in self.tasks
                    if ok:
                        self.tasks[name] = TaskThread(name, task_func, interval)
                        ColorPrint.blue(f"[TaskThreadManager] Registered task: {name}")
                    else:
                        ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' already exists")
                    result_q.put(ok)
                elif cmd == "start_task":
                    name, = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].start()
                    else:
                        ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                    result_q.put(ok)
                elif cmd == "stop_task":
                    name, = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].stop()
                    result_q.put(ok)
                elif cmd == "set_status":
                    name, status = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].set_status(status)
                    result_q.put(ok)
                elif cmd == "set_interval":
                    name, interval = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].interval = interval
                    result_q.put(ok)
                elif cmd == "start_all":
                    for task in self.tasks.values():
                        task.start()
                    self._running = True
                    ColorPrint.green("[TaskThreadManager] All task threads started")
                    result_q.put(None)
                elif cmd == "stop_all":
                    for task in self.tasks.values():
                        task.stop()
                    self._running = False
                    ColorPrint.yellow("[TaskThreadManager] All task threads stopped")
                    result_q.put(None)
                elif cmd == "get_status":
                    name, = args
                    st = self.tasks[name].status if name in self.tasks else None
                    result_q.put(st)
            except Exception as e:
                ColorPrint.red(f"[TaskThreadManager] Worker error: {e}")
                try:
                    result_q.put(None)
                except Exception:
                    pass
    
    def _cmd(self, cmd: str, args: tuple, expect_result: bool = True):
        rq = queue.Queue()
        self._cmd_queue.put((cmd, args, rq))
        return rq.get() if expect_result else None
    
    def register_task(self, name: str, task_func: Callable, interval: float = 1.0) -> bool:
        return self._cmd("register", (name, task_func, interval))
    
    def start_task(self, name: str) -> bool:
        return self._cmd("start_task", (name,))
    
    def stop_task(self, name: str) -> bool:
        return self._cmd("stop_task", (name,))
    
    def set_task_status(self, name: str, status: TaskStatus) -> bool:
        return self._cmd("set_status", (name, status))
    
    def set_task_interval(self, name: str, interval: float) -> bool:
        return self._cmd("set_interval", (name, interval))
    
    def start_all(self):
        self._cmd("start_all", (), expect_result=False)
    
    def stop_all(self):
        self._cmd("stop_all", (), expect_result=False)
    
    def get_task_status(self, name: str) -> Optional[TaskStatus]:
        return self._cmd("get_status", (name,))


# Global instance
_task_manager = None


def get_task_manager() -> TaskThreadManager:
    """Get global task thread manager instance"""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskThreadManager()
    return _task_manager


def register_task(name: str, task_func: Callable, interval: float = 1.0) -> bool:
    """Register a new task thread"""
    return get_task_manager().register_task(name, task_func, interval)


def start_task(name: str) -> bool:
    """Start a specific task thread"""
    return get_task_manager().start_task(name)


def stop_task(name: str) -> bool:
    """Stop a specific task thread"""
    return get_task_manager().stop_task(name)


def set_task_status(name: str, status: TaskStatus) -> bool:
    """Set task status"""
    return get_task_manager().set_task_status(name, status)


def set_task_interval(name: str, interval: float) -> bool:
    """Set task interval"""
    return get_task_manager().set_task_interval(name, interval)


def start_all_tasks():
    """Start all registered task threads"""
    get_task_manager().start_all()


def stop_all_tasks():
    """Stop all task threads"""
    get_task_manager().stop_all()


def get_task_status(name: str) -> Optional[TaskStatus]:
    """Get task status"""
    return get_task_manager().get_task_status(name)
