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

import threading
import time
from typing import Dict, Callable, Optional, Any

# Core imports
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.tasks import TaskState
from pycore.pyutils.common.tasks import get_global_task_queue
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pythreadpool.pool import GlobalThreadPool, get_global_thread_pool, ThreadStatus


_CALLBACKS_SIGNAL = 'heartbeat.callbacks'
_CALLBACK_RESULT_QUEUE = 'heartbeat.callback.results'
_CALLBACK_WORK_QUEUE_PREFIX = 'heartbeat.callback.work'


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

    def copy(self) -> 'CallbackInfo':
        """Return a detached callback state snapshot."""
        snapshot = CallbackInfo(
            name=self.name,
            callback=self.callback,
            interval=self.interval,
            enabled=self.enabled,
        )
        snapshot.last_run_tick = self.last_run_tick
        snapshot.run_count = self.run_count
        snapshot.in_flight = self.in_flight
        snapshot.skip_count = self.skip_count
        snapshot.last_error = self.last_error
        return snapshot


class HeartbeatCallbackThread(threading.Thread):
    """Run one callback using work and result queues on THREAD_BUS."""

    def __init__(self, queue_name: str, callback_name: str) -> None:
        super().__init__(name=f"HeartbeatCallback-{callback_name}", daemon=True)
        self._queue_name = queue_name

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(self._queue_name)
        if not isinstance(payload, dict):
            return

        callback = payload.get('callback')
        callback_name = payload.get('name', '')
        due_tick = payload.get('due_tick', 0)
        error = None
        try:
            callback()
        except Exception as exc:
            error = repr(exc)
            ColorPrint.red(
                f"[Heartbeat] Callback '{callback_name}' error: {exc}"
            )

        THREAD_BUS.send_message(_CALLBACK_RESULT_QUEUE, {
            'name': callback_name,
            'due_tick': due_tick,
            'error': error,
        })
        THREAD_BUS.clear_queue(self._queue_name)


# ============================================================
# Heartbeat Pusher (Main Thread)
# ============================================================

