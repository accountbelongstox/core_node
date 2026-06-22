#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Thread Manager.
Manages background task threads for ROSBOT and other tasks.
All public APIs are non-blocking (fire-and-forget). See docs/THREAD_BUS_AND_REGISTRY.md.
"""
import time
import threading
import queue
from typing import Any, Dict, Callable, Optional
from pycore.pyfoundations.color_print import ColorPrint
from share.values.task_status import TaskStatus


class TaskThread(threading.Thread):
    """Native thread for a single task loop. start/stop only via TaskThreadManager worker; status read/write is atomic under GIL, no lock."""

    def __init__(self, name: str, task_func: Callable, interval: float = 1.0):
        threading.Thread.__init__(self, daemon=True, name=name)
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
        """Stop the task thread without blocking: set stop_event only; do not join."""
        self.stop_event.set()
        ColorPrint.yellow(f"[TaskThread] Stop requested for task thread: {self.name}")

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
    """
    Manages all task threads; serialized via command queue.
    All public APIs are non-blocking (fire-and-forget); status is read from _status_snapshot.
    """
    
    def __init__(self):
        self.tasks: Dict[str, TaskThread] = {}
        self._cmd_queue: queue.Queue = queue.Queue()
        self._running = False
        self._status_snapshot: Dict[str, TaskStatus] = {}
        self._worker = threading.Thread(target=self._worker_loop, daemon=True, name="TaskThreadManagerWorker")
        self._worker.start()
        ColorPrint.blue("[TaskThreadManager] Initialized")
    
    def _update_snapshot(self):
        """Update status snapshot from current tasks (worker only)."""
        for name, task in self.tasks.items():
            self._status_snapshot[name] = task.status
    
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
                    self._update_snapshot()
                    if result_q is not None:
                        result_q.put(ok)
                elif cmd == "start_task":
                    name, = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].start()
                    else:
                        ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                    self._update_snapshot()
                    if result_q is not None:
                        result_q.put(ok)
                elif cmd == "stop_task":
                    name, = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].stop()
                    self._update_snapshot()
                    if result_q is not None:
                        result_q.put(ok)
                elif cmd == "set_status":
                    name, status = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].set_status(status)
                    self._update_snapshot()
                    if result_q is not None:
                        result_q.put(ok)
                elif cmd == "set_interval":
                    name, interval = args
                    ok = name in self.tasks
                    if ok:
                        self.tasks[name].interval = interval
                    self._update_snapshot()
                    if result_q is not None:
                        result_q.put(ok)
                elif cmd == "start_all":
                    for task in self.tasks.values():
                        task.start()
                    self._running = True
                    self._update_snapshot()
                    ColorPrint.green("[TaskThreadManager] All task threads started")
                    if result_q is not None:
                        result_q.put(None)
                elif cmd == "stop_all":
                    for task in self.tasks.values():
                        task.stop()
                    self._running = False
                    self._update_snapshot()
                    ColorPrint.yellow("[TaskThreadManager] All task threads stopped")
                    if result_q is not None:
                        result_q.put(None)
                elif cmd == "get_status":
                    name, = args
                    st = self.tasks[name].status if name in self.tasks else None
                    if result_q is not None:
                        result_q.put(st)
            except Exception as e:
                ColorPrint.red(f"[TaskThreadManager] Worker error: {e}")
                if result_q is not None:
                    try:
                        result_q.put(None)
                    except Exception:
                        pass
    
    def _fire(self, cmd: str, args: tuple) -> None:
        """Enqueue command without waiting; caller is never blocked."""
        self._cmd_queue.put((cmd, args, None))

    def _call(self, cmd: str, args: tuple, timeout: float = 10.0) -> Any:
        """Enqueue command and block until worker completes. Used for init to guarantee order."""
        result_q: queue.Queue = queue.Queue()
        self._cmd_queue.put((cmd, args, result_q))
        try:
            return result_q.get(timeout=timeout)
        except queue.Empty:
            ColorPrint.red(f"[TaskThreadManager] _call({cmd}) timeout")
            return None

    def register_and_start_task(
        self,
        name: str,
        task_func: Callable,
        interval: float = 1.0,
        initial_status: Optional["TaskStatus"] = None,
    ) -> bool:
        """Register task, start it, and set status in one synchronous sequence. Use at init to avoid race."""
        if initial_status is None:
            initial_status = TaskStatus.ENABLED
        ok = self._call("register", (name, task_func, interval))
        if not ok:
            return False
        self._call("start_task", (name,))
        self._call("set_status", (name, initial_status))
        return True

    def register_task(self, name: str, task_func: Callable, interval: float = 1.0) -> None:
        """Register a task. Non-blocking."""
        self._fire("register", (name, task_func, interval))

    def start_task(self, name: str) -> None:
        """Start one task. Non-blocking."""
        self._fire("start_task", (name,))

    def stop_task(self, name: str) -> None:
        """Stop one task. Non-blocking."""
        self._fire("stop_task", (name,))

    def set_task_status(self, name: str, status: TaskStatus) -> None:
        """Set task status. Non-blocking."""
        self._fire("set_status", (name, status))

    def set_task_interval(self, name: str, interval: float) -> None:
        """Set task interval. Non-blocking."""
        self._fire("set_interval", (name, interval))

    def start_all(self) -> None:
        """Start all task threads. Non-blocking."""
        self._fire("start_all", ())

    def stop_all(self) -> None:
        """Stop all task threads. Non-blocking."""
        self._fire("stop_all", ())

    def get_task_status(self, name: str) -> Optional[TaskStatus]:
        """Return current task status from snapshot; no cross-thread wait."""
        return self._status_snapshot.get(name)


# Global instance
_task_manager = None


def get_task_manager() -> TaskThreadManager:
    """Get global task thread manager instance"""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskThreadManager()
    return _task_manager
