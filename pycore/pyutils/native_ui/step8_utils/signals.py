#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Signal System Module
Signal system module with signal management and timer system
"""

# Import ColorPrint for logging
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

import time
from enum import Enum
from dataclasses import dataclass, field, replace
from typing import Optional, Callable, Dict, Any, List


class SignalType(Enum):
    """Signal type enumeration"""
    # Window control signals
    WINDOW_CLOSE = "window_close"
    WINDOW_MINIMIZE = "window_minimize"
    WINDOW_MAXIMIZE = "window_maximize"
    WINDOW_RESTORE = "window_restore"
    WINDOW_RESTART = "window_restart"
    WINDOW_SHOW = "window_show"
    WINDOW_HIDE = "window_hide"

    # UI event signals
    UI_READY = "ui_ready"
    UI_FOCUS = "ui_focus"
    UI_BLUR = "ui_blur"

    # Custom signals
    CUSTOM = "custom"


@dataclass
class Signal:
    """Signal data class"""
    signal_type: SignalType
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    callback: Optional[Callable] = None


class SignalManager:
    """
    Signal Manager - Handles signal emission and processing
    Implements asynchronous communication between UI thread and main thread
    """

    def __init__(self, debug: bool = False):
        self.debug = debug

        self._queue_name = f'pyutils.native_ui.signals.{id(self)}'
        self._handlers_signal = f'{self._queue_name}.handlers'
        THREAD_BUS.signal(self._handlers_signal, {})

        # Running state
        self.running = False

        self._log("Signal manager initialized", 'green')

    def _log(self, message: str, color: str = 'blue'):
        """Output log message"""
        if self.debug:
            getattr(ColorPrint, color)(f"[SignalManager] {message}")

    def register_handler(self, signal_type: SignalType, handler: Callable):
        """
        Register signal handler

        Args:
            signal_type: Signal type
            handler: Handler function, receives Signal object as parameter
        """
        handlers = dict(THREAD_BUS.get_signal(self._handlers_signal, {}) or {})
        type_handlers = list(handlers.get(signal_type, ()))
        type_handlers.append(handler)
        handlers[signal_type] = tuple(type_handlers)
        THREAD_BUS.signal(self._handlers_signal, handlers)
        self._log(f"Registered handler: {signal_type.value}")

    def emit(self, signal_type: SignalType, data: Optional[Dict[str, Any]] = None,
             callback: Optional[Callable] = None):
        """
        Emit signal

        Args:
            signal_type: Signal type
            data: Signal data
            callback: Callback function after processing completes
        """
        signal = Signal(
            signal_type=signal_type,
            data=data or {},
            callback=callback
        )

        THREAD_BUS.send_message(self._queue_name, signal)

        if self.debug:
            self._log(f"Signal emitted: {signal_type.value}", 'cyan')

    def process_signals(self):
        """Process all signals in the queue (called from main thread)"""
        while True:
            signal = THREAD_BUS.receive_message(self._queue_name)
            if not isinstance(signal, Signal):
                break
            self._process_signal(signal)

    def _process_signal(self, signal: Signal):
        """
        Process a single signal

        Args:
            signal: Signal object
        """
        if self.debug:
            self._log(f"Processing signal: {signal.signal_type.value}", 'yellow')

        # Find and execute corresponding handlers
        handlers = (
            THREAD_BUS.get_signal(self._handlers_signal, {}) or {}
        ).get(signal.signal_type, ())

        for handler in handlers:
            try:
                handler(signal)
            except Exception as e:
                ColorPrint.red(f"[SignalManager] Handler execution error: {e}")

        # Execute callback
        if signal.callback:
            try:
                signal.callback(signal)
            except Exception as e:
                ColorPrint.red(f"[SignalManager] Callback execution error: {e}")


# ============================================
# Timer System
# ============================================

@dataclass
class TimerTask:
    """
    Timer task data class

    Args:
        name: Task name
        callback: Callback function
        interval: Interval parameter, executes every N ticks (default 1, executes on every tick)
        enabled: Whether enabled
    """
    name: str
    callback: Callable
    interval: int = 1  # Interval parameter: execute every N ticks
    enabled: bool = True
    _tick_counter: int = field(default=0, init=False)  # Internal counter

    def should_execute(self, current_tick: int) -> bool:
        """
        Determine if should execute on current tick

        Args:
            current_tick: Current tick count

        Returns:
            bool: Whether should execute
        """
        if not self.enabled:
            return False

        # Use interval parameter to determine
        return current_tick % self.interval == 0


class TaskTimer:
    """
    Task Timer Manager
    Default 1 second tick, supports timer registration and interceptors
    """

    def __init__(self, tick_interval: float = 1.0, debug: bool = False):
        """
        Initialize timer

        Args:
            tick_interval: Tick interval (seconds), default 1 second
            debug: Debug mode
        """
        self.tick_interval = tick_interval
        self.debug = debug

        # Timer task list
        self._tasks_signal = f'pyutils.native_ui.task_timer.{id(self)}.tasks'
        THREAD_BUS.signal(self._tasks_signal, ())

        # Tick counter
        self.tick_count = 0

        # Running state
        self.running = False

        self._log("Task timer initialized", 'green')

    def _log(self, message: str, color: str = 'blue'):
        """Output log message"""
        if self.debug:
            getattr(ColorPrint, color)(f"[TaskTimer] {message}")

    def register_task(self, name: str, callback: Callable, interval: int = 1) -> TimerTask:
        """
        Register timer task

        Args:
            name: Task name
            callback: Callback function
            interval: Interval parameter, execute every N ticks

        Returns:
            TimerTask: Task object
        """
        task = TimerTask(
            name=name,
            callback=callback,
            interval=interval
        )

        tasks = list(THREAD_BUS.get_signal(self._tasks_signal, ()) or ())
        tasks.append(task)
        THREAD_BUS.signal(self._tasks_signal, tuple(tasks))

        self._log(f"Registered timer task: {name} (interval={interval})", 'cyan')
        return task

    def unregister_task(self, name: str) -> bool:
        """
        Unregister timer task

        Args:
            name: Task name

        Returns:
            bool: Whether successfully unregistered
        """
        tasks = list(THREAD_BUS.get_signal(self._tasks_signal, ()) or ())
        for index, task in enumerate(tasks):
            if task.name == name:
                tasks.pop(index)
                THREAD_BUS.signal(self._tasks_signal, tuple(tasks))
                self._log(f"Unregistered timer task: {name}", 'yellow')
                return True

        return False

    def enable_task(self, name: str) -> bool:
        """
        Enable timer task

        Args:
            name: Task name

        Returns:
            bool: Whether successful
        """
        tasks = list(THREAD_BUS.get_signal(self._tasks_signal, ()) or ())
        for index, task in enumerate(tasks):
            if task.name == name:
                tasks[index] = replace(task, enabled=True)
                THREAD_BUS.signal(self._tasks_signal, tuple(tasks))
                self._log(f"Enabled timer task: {name}", 'green')
                return True

        return False

    def disable_task(self, name: str) -> bool:
        """
        Disable timer task

        Args:
            name: Task name

        Returns:
            bool: Whether successful
        """
        tasks = list(THREAD_BUS.get_signal(self._tasks_signal, ()) or ())
        for index, task in enumerate(tasks):
            if task.name == name:
                tasks[index] = replace(task, enabled=False)
                THREAD_BUS.signal(self._tasks_signal, tuple(tasks))
                self._log(f"Disabled timer task: {name}", 'yellow')
                return True

        return False

    def _tick(self):
        """Execute one tick"""
        self.tick_count += 1

        if self.debug:
            self._log(f"Tick #{self.tick_count}", 'blue')

        # Execute all eligible tasks
        tasks = tuple(THREAD_BUS.get_signal(self._tasks_signal, ()) or ())
        for task in tasks:
            if task.should_execute(self.tick_count):
                try:
                    if self.debug:
                        self._log(f"Executing task: {task.name}", 'green')
                    task.callback()
                except Exception as e:
                    ColorPrint.red(f"[TaskTimer] Task '{task.name}' execution error: {e}")

    def run(self):
        """Run timer (blocking)"""
        self._log("Timer thread started", 'green')
        self.running = True

        while self.running:
            try:
                start_time = time.time()

                # Execute tick
                self._tick()

                # Calculate sleep time to ensure accurate interval
                elapsed = time.time() - start_time
                sleep_time = max(0, self.tick_interval - elapsed)

                time.sleep(sleep_time)

            except Exception as e:
                ColorPrint.red(f"[TaskTimer] Timer error: {e}")

        self._log("Timer thread stopped", 'yellow')

    def stop(self):
        """Stop timer"""
        self.running = False


# ============================================
# Main Thread Method Registration System
# ============================================

class MainThreadExecutor:
    """
    Main thread method executor
    Allows registration of methods to be executed in main thread
    """

    def __init__(self, debug: bool = False):
        self.debug = debug

        self._queue_name = f'pyutils.native_ui.main_executor.{id(self)}'
        self._methods_signal = f'{self._queue_name}.methods'
        THREAD_BUS.signal(self._methods_signal, {})

        self._log("Main thread executor initialized", 'green')

    def _log(self, message: str, color: str = 'blue'):
        """Output log message"""
        if self.debug:
            getattr(ColorPrint, color)(f"[MainThreadExecutor] {message}")

    def register_method(self, name: str, method: Callable):
        """
        Register main thread method

        Args:
            name: Method name
            method: Method function
        """
        methods = dict(THREAD_BUS.get_signal(self._methods_signal, {}) or {})
        methods[name] = method
        THREAD_BUS.signal(self._methods_signal, methods)
        self._log(f"Registered main thread method: {name}", 'cyan')

    def call(self, name: str, *args, **kwargs):
        """
        Call registered main thread method

        Args:
            name: Method name
            *args: Positional arguments
            **kwargs: Keyword arguments
        """
        methods = THREAD_BUS.get_signal(self._methods_signal, {}) or {}
        if name not in methods:
            ColorPrint.red(f"[MainThreadExecutor] Method not registered: {name}")
            return

        # Put method call into queue
        THREAD_BUS.send_message(self._queue_name, (name, args, kwargs))

    def execute_pending(self):
        """Execute all pending method calls (called from main thread)"""
        while True:
            payload = THREAD_BUS.receive_message(self._queue_name)
            if not isinstance(payload, tuple) or len(payload) != 3:
                break
            name, args, kwargs = payload
            method = (THREAD_BUS.get_signal(self._methods_signal, {}) or {}).get(name)
            if method:
                try:
                    if self.debug:
                        self._log(f"Executing method: {name}", 'green')
                    method(*args, **kwargs)
                except Exception as e:
                    ColorPrint.red(f"[MainThreadExecutor] Method '{name}' execution error: {e}")