class HeartbeatPusherThread(threading.Thread):
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
        super().__init__(name='HeartbeatPusherThread', daemon=True)
        self._config_signal = f"heartbeat.config.{id(self)}"
        self._stop_signal = f"heartbeat.stop.{id(self)}"
        self._running_signal = f"heartbeat.running.{id(self)}"
        self._stats_signal = f"heartbeat.stats.{id(self)}"
        THREAD_BUS.clear_signal(self._stop_signal)
        THREAD_BUS.signal(self._config_signal, {
            "tick_interval": tick_interval,
            "thread_pool": thread_pool,
        })
        THREAD_BUS.signal(self._running_signal, False)
        THREAD_BUS.signal(self._stats_signal, {})

        if THREAD_BUS.get_signal(_CALLBACKS_SIGNAL) is None:
            THREAD_BUS.signal(_CALLBACKS_SIGNAL, {})

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

    @property
    def tick_interval(self) -> float:
        config = THREAD_BUS.get_signal(self._config_signal, {}) or {}
        return float(config.get("tick_interval") or 1.0)

    @property
    def _task_queue(self):
        return get_global_task_queue()

    @property
    def _thread_pool(self):
        config = THREAD_BUS.get_signal(self._config_signal, {}) or {}
        return config.get("thread_pool") or get_global_thread_pool()

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
        callbacks = dict(THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {})
        callbacks[name] = CallbackInfo(
            name=name,
            callback=callback,
            interval=interval,
            enabled=enabled,
        )
        THREAD_BUS.signal(_CALLBACKS_SIGNAL, callbacks)
        ColorPrint.green(
            f"[Heartbeat] Registered callback: {name} (interval={interval}s)"
        )

    def unregister_callback(self, name: str):
        """Unregister a callback"""
        callbacks = dict(THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {})
        if name not in callbacks:
            return
        callbacks.pop(name, None)
        THREAD_BUS.signal(_CALLBACKS_SIGNAL, callbacks)
        ColorPrint.blue(f"[Heartbeat] Unregistered callback: {name}")

    def enable_callback(self, name: str) -> bool:
        """Enable a callback. Returns False when the name is not registered."""
        return self._set_callback_enabled(name, True)

    def disable_callback(self, name: str) -> bool:
        """Disable a callback. Returns False when the name is not registered."""
        return self._set_callback_enabled(name, False)

    def is_callback_enabled(self, name: str) -> bool:
        """Return live enabled flag for a registered callback."""
        callbacks = THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {}
        info = callbacks.get(name)
        return bool(info.enabled) if info is not None else False

    @staticmethod
    def _set_callback_enabled(name: str, enabled: bool) -> bool:
        """Publish an updated callback snapshot to THREAD_BUS."""
        callbacks = dict(THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {})
        info = callbacks.get(name)
        if info is None:
            return False
        updated_info = info.copy()
        updated_info.enabled = enabled
        callbacks[name] = updated_info
        THREAD_BUS.signal(_CALLBACKS_SIGNAL, callbacks)
        return True

    def run(self):
        """
        Main heartbeat loop

        THREAD_BUS Integration:
        - Checks THREAD_BUS.is_shutdown_requested() to stop gracefully
        - Triggers 'heartbeat.tick' event every tick for other modules to subscribe
        """
        THREAD_BUS.signal(self._running_signal, True)
        self._start_time = time.time()

        ColorPrint.green(f"[Heartbeat] Started (tick={self.tick_interval}s)")

        while not THREAD_BUS.get_signal(self._stop_signal, False):
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

            self._publish_stats()

            # Sleep for remaining time
            elapsed = time.time() - tick_start
            sleep_time = max(0, self.tick_interval - elapsed)

            if sleep_time > 0:
                THREAD_BUS.wait_signal(self._stop_signal, timeout=sleep_time)

        THREAD_BUS.signal(self._running_signal, False)
        self._publish_stats()
        ColorPrint.blue("[Heartbeat] Stopped")

    def _execute_callbacks(self):
        """
        Execute registered callbacks based on tick counter.

        Callback state and work move only through THREAD_BUS. Each due callback
        runs in a named Thread subclass and reports completion to the result
        queue; in-flight callbacks are skipped.
        """
        self._apply_callback_results()
        callbacks = dict(THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {})
        changed = False
        for callback_name, callback_info in tuple(callbacks.items()):
            if not callback_info.should_run(self._total_ticks):
                continue
            ci = callback_info.copy()
            if ci.in_flight:
                ci.skip_count += 1
                callbacks[callback_name] = ci
                changed = True
                continue
            ci.in_flight = True
            callbacks[callback_name] = ci
            changed = True
            queue_name = (
                f"{_CALLBACK_WORK_QUEUE_PREFIX}."
                f"{callback_name}.{self._total_ticks}"
            )
            THREAD_BUS.send_message(queue_name, {
                'callback': ci.callback,
                'name': callback_name,
                'due_tick': self._total_ticks,
            })
            HeartbeatCallbackThread(queue_name, callback_name).start()

        if changed:
            THREAD_BUS.signal(_CALLBACKS_SIGNAL, callbacks)

    @staticmethod
    def _apply_callback_results() -> None:
        """Apply callback completion messages to the bus-owned snapshot."""
        callbacks = dict(THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {})
        changed = False
        result = THREAD_BUS.receive_message(_CALLBACK_RESULT_QUEUE)
        while isinstance(result, dict):
            callback_name = result.get('name', '')
            info = callbacks.get(callback_name)
            if info is not None:
                updated_info = info.copy()
                updated_info.mark_run(result.get('due_tick', 0))
                updated_info.in_flight = False
                updated_info.last_error = result.get('error')
                callbacks[callback_name] = updated_info
                changed = True
            result = THREAD_BUS.receive_message(_CALLBACK_RESULT_QUEUE)

        if changed:
            THREAD_BUS.signal(_CALLBACKS_SIGNAL, callbacks)

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
        THREAD_BUS.signal(self._stop_signal, True)

    def is_running(self) -> bool:
        """Check if pusher is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False)) and self.is_alive()

    def get_stats(self) -> Dict:
        """Get heartbeat statistics"""
        return dict(THREAD_BUS.get_signal(self._stats_signal, {}) or {})

    def _publish_stats(self) -> None:
        """Publish a consistent heartbeat snapshot for other threads."""
        uptime = time.time() - self._start_time if self._start_time else 0

        callback_stats = {}
        callbacks = THREAD_BUS.get_signal(_CALLBACKS_SIGNAL, {}) or {}
        for name, callback_info in callbacks.items():
            callback_stats[name] = {
                'enabled': callback_info.enabled,
                'interval': callback_info.interval,
                'last_run_tick': callback_info.last_run_tick,
                'run_count': callback_info.run_count,
                'in_flight': callback_info.in_flight,
                'skip_count': callback_info.skip_count,
                'last_error': callback_info.last_error,
                'ticks_until_next': max(
                    0,
                    callback_info.interval
                    - (self._total_ticks - callback_info.last_run_tick),
                ),
            }

        THREAD_BUS.signal(self._stats_signal, {
            'running': bool(THREAD_BUS.get_signal(self._running_signal, False)),
            'alive': self.is_alive(),
            'uptime': uptime,
            'total_ticks': self._total_ticks,
            'tasks_pushed': self._tasks_pushed,
            'tasks_requeued': self._tasks_requeued,
            'tasks_failed': self._tasks_failed,
            'tick_interval': self.tick_interval,
            'queue_size': self._task_queue.size(),
            'callbacks': callback_stats
        })


# ============================================================
# Heartbeat System
# ============================================================

HeartbeatPusher = HeartbeatPusherThread


class HeartbeatSystem:
    """
    Unified heartbeat system coordinator

    Simplified version that only manages HeartbeatPusher.
    """

    def __init__(self):
        """Initialize heartbeat system"""
        self._running_signal = f"heartbeat.system.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        self._task_queue = get_global_task_queue()
        self._thread_pool = get_global_thread_pool()

        self._heartbeat_pusher: Optional[HeartbeatPusherThread] = None

        self._config = {
            'tick_interval': 1.0,
        }
        init_serialized_owner(self, "heartbeat.system.state", "HeartbeatSystemState")

    @serialized_method
    def start(self, tick_interval: Optional[float] = None):
        """
        Start heartbeat system

        Args:
            tick_interval: Heartbeat tick interval (default: 1.0s)
        """
        if THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.yellow("[HeartbeatSystem] Already running")
            return

        if tick_interval is not None:
            self._config['tick_interval'] = tick_interval

        ColorPrint.green("[HeartbeatSystem] Starting...")

        self._heartbeat_pusher = HeartbeatPusherThread(
            tick_interval=self._config['tick_interval'],
            thread_pool=self._thread_pool
        )
        self._heartbeat_pusher.start()

        THREAD_BUS.signal(self._running_signal, True)

        ColorPrint.green("[HeartbeatSystem] Started successfully")

    @serialized_method
    def stop(self):
        """Stop heartbeat system"""
        if not THREAD_BUS.get_signal(self._running_signal, False):
            return

        ColorPrint.yellow("[HeartbeatSystem] Stopping...")

        if self._heartbeat_pusher:
            self._heartbeat_pusher.stop()
            self._heartbeat_pusher.join(timeout=5.0)

        THREAD_BUS.signal(self._running_signal, False)

        ColorPrint.blue("[HeartbeatSystem] Stopped")

    @serialized_method
    def is_running(self) -> bool:
        """Check if system is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False)) and (
            self._heartbeat_pusher is not None and
            self._heartbeat_pusher.is_running()
        )

    @serialized_method
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

    @serialized_method
    def unregister_callback(self, name: str):
        """Unregister a callback"""
        if self._heartbeat_pusher:
            self._heartbeat_pusher.unregister_callback(name)

    @serialized_method
    def enable_callback(self, name: str) -> bool:
        """Enable a callback. Returns False when the name is not registered."""
        if self._heartbeat_pusher:
            return self._heartbeat_pusher.enable_callback(name)
        return False

    @serialized_method
    def disable_callback(self, name: str) -> bool:
        """Disable a callback. Returns False when the name is not registered."""
        if self._heartbeat_pusher:
            return self._heartbeat_pusher.disable_callback(name)
        return False

    @serialized_method
    def is_callback_enabled(self, name: str) -> bool:
        """Return live enabled flag for a registered callback."""
        if self._heartbeat_pusher:
            return self._heartbeat_pusher.is_callback_enabled(name)
        return False

    @serialized_method
    def get_stats(self) -> dict:
        """Get comprehensive system statistics"""
        stats = {
            'running': bool(THREAD_BUS.get_signal(self._running_signal, False)),
            'config': self._config.copy(),
            'thread_pool': self._thread_pool.get_stats(),
            'task_queue': self._task_queue.get_stats()
        }

        if self._heartbeat_pusher:
            stats['heartbeat'] = self._heartbeat_pusher.get_stats()

        return stats

    @serialized_method
    def get_total_ticks(self) -> int:
        """Get total tick count from heartbeat"""
        if self._heartbeat_pusher:
            return int(self._heartbeat_pusher.get_stats().get('total_ticks', 0))
        return 0

    def get_current_time(self) -> float:
        """Get current timestamp"""
        return time.time()

    @serialized_method
    def get_uptime(self) -> float:
        """Get heartbeat system uptime in seconds"""
        if not self._heartbeat_pusher:
            return 0.0
        return float(self._heartbeat_pusher.get_stats().get('uptime', 0.0))


# ============================================================
# Global Instance and Helper Functions
# ============================================================

_heartbeat_system = HeartbeatSystem()
def get_heartbeat_system() -> HeartbeatSystem:
    """
    Get heartbeat system singleton

    Returns:
        HeartbeatSystem instance
    """
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
    'HeartbeatPusherThread',
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system'
]
