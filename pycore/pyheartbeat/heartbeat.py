#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Heartbeat System

A simplified, unified heartbeat system that:
1. Ticks every 1 second
2. Supports callback registration with intervals (using tick counter interceptor)
3. Processes task queue
4. No additional threads - all in one HeartbeatPusher thread

Architecture:
    HeartbeatPusher (1s tick) → Check callbacks → Process task queue
                                       ↓
                                 Counter interceptor
                                 (30s = skip 29 ticks, run on 30th)

THREAD_BUS Integration:
    - Registers shutdown handler (priority=100, runs last)
    - Triggers 'heartbeat.tick' events every tick
    - Checks THREAD_BUS.is_shutdown_requested() in main loop
    - Backwards compatible: keeps existing callback mechanism
"""

import time
import threading
import concurrent.futures
from typing import Dict, Callable, Optional, Any

# Core imports
from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations import get_global_task_queue, TaskState
from pycore.pythreadpool import GlobalThreadPool, get_global_thread_pool, ThreadStatus


# ============================================================
# Callback Info
# ============================================================

class CallbackInfo:
    """
    Information about a registered callback

    Uses tick counter instead of time comparison for interval checking.
    """

    def __init__(
        self,
        name: str,
        callback: Callable,
        interval: int,
        enabled: bool = True
    ):
        """
        Initialize callback info

        Args:
            name: Callback name
            callback: Callback function
            interval: Interval in seconds (converted to tick count)
            enabled: Whether callback is enabled
        """
        self.name = name
        self.callback = callback
        self.interval = interval  # seconds (1 tick = 1 second)
        self.enabled = enabled

        self.last_run_tick = 0
        self.run_count = 0
        # Idempotent-skip bookkeeping: when a callback's previous invocation is
        # still running (in_flight), the next due tick SKIPS it instead of piling
        # up work or spawning extra threads. skip_count tracks how many due ticks
        # were skipped; last_error aids diagnostics.
        self.in_flight = False
        self.skip_count = 0
        self.last_error: Optional[str] = None

    def should_run(self, current_tick: int) -> bool:
        """
        Check if callback should run on this tick

        Args:
            current_tick: Current tick number

        Returns:
            True if callback should run
        """
        if not self.enabled:
            return False

        # Interceptor: check if interval has passed
        return (current_tick - self.last_run_tick) >= self.interval

    def mark_run(self, current_tick: int):
        """Mark callback as run"""
        self.last_run_tick = current_tick
        self.run_count += 1


# ============================================================
# Heartbeat Pusher (Main Thread)
# ============================================================

class HeartbeatPusher(threading.Thread):
    """
    Unified heartbeat pusher

    - Ticks every 1 second
    - Executes registered callbacks based on interval (tick counter)
    - Processes task queue
    - All in one thread
    """

    def __init__(
        self,
        tick_interval: float = 1.0,
        thread_pool: Optional[GlobalThreadPool] = None
    ):
        """
        Initialize heartbeat pusher

        Args:
            tick_interval: Tick interval in seconds (default: 1.0)
            thread_pool: GlobalThreadPool instance
        """
        super().__init__(name='HeartbeatPusher', daemon=True)

        self.tick_interval = tick_interval
        self._stop_event = threading.Event()
        self._running = False

        self._task_queue = get_global_task_queue()
        self._thread_pool = thread_pool or get_global_thread_pool()

        # Callback registry (保留向后兼容性)
        self._callbacks: Dict[str, CallbackInfo] = {}
        self._callbacks_lock = threading.Lock()

        # Bounded pool that RUNS callback bodies off the tick thread. This is the
        # idempotent-skip mechanism: the single HeartbeatPusher thread only
        # schedules due callbacks here; if a callback is still in_flight from a
        # prior tick, the next due tick skips it (no extra thread, no pile-up).
        # A small shared pool keeps thread count bounded regardless of how many
        # callbacks are registered.
        self._callback_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=4, thread_name_prefix='HeartbeatCb')

        # Statistics
        self._total_ticks = 0
        self._start_time: Optional[float] = None
        self._tasks_pushed = 0
        self._tasks_requeued = 0
        self._tasks_failed = 0

        # THREAD_BUS Integration: Register shutdown handler
        # Priority=100 ensures heartbeat stops LAST (after all other services)
        # This allows other services to use heartbeat during their shutdown
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=100,
            name="heartbeat"
        )
        ColorPrint.blue("[Heartbeat] Registered THREAD_BUS shutdown handler (priority=100)")

    def register_callback(
        self,
        name: str,
        callback: Callable,
        interval: int = 1,
        enabled: bool = True
    ):
        """
        Register a callback function

        Args:
            name: Unique callback name
            callback: Callback function (no arguments)
            interval: Interval in seconds (default: 1)
            enabled: Whether callback is enabled
        """
        with self._callbacks_lock:
            callback_info = CallbackInfo(
                name=name,
                callback=callback,
                interval=interval,
                enabled=enabled
            )
            self._callbacks[name] = callback_info
            ColorPrint.green(f"[Heartbeat] Registered callback: {name} (interval={interval}s)")

    def unregister_callback(self, name: str):
        """Unregister a callback"""
        with self._callbacks_lock:
            if name in self._callbacks:
                del self._callbacks[name]
                ColorPrint.blue(f"[Heartbeat] Unregistered callback: {name}")

    def enable_callback(self, name: str):
        """Enable a callback"""
        with self._callbacks_lock:
            if name in self._callbacks:
                self._callbacks[name].enabled = True

    def disable_callback(self, name: str):
        """Disable a callback"""
        with self._callbacks_lock:
            if name in self._callbacks:
                self._callbacks[name].enabled = False

    def run(self):
        """
        Main heartbeat loop

        THREAD_BUS Integration:
        - Checks THREAD_BUS.is_shutdown_requested() to stop gracefully
        - Triggers 'heartbeat.tick' event every tick for other modules to subscribe
        """
        self._running = True
        self._start_time = time.time()

        ColorPrint.green(f"[Heartbeat] Started (tick={self.tick_interval}s)")

        while not self._stop_event.is_set():
            # THREAD_BUS Integration: Check if global shutdown was requested
            # This allows clean shutdown even if stop() wasn't called directly
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow("[Heartbeat] THREAD_BUS shutdown detected, stopping...")
                break

            tick_start = time.time()
            self._total_ticks += 1

            try:
                # Execute registered callbacks (backwards compatible mechanism)
                self._execute_callbacks()

                # Process task queue
                self._process_tasks()

                # THREAD_BUS Integration: Trigger tick event
                # Other modules can subscribe to this event instead of using callbacks
                # Event data includes tick number and timestamp for subscriber convenience
                THREAD_BUS.trigger_event('heartbeat.tick', {
                    'tick_number': self._total_ticks,
                    'timestamp': time.time(),
                    'uptime': time.time() - self._start_time
                }, async_mode=True)  # async to avoid blocking heartbeat loop

            except Exception as e:
                ColorPrint.red(f"[Heartbeat] Tick error: {e}")

            # Log heartbeat (every 10 ticks = 10 seconds)
            if self._total_ticks % 10 == 0:
                current_time_str = time.strftime("%Y-%m-%d %H:%M:%S")
                ColorPrint.blue(f"[Heartbeat] Tick #{self._total_ticks}, Time: {current_time_str}")

            # Sleep for remaining time
            elapsed = time.time() - tick_start
            sleep_time = max(0, self.tick_interval - elapsed)

            if sleep_time > 0:
                self._stop_event.wait(timeout=sleep_time)

        self._running = False
        ColorPrint.blue("[Heartbeat] Stopped")

    def _execute_callbacks(self):
        """
        Execute registered callbacks based on tick counter.

        Idempotent-skip design: the tick thread only SNAPSHOTs the due callbacks
        (under the lock) and schedules each on the bounded executor. If a
        callback's previous invocation is still running (in_flight), the new due
        tick SKIPS it - so one slow callback cannot block another, and no extra
        thread is started for an overlapping invocation. mark_run is always
        applied (in the worker's finally), so a raising callback still honors its
        interval instead of re-firing every 1s tick.
        """
        with self._callbacks_lock:
            due = [ci for ci in self._callbacks.values()
                   if ci.should_run(self._total_ticks)]
        for ci in due:
            if ci.in_flight:
                # Previous invocation still running -> idempotent skip.
                ci.skip_count += 1
                continue
            ci.in_flight = True
            self._callback_executor.submit(self._run_callback, ci, self._total_ticks)

    def _run_callback(self, ci: 'CallbackInfo', due_tick: int):
        """Worker that runs one callback body, then always marks it run.

        Runs on the bounded executor (NOT the tick thread). mark_run is in the
        finally so an exception cannot collapse the callback's interval to 1s
        (the old retry-storm bug). in_flight is cleared here so the next due tick
        may schedule it again.
        """
        try:
            ci.callback()
        except Exception as e:
            ci.last_error = repr(e)
            ColorPrint.red(f"[Heartbeat] Callback '{ci.name}' error: {e}")
        finally:
            ci.mark_run(due_tick)
            ci.in_flight = False

    def _process_tasks(self):
        """Process tasks from task queue"""
        task = self._task_queue.get(block=False, timeout=0.1)

        if not task:
            return

        if task.state == TaskState.CANCELLED:
            return

        # Get handlers for task type
        handlers = self._thread_pool.get_handlers_for_task_type(task.task_type)

        if not handlers:
            ColorPrint.yellow(f"[Heartbeat] No handler for task: {task.task_type}")
            task.mark_failed(f"No handler for task_type: {task.task_type}")
            self._tasks_failed += 1
            return

        # Try handlers
        for thread_info, handler_fn in handlers:
            if thread_info.status != ThreadStatus.RUNNING:
                continue

            try:
                accepted = handler_fn(task)

                if accepted:
                    self._tasks_pushed += 1
                    return

            except Exception as e:
                ColorPrint.red(f"[Heartbeat] Handler error ('{thread_info.name}'): {e}")
                continue

        # No handler accepted, requeue
        self._tasks_requeued += 1
        self._task_queue.put(task, block=False)

    def stop(self):
        """
        Stop heartbeat pusher

        THREAD_BUS Integration:
        This method is registered as a shutdown handler in THREAD_BUS.
        It will be automatically called during system shutdown (priority=100, last to stop).

        This ensures heartbeat continues running while other services are shutting down,
        allowing them to use task queue processing during their cleanup.
        """
        ColorPrint.yellow("[Heartbeat] Stopping...")
        self._stop_event.set()
        # Stop accepting new callback work; in-flight workers finish on their own
        # (best-effort, non-blocking: shutdown must not hang the tick thread).
        try:
            self._callback_executor.shutdown(wait=False)
        except Exception:
            pass

    def is_running(self) -> bool:
        """Check if pusher is running"""
        return self._running and self.is_alive()

    def get_stats(self) -> Dict:
        """Get heartbeat statistics"""
        uptime = time.time() - self._start_time if self._start_time else 0

        callback_stats = {}
        with self._callbacks_lock:
            for name, callback_info in self._callbacks.items():
                callback_stats[name] = {
                    'enabled': callback_info.enabled,
                    'interval': callback_info.interval,
                    'last_run_tick': callback_info.last_run_tick,
                    'run_count': callback_info.run_count,
                    'in_flight': callback_info.in_flight,
                    'skip_count': callback_info.skip_count,
                    'last_error': callback_info.last_error,
                    'ticks_until_next': max(0, callback_info.interval - (self._total_ticks - callback_info.last_run_tick))
                }

        return {
            'running': self._running,
            'alive': self.is_alive(),
            'uptime': uptime,
            'total_ticks': self._total_ticks,
            'tasks_pushed': self._tasks_pushed,
            'tasks_requeued': self._tasks_requeued,
            'tasks_failed': self._tasks_failed,
            'tick_interval': self.tick_interval,
            'queue_size': self._task_queue.size(),
            'callbacks': callback_stats
        }


# ============================================================
# Heartbeat System
# ============================================================

class HeartbeatSystem:
    """
    Unified heartbeat system coordinator

    Simplified version that only manages HeartbeatPusher.
    """

    _instance: Optional['HeartbeatSystem'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize heartbeat system"""
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._initialized = True
        self._running = False

        self._task_queue = get_global_task_queue()
        self._thread_pool = get_global_thread_pool()

        self._heartbeat_pusher: Optional[HeartbeatPusher] = None

        self._config = {
            'tick_interval': 1.0,
        }

    def start(self, tick_interval: Optional[float] = None):
        """
        Start heartbeat system

        Args:
            tick_interval: Heartbeat tick interval (default: 1.0s)
        """
        if self._running:
            ColorPrint.yellow("[HeartbeatSystem] Already running")
            return

        if tick_interval is not None:
            self._config['tick_interval'] = tick_interval

        ColorPrint.green("[HeartbeatSystem] Starting...")

        self._heartbeat_pusher = HeartbeatPusher(
            tick_interval=self._config['tick_interval'],
            thread_pool=self._thread_pool
        )
        self._heartbeat_pusher.start()

        self._running = True

        ColorPrint.green("[HeartbeatSystem] Started successfully")

    def stop(self):
        """Stop heartbeat system"""
        if not self._running:
            return

        ColorPrint.yellow("[HeartbeatSystem] Stopping...")

        if self._heartbeat_pusher:
            self._heartbeat_pusher.stop()
            self._heartbeat_pusher.join(timeout=5.0)

        self._running = False

        ColorPrint.blue("[HeartbeatSystem] Stopped")

    def is_running(self) -> bool:
        """Check if system is running"""
        return self._running and (
            self._heartbeat_pusher is not None and
            self._heartbeat_pusher.is_running()
        )

    def register_callback(
        self,
        name: str,
        callback: Callable,
        interval: int = 1,
        enabled: bool = True
    ):
        """
        Register a callback function

        Args:
            name: Unique callback name
            callback: Callback function
            interval: Interval in seconds
            enabled: Whether callback is enabled
        """
        if self._heartbeat_pusher:
            self._heartbeat_pusher.register_callback(name, callback, interval, enabled)
        else:
            ColorPrint.yellow("[HeartbeatSystem] Not started, cannot register callback")

    def unregister_callback(self, name: str):
        """Unregister a callback"""
        if self._heartbeat_pusher:
            self._heartbeat_pusher.unregister_callback(name)

    def enable_callback(self, name: str):
        """Enable a callback"""
        if self._heartbeat_pusher:
            self._heartbeat_pusher.enable_callback(name)

    def disable_callback(self, name: str):
        """Disable a callback"""
        if self._heartbeat_pusher:
            self._heartbeat_pusher.disable_callback(name)

    def get_stats(self) -> dict:
        """Get comprehensive system statistics"""
        stats = {
            'running': self._running,
            'config': self._config.copy(),
            'thread_pool': self._thread_pool.get_stats(),
            'task_queue': self._task_queue.get_stats()
        }

        if self._heartbeat_pusher:
            stats['heartbeat'] = self._heartbeat_pusher.get_stats()

        return stats

    def get_total_ticks(self) -> int:
        """Get total tick count from heartbeat"""
        if self._heartbeat_pusher:
            return self._heartbeat_pusher._total_ticks
        return 0

    def get_current_time(self) -> float:
        """Get current timestamp"""
        return time.time()

    def get_uptime(self) -> float:
        """Get heartbeat system uptime in seconds"""
        if self._heartbeat_pusher and self._heartbeat_pusher._start_time:
            return time.time() - self._heartbeat_pusher._start_time
        return 0.0


# ============================================================
# Global Instance and Helper Functions
# ============================================================

_heartbeat_system: Optional[HeartbeatSystem] = None
_system_lock = threading.Lock()


def get_heartbeat_system() -> HeartbeatSystem:
    """
    Get heartbeat system singleton

    Returns:
        HeartbeatSystem instance
    """
    global _heartbeat_system

    if _heartbeat_system is None:
        with _system_lock:
            if _heartbeat_system is None:
                _heartbeat_system = HeartbeatSystem()

    return _heartbeat_system


def initialize_heartbeat_system() -> HeartbeatSystem:
    """
    Initialize and return heartbeat system

    This is the main entry point for starting the heartbeat system.

    Returns:
        HeartbeatSystem instance
    """
    system = get_heartbeat_system()

    ColorPrint.blue("[Heartbeat] Initialized")
    ColorPrint.blue("[Heartbeat] Use system.start() to begin operation")

    return system


__all__ = [
    'CallbackInfo',
    'HeartbeatPusher',
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system'
]
