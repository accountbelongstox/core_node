#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Thread Communication Bus

Global message bus for inter-thread communication. Event-driven — every
wait path is backed by a threading.Condition owned by the state thread;
there is no time.sleep polling anywhere on the hot path.

Package layout (split from the former monolithic thread_bus.py):
- shutdown_stack.py         : ShutdownStack - stack-based shutdown handler registry
- event_handler_registry.py : EventHandlerRegistry - priority event handlers
- __init__.py (this file)   : ThreadBus facade + THREAD_BUS singleton

Usage:
    from pycore import THREAD_BUS

    THREAD_BUS.signal('startup_complete', {'status': 'ready'})
    data = THREAD_BUS.wait_signal('startup_complete', timeout=5.0)
"""

import queue
import time
import threading
from typing import Any, Dict, List, Optional, Callable
from collections import deque

from pycore.pyfoundations.thread_bus.shutdown_stack import ShutdownStack
from pycore.pyfoundations.thread_bus.event_handler_registry import EventHandlerRegistry

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# Sentinel returned from state-thread work when the state operation wants the
# CALLER to notify one or more conditions AFTER _call_state returns (so notify
# never runs while the state thread holds the GIL doing external work).
class _StatePayload:
    __slots__ = ("result", "notify_conditions")

    def __init__(self, result: Any, notify_conditions: List[threading.Condition]) -> None:
        self.result = result
        self.notify_conditions = notify_conditions


class ThreadBusStateThread(threading.Thread):
    """Own ThreadBus containers and execute state operations sequentially."""

    def __init__(self) -> None:
        super().__init__(name="ThreadBusStateThread", daemon=True)
        self._requests: "queue.Queue[tuple]" = queue.Queue()

    def call(self, callback: Callable, *args: Any, **kwargs: Any) -> Any:
        if threading.current_thread() is self:
            return callback(*args, **kwargs)

        done = threading.Event()
        holder: List[Any] = [None, None]  # (succeeded, result_or_exc)
        self._requests.put((callback, args, kwargs, done, holder))
        done.wait()
        succeeded, payload = holder[0], holder[1]
        if not succeeded:
            raise payload
        return payload

    def run(self) -> None:
        while True:
            callback, args, kwargs, done, holder = self._requests.get()
            try:
                result = callback(*args, **kwargs)
                holder[0] = True
                holder[1] = result
            except Exception as exc:
                holder[0] = False
                holder[1] = exc
            done.set()


class ThreadBus:
    """
    Global communication bus for inter-thread messaging.

    All internal state is owned by ThreadBusStateThread and mutated only
    inside `_call_state`. Wakeups for wait_signal / receive_message(block=True)
    / wait_thread_state are delivered via threading.Condition objects, so
    hot paths never sleep-poll.
    """

    def __init__(self):
        # Signal store: {signal_name: signal_data}
        self._signals: Dict[str, Any] = {}
        # Thread state: {thread_name: state_data}
        self._thread_states: Dict[str, Dict[str, Any]] = {}
        # Message queues: {queue_name: deque([message, ...])}
        self._queues: Dict[str, deque] = {}

        # Event handlers: {event_name: [(priority, handler_func), ...]}
        self._event_handlers: Dict[str, List[tuple]] = {}

        # Shutdown handlers: [(priority, name, handler_func), ...]
        self._shutdown_handlers: List[tuple] = []
        self._shutdown_executed: bool = False
        self._restart_requested: bool = False

        # Wakeup conditions - one per named signal / queue, plus one shared
        # condition for thread-state changes. They are created lazily inside
        # _call_state so lookups + creates never race.
        self._signal_conditions: Dict[str, threading.Condition] = {}
        self._queue_conditions: Dict[str, threading.Condition] = {}
        self._thread_state_condition: threading.Condition = threading.Condition()

        self._state_owner = ThreadBusStateThread()
        self._state_owner.start()

        # Composed helpers route state operations through this bus owner.
        self._shutdown_stack = ShutdownStack(self)
        self._event_registry = EventHandlerRegistry(self)

    def _call_state(self, callback: Callable, *args: Any, **kwargs: Any) -> Any:
        """Execute one internal state operation on the bus owner thread.

        If the state operation returns a _StatePayload the caller's thread
        performs the wakeups AFTER _call_state returns — never inside the
        state thread's critical section.
        """
        result = self._state_owner.call(callback, *args, **kwargs)
        if isinstance(result, _StatePayload):
            for cond in result.notify_conditions:
                with cond:
                    cond.notify_all()
            return result.result
        return result

    def _signal_condition(self, name: str) -> threading.Condition:
        """Get-or-create the condition associated with a signal name.

        MUST be called from inside `_call_state` so the dict access is
        serialised on the state thread.
        """
        cond = self._signal_conditions.get(name)
        if cond is None:
            cond = threading.Condition()
            self._signal_conditions[name] = cond
        return cond

    def _queue_condition(self, name: str) -> threading.Condition:
        """Get-or-create the condition associated with a queue name.

        MUST be called from inside `_call_state`.
        """
        cond = self._queue_conditions.get(name)
        if cond is None:
            cond = threading.Condition()
            self._queue_conditions[name] = cond
        return cond

    # ============ Signal Operations ============

    def signal(self, name: str, data: Any = None) -> None:
        """Publish a signal and wake any wait_signal() waiter."""
        payload = {
            'data': data,
            'timestamp': time.time(),
            'thread_id': threading.get_ident()
        }

        def publish() -> _StatePayload:
            self._signals[name] = payload
            cond = self._signal_condition(name)
            return _StatePayload(None, [cond])

        self._call_state(publish)

    def signal_if_present(
        self,
        guard_name: str,
        name: str,
        data: Any = None,
    ) -> bool:
        """Publish a response only while its waiter guard still exists."""
        payload = {
            'data': data,
            'timestamp': time.time(),
            'thread_id': threading.get_ident(),
        }

        def publish() -> _StatePayload:
            if guard_name not in self._signals:
                return _StatePayload(False, [])
            self._signals.pop(guard_name, None)
            self._signals[name] = payload
            cond = self._signal_condition(name)
            return _StatePayload(True, [cond])

        return bool(self._call_state(publish))

    def has_signal(self, name: str) -> bool:
        return bool(self._call_state(self._signals.__contains__, name))

    def has_event_snapshot(self, event_name: str) -> bool:
        """Deprecated compatibility shim for legacy snapshot checks."""
        return False

    def get_event_snapshot(self, event_name: str, default: Any = None) -> Any:
        """Compatibility shim retained: snapshot mode is no longer used."""
        return default

    def clear_event_snapshot(self, event_name: str) -> None:
        """Compatibility shim retained: snapshot mode is no longer used."""
        return

    def get_signal(self, name: str, default: Any = None) -> Any:
        signal = self._call_state(self._signals.get, name)
        return signal['data'] if signal else default

    def wait_signal(self, name: str, timeout: Optional[float] = None) -> Any:
        """Block until `name` is published (or timeout). Condition-driven."""
        missing = object()

        def try_take() -> Any:
            signal = self._signals.get(name)
            if signal is not None:
                return signal['data']
            # Ensure the condition exists so a later signaller wakes us.
            self._signal_condition(name)
            return missing

        result = self._call_state(try_take)
        if result is not missing:
            return result

        # Fetch the condition (may be freshly created above).
        cond = self._call_state(self._signal_condition, name)

        deadline = None if timeout is None else time.monotonic() + timeout
        with cond:
            while True:
                # Re-check state under the condition lock; the signaller
                # notifies AFTER writing to _signals, so a missed wakeup
                # here means the write is guaranteed visible on next check.
                result = self._call_state(self._signals.get, name)
                if result is not None:
                    return result['data']
                if deadline is None:
                    cond.wait()
                else:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return None
                    cond.wait(timeout=remaining)

    def clear_signal(self, name: str) -> bool:
        def clear() -> _StatePayload:
            removed = name in self._signals
            self._signals.pop(name, None)
            self._signals.pop(f"{name}.waiting", None)
            cond = self._signal_condition(name)
            waiting_cond = self._signal_condition(f"{name}.waiting")
            return _StatePayload(removed, [cond, waiting_cond])

        return bool(self._call_state(clear))

    def clear_all_signals(self) -> None:
        def clear_all() -> _StatePayload:
            names = list(self._signals.keys())
            self._signals.clear()
            conds = [self._signal_condition(n) for n in names]
            return _StatePayload(None, conds)

        self._call_state(clear_all)

    # ============ Thread State Operations ============

    def set_thread_state(self, thread_name: str, state: str, **kwargs) -> None:
        thread_state = {
            'state': state,
            'timestamp': time.time(),
            'thread_id': threading.get_ident(),
            **kwargs
        }

        def publish() -> _StatePayload:
            self._thread_states[thread_name] = thread_state
            return _StatePayload(None, [self._thread_state_condition])

        self._call_state(publish)

    def get_thread_state(self, thread_name: str) -> Optional[Dict[str, Any]]:
        state = self._call_state(self._thread_states.get, thread_name)
        return dict(state) if state is not None else None

    def wait_thread_state(self, thread_name: str, expected_state: str,
                         timeout: Optional[float] = None) -> bool:
        """Block until the named thread reports `expected_state` (or timeout)."""
        def matches() -> bool:
            state_data = self._thread_states.get(thread_name)
            return bool(state_data and state_data.get('state') == expected_state)

        if self._call_state(matches):
            return True

        cond = self._thread_state_condition
        deadline = None if timeout is None else time.monotonic() + timeout
        with cond:
            while True:
                if self._call_state(matches):
                    return True
                if deadline is None:
                    cond.wait()
                else:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return False
                    cond.wait(timeout=remaining)

    def list_threads(self) -> List[str]:
        return self._call_state(lambda: list(self._thread_states.keys()))

    # ============ Message Queue Operations ============

    def send_message(self, queue_name: str, message: Any) -> None:
        envelope = {
            'message': message,
            'timestamp': time.time(),
            'sender_thread_id': threading.get_ident()
        }

        def send() -> _StatePayload:
            self._queues.setdefault(queue_name, deque()).append(envelope)
            cond = self._queue_condition(queue_name)
            return _StatePayload(None, [cond])

        self._call_state(send)

    def receive_message(self, queue_name: str, block: bool = False,
                       timeout: Optional[float] = None) -> Any:
        """Take one message from the named queue.

        In blocking mode this waits on the queue's condition instead of
        sleep-polling, so an idle SerializedWorkerThread consumes no CPU.
        """
        missing = object()

        def receive() -> Any:
            q = self._queues.get(queue_name)
            if not q:
                # Make sure the condition exists so a future send wakes us.
                self._queue_condition(queue_name)
                return missing
            item = q.popleft()
            return item['message']

        result = self._call_state(receive)
        if not block:
            return None if result is missing else result
        if result is not missing:
            return result

        cond = self._call_state(self._queue_condition, queue_name)

        deadline = None if timeout is None else time.monotonic() + timeout
        with cond:
            while True:
                result = self._call_state(receive)
                if result is not missing:
                    return result
                if deadline is None:
                    cond.wait()
                else:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return None
                    cond.wait(timeout=remaining)

    def queue_size(self, queue_name: str) -> int:
        return int(self._call_state(
            lambda: len(self._queues.get(queue_name, ()))
        ))

    def clear_queue(self, queue_name: str) -> None:
        def clear() -> _StatePayload:
            self._queues.pop(queue_name, None)
            cond = self._queue_condition(queue_name)
            return _StatePayload(None, [cond])

        self._call_state(clear)

    # ============ Event Handler Operations (delegated) ============

    def register_event_handler(
        self,
        event_name: str,
        handler: Callable,
        priority: int = 100
    ) -> None:
        self._event_registry.register_event_handler(event_name, handler, priority)

    def unregister_event_handler(
        self,
        event_name: str,
        handler: Callable
    ) -> bool:
        return self._event_registry.unregister_event_handler(event_name, handler)

    def trigger_event(
        self,
        event_name: str,
        event_data: Any = None,
        async_mode: bool = False
    ) -> bool:
        return self._event_registry.trigger_event(event_name, event_data, async_mode)

    def list_event_handlers(self, event_name: Optional[str] = None) -> Dict:
        return self._event_registry.list_event_handlers(event_name)

    def clear_event_handlers(self, event_name: Optional[str] = None) -> None:
        self._event_registry.clear_event_handlers(event_name)

    # ============ Utility Operations ============

    def reset(self) -> None:
        """Reset all data (for testing/cleanup)."""
        def reset_state() -> _StatePayload:
            signal_conds = [self._signal_condition(n) for n in self._signals]
            queue_conds = [self._queue_condition(n) for n in self._queues]
            self._signals.clear()
            self._thread_states.clear()
            self._queues.clear()
            self._event_handlers.clear()
            self._shutdown_handlers.clear()
            self._shutdown_executed = False
            self._restart_requested = False
            return _StatePayload(
                None,
                signal_conds + queue_conds + [self._thread_state_condition],
            )

        self._call_state(reset_state)

    def stats(self) -> Dict[str, Any]:
        def snapshot() -> Dict[str, Any]:
            return {
                'signals_count': len(self._signals),
                'threads_count': len(self._thread_states),
                'queues_count': len(self._queues),
                'events_count': 0,
                'event_handlers_count': len(self._event_handlers),
                'active_threads': list(self._thread_states.keys()),
                'active_signals': list(self._signals.keys()),
                'active_queues': {
                    name: len(queue) for name, queue in self._queues.items()
                },
                'active_event_handlers': {
                    name: len(handlers)
                    for name, handlers in self._event_handlers.items()
                },
            }

        return self._call_state(snapshot)

    def __repr__(self) -> str:
        stats = self.stats()
        return (f"ThreadBus(signals={stats['signals_count']}, "
                f"threads={stats['threads_count']}, "
                f"queues={stats['queues_count']})")

    # ============ Global Shutdown Operations (delegated to ShutdownStack) ============

    def register_shutdown_handler(
        self,
        handler: Callable,
        priority: int = 100,
        name: Optional[str] = None
    ) -> str:
        return self._shutdown_stack.register_shutdown_handler(handler, priority, name)

    def unregister_shutdown_handler(self, name: str) -> bool:
        return self._shutdown_stack.unregister_shutdown_handler(name)

    def execute_shutdown(self, reason: str = "User requested shutdown") -> None:
        self._shutdown_stack.execute_shutdown(reason)

    def request_shutdown(
        self,
        reason: str = "User requested shutdown",
        execute_handlers: bool = True
    ) -> None:
        self._shutdown_stack.request_shutdown(reason, execute_handlers)

    def request_restart(
        self,
        reason: str = "User requested restart",
        execute_handlers: bool = True
    ) -> None:
        self._shutdown_stack.request_restart(reason, execute_handlers)

    def is_shutdown_requested(self) -> bool:
        return self._shutdown_stack.is_shutdown_requested()

    def is_restart_requested(self) -> bool:
        return self._shutdown_stack.is_restart_requested()

    def get_shutdown_reason(self) -> Optional[str]:
        return self._shutdown_stack.get_shutdown_reason()

    def clear_shutdown(self) -> None:
        self._shutdown_stack.clear_shutdown()

    def get_shutdown_handlers(self) -> List[tuple]:
        return self._shutdown_stack.get_shutdown_handlers()

    # ============ Application Busy State ============

    def set_busy(self, busy: bool, reason: str = "") -> None:
        self.set_thread_state('app', 'busy' if busy else 'idle', reason=reason)

    def is_busy(self) -> bool:
        state = self.get_thread_state('app')
        return state is not None and state.get('state') == 'busy'

    def get_busy_reason(self) -> Optional[str]:
        state = self.get_thread_state('app')
        if state and state.get('state') == 'busy':
            return state.get('reason', '')
        return None


# Global instance (the ONE singleton consumed by ~50 files)
THREAD_BUS = ThreadBus()


def main():
    """Test ThreadBus."""

    ColorPrint.blue("=== Testing ThreadBus ===")

    ColorPrint.blue("\n1. Testing Signals")
    THREAD_BUS.signal('test_signal', {'data': 'hello'})
    ColorPrint.green(f"Has signal: {THREAD_BUS.has_signal('test_signal')}")
    ColorPrint.green(f"Signal data: {THREAD_BUS.get_signal('test_signal')}")

    ColorPrint.blue("\n2. Testing Thread States")
    THREAD_BUS.set_thread_state('MainThread', 'running', status='ok')
    state = THREAD_BUS.get_thread_state('MainThread')
    ColorPrint.green(f"Thread state: {state}")

    ColorPrint.blue("\n3. Testing Message Queue")
    THREAD_BUS.send_message('test_queue', {'task': 'process'})
    THREAD_BUS.send_message('test_queue', {'task': 'cleanup'})
    ColorPrint.green(f"Queue size: {THREAD_BUS.queue_size('test_queue')}")
    msg1 = THREAD_BUS.receive_message('test_queue')
    ColorPrint.green(f"Received: {msg1}")
    msg2 = THREAD_BUS.receive_message('test_queue')
    ColorPrint.green(f"Received: {msg2}")

    ColorPrint.blue("\n4. Bus Statistics")
    stats = THREAD_BUS.stats()
    ColorPrint.green(f"Stats: {stats}")

    ColorPrint.blue(f"\n{THREAD_BUS}")


if __name__ == "__main__":
    main()


__all__ = [
    'THREAD_BUS',
    'ThreadBus',
    'ShutdownStack',
    'EventHandlerRegistry',
]
