#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Heartbeat Pusher

1-second heartbeat loop that routes tasks to registered threads.
"""

import threading
import time
from typing import Optional, Dict
from pycore.pyfoundations import ColorPrint, get_global_task_queue, TaskState
from pycore.pyheartbeat.thread_pool import GlobalThreadPool, get_global_thread_pool, ThreadStatus


class HeartbeatPusher(threading.Thread):
    """
    Heartbeat pusher thread

    Polls global task queue every 1 second and routes tasks to
    registered threads based on task_type.
    """

    def __init__(
        self,
        tick_interval: float = 1.0,
        thread_pool: Optional[GlobalThreadPool] = None
    ):
        """
        Initialize heartbeat pusher

        Args:
            tick_interval: Polling interval in seconds (default: 1.0)
            thread_pool: GlobalThreadPool instance
        """
        super().__init__(name='HeartbeatPusher', daemon=True)

        self.tick_interval = tick_interval
        self._stop_flag = False
        self._running = False

        self._task_queue = get_global_task_queue()
        self._thread_pool = thread_pool or get_global_thread_pool()

        self._total_ticks = 0
        self._start_time: Optional[float] = None
        self._tasks_pushed = 0
        self._tasks_requeued = 0
        self._tasks_failed = 0

    def run(self):
        """
        Main heartbeat loop

        Polls task queue and routes tasks to threads.
        """
        self._running = True
        self._start_time = time.time()

        ColorPrint.green(f"[HeartbeatPusher] Started (interval={self.tick_interval}s)")

        while not self._stop_flag:
            tick_start = time.time()

            try:
                self._tick()
            except Exception as e:
                ColorPrint.red(f"[HeartbeatPusher] Tick error: {e}")

            elapsed = time.time() - tick_start
            sleep_time = max(0, self.tick_interval - elapsed)

            if sleep_time > 0:
                time.sleep(sleep_time)

        self._running = False
        ColorPrint.blue("[HeartbeatPusher] Stopped")

    def _tick(self):
        """
        Single heartbeat tick

        Polls queue for tasks and routes them to threads.
        """
        self._total_ticks += 1

        task = self._task_queue.get(block=False, timeout=0.1)

        if not task:
            return

        if task.state == TaskState.CANCELLED:
            return

        handlers = self._thread_pool.get_handlers_for_task_type(task.task_type)

        if not handlers:
            ColorPrint.yellow(f"[HeartbeatPusher] No handler registered for task_type: {task.task_type}")
            task.mark_failed(f"No handler for task_type: {task.task_type}")
            self._tasks_failed += 1
            return

        for thread_info, handler_fn in handlers:
            if thread_info.status != ThreadStatus.RUNNING:
                continue

            try:
                accepted = handler_fn(task)

                if accepted:
                    self._tasks_pushed += 1
                    return

            except Exception as e:
                ColorPrint.red(f"[HeartbeatPusher] Error calling handler for thread '{thread_info.name}': {e}")
                continue

        self._tasks_requeued += 1
        self._task_queue.put(task, block=False)

    def stop(self):
        """Stop heartbeat pusher"""
        self._stop_flag = True
        ColorPrint.yellow("[HeartbeatPusher] Stopping...")

    def is_running(self) -> bool:
        """Check if pusher is running"""
        return self._running and self.is_alive()

    def get_stats(self) -> Dict:
        """
        Get pusher statistics

        Returns:
            Dictionary with statistics
        """
        uptime = time.time() - self._start_time if self._start_time else 0

        return {
            'running': self._running,
            'alive': self.is_alive(),
            'uptime': uptime,
            'total_ticks': self._total_ticks,
            'tasks_pushed': self._tasks_pushed,
            'tasks_requeued': self._tasks_requeued,
            'tasks_failed': self._tasks_failed,
            'tick_interval': self.tick_interval,
            'queue_size': self._task_queue.size()
        }


__all__ = [
    'HeartbeatPusher'
]
