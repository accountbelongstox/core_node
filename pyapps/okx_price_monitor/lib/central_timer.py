#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Central Timer

Central timer that ticks every 0.5 seconds and drives all other components.
Provides unified timestamps and controls execution frequency via skip counters.
"""

import time
import threading
from typing import Callable, Dict, Optional
from pycore.pyfoundations.color_print import ColorPrint


class CentralTimer:
    """
    Central Timer for OKX Monitor

    Ticks every 0.5 seconds and provides:
    - Unified timestamp generation
    - Task scheduling via skip counters
    - Thread-safe execution
    """

    def __init__(self, tick_interval_ms: int = 500):
        """
        Initialize central timer

        Args:
            tick_interval_ms (int): Tick interval in milliseconds (default: 500ms = 0.5s)
        """
        self.tick_interval = tick_interval_ms / 1000.0
        self.is_running = False
        self.stop_event = threading.Event()
        self.timer_thread = None

        # Tick counter
        self.tick_count = 0

        # Registered tasks: task_name -> {callback, skip_count, current_skip}
        self.tasks = {}

        # Lock for thread safety
        self.lock = threading.Lock()

    def register_task(self, task_name: str, callback: Callable, interval_ms: int):
        """
        Register a task to be executed at specified interval

        Args:
            task_name (str): Unique task name
            callback (Callable): Function to call with timestamp
            interval_ms (int): Execution interval in milliseconds

        Example:
            timer.register_task('coin_fetch', fetch_coins, 60000)  # Every 60 seconds
            timer.register_task('price_tick', fetch_prices, 1000)  # Every 1 second
        """
        # Calculate how many timer ticks to skip
        skip_count = max(1, int(interval_ms / (self.tick_interval * 1000))) - 1

        with self.lock:
            self.tasks[task_name] = {
                'callback': callback,
                'skip_count': skip_count,
                'current_skip': 0,
                'interval_ms': interval_ms,
                'last_execution': None,
                'execution_count': 0
            }

        ColorPrint.blue(f"[CentralTimer] Registered task '{task_name}' "
                       f"(interval: {interval_ms}ms, skip: {skip_count} ticks)")

    def unregister_task(self, task_name: str):
        """
        Unregister a task

        Args:
            task_name (str): Task name to remove
        """
        with self.lock:
            if task_name in self.tasks:
                del self.tasks[task_name]
                ColorPrint.blue(f"[CentralTimer] Unregistered task '{task_name}'")

    def _get_timestamp(self) -> int:
        """
        Get current timestamp in milliseconds

        Returns:
            int: Current timestamp
        """
        return int(time.time() * 1000)

    def _timer_loop(self):
        """
        Main timer loop
        """
        ColorPrint.green("[CentralTimer] Timer loop started")

        while not self.stop_event.is_set():
            loop_start = time.time()

            # Increment tick counter
            self.tick_count += 1

            # Get unified timestamp for this tick
            timestamp = self._get_timestamp()

            # Execute tasks
            with self.lock:
                tasks_to_execute = []

                for task_name, task_info in self.tasks.items():
                    # Check if it's time to execute
                    if task_info['current_skip'] >= task_info['skip_count']:
                        tasks_to_execute.append((task_name, task_info))
                        task_info['current_skip'] = 0
                    else:
                        task_info['current_skip'] += 1

            # Execute tasks outside lock to avoid blocking
            for task_name, task_info in tasks_to_execute:
                try:
                    ColorPrint.yellow(f"[CentralTimer] Tick #{self.tick_count}: Executing '{task_name}' "
                                    f"(#{task_info['execution_count'] + 1})")

                    # Call task with timestamp
                    task_info['callback'](timestamp)

                    task_info['last_execution'] = timestamp
                    task_info['execution_count'] += 1

                except Exception as e:
                    ColorPrint.red(f"[CentralTimer] Error executing task '{task_name}': {e}")

            # Sleep for remaining time
            elapsed = time.time() - loop_start
            sleep_time = max(0, self.tick_interval - elapsed)

            if sleep_time > 0:
                time.sleep(sleep_time)
            elif elapsed > self.tick_interval * 1.5:
                ColorPrint.yellow(f"[CentralTimer] Warning: Tick took {elapsed:.3f}s "
                                f"(expected {self.tick_interval:.3f}s)")

        ColorPrint.green("[CentralTimer] Timer loop stopped")

    def start(self):
        """
        Start the central timer
        """
        if self.is_running:
            ColorPrint.yellow("[CentralTimer] Timer is already running")
            return

        self.is_running = True
        self.stop_event.clear()
        self.tick_count = 0

        self.timer_thread = threading.Thread(target=self._timer_loop, daemon=True)
        self.timer_thread.start()

        ColorPrint.green(f"[CentralTimer] Started (tick interval: {self.tick_interval * 1000}ms)")

    def stop(self):
        """
        Stop the central timer
        """
        if not self.is_running:
            return

        ColorPrint.blue("[CentralTimer] Stopping timer...")
        self.stop_event.set()

        if self.timer_thread:
            self.timer_thread.join(timeout=5)

        self.is_running = False
        ColorPrint.green("[CentralTimer] Timer stopped")

    def get_stats(self) -> Dict:
        """
        Get timer statistics

        Returns:
            dict: Statistics
        """
        with self.lock:
            return {
                'is_running': self.is_running,
                'tick_count': self.tick_count,
                'tick_interval_ms': self.tick_interval * 1000,
                'registered_tasks': len(self.tasks),
                'tasks': {
                    name: {
                        'interval_ms': info['interval_ms'],
                        'execution_count': info['execution_count'],
                        'last_execution': info['last_execution'],
                        'skip_count': info['skip_count']
                    }
                    for name, info in self.tasks.items()
                }
            }

    def print_stats(self):
        """
        Print timer statistics
        """
        stats = self.get_stats()

        ColorPrint.green("\n=== Central Timer Statistics ===")
        ColorPrint.blue(f"Status: {'Running' if stats['is_running'] else 'Stopped'}")
        ColorPrint.blue(f"Total ticks: {stats['tick_count']}")
        ColorPrint.blue(f"Tick interval: {stats['tick_interval_ms']}ms")
        ColorPrint.blue(f"Registered tasks: {stats['registered_tasks']}")

        if stats['tasks']:
            ColorPrint.blue("\nTasks:")
            for task_name, task_info in stats['tasks'].items():
                ColorPrint.yellow(f"  {task_name}:")
                ColorPrint.white(f"    Interval: {task_info['interval_ms']}ms")
                ColorPrint.white(f"    Executions: {task_info['execution_count']}")
                ColorPrint.white(f"    Skip count: {task_info['skip_count']} ticks")
                if task_info['last_execution']:
                    ColorPrint.white(f"    Last execution: {task_info['last_execution']}")

        ColorPrint.green("================================\n")

    def wait_until_stopped(self):
        """
        Block until timer is stopped (useful for main thread)
        """
        try:
            while self.is_running:
                time.sleep(0.5)
        except KeyboardInterrupt:
            ColorPrint.yellow("\n[CentralTimer] Keyboard interrupt received")
            self.stop()
