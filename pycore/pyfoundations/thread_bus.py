#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Thread Communication Bus

Thread-safe global message bus for inter-thread communication.
Follows project multi-threading standards:
- No direct parameter passing between threads
- All communication via global queue/signals
- Thread-safe operations with RLock

Usage:
    from pycore import THREAD_BUS

    # Thread A - Send signal
    THREAD_BUS.signal('startup_complete', {'status': 'ready'})

    # Thread B - Wait for signal
    data = THREAD_BUS.wait_signal('startup_complete', timeout=5.0)

    # Thread C - Check signal
    if THREAD_BUS.has_signal('startup_complete'):
        data = THREAD_BUS.get_signal('startup_complete')
"""

import time
import threading
from typing import Any, Dict, List, Optional
from collections import deque


class ThreadBus:
    """
    Global thread-safe communication bus for inter-thread messaging

    Features:
    - Signal queue for event-driven communication
    - Thread state tracking
    - Message queue for work distribution
    - Blocking wait with timeout support
    """

    def __init__(self):
        """Initialize thread bus with thread safety"""
        self._lock = threading.RLock()

        # Signal store: {signal_name: signal_data}
        self._signals: Dict[str, Any] = {}

        # Thread state: {thread_name: state_data}
        self._thread_states: Dict[str, Dict[str, Any]] = {}

        # Message queues: {queue_name: deque([message, ...])}
        self._queues: Dict[str, deque] = {}

        # Events for blocking wait: {signal_name: threading.Event}
        self._events: Dict[str, threading.Event] = {}

    # ============ Signal Operations ============

    def signal(self, name: str, data: Any = None) -> None:
        """
        Send a signal with optional data

        Args:
            name: Signal name
            data: Signal data (any type)

        Example:
            THREAD_BUS.signal('tk_window_ready', {'window_id': 123})
        """
        with self._lock:
            self._signals[name] = {
                'data': data,
                'timestamp': time.time(),
                'thread_id': threading.get_ident()
            }
            # Set event for blocking waiters
            if name in self._events:
                self._events[name].set()

    def has_signal(self, name: str) -> bool:
        """
        Check if signal exists

        Args:
            name: Signal name

        Returns:
            True if signal exists
        """
        with self._lock:
            return name in self._signals

    def get_signal(self, name: str, default: Any = None) -> Any:
        """
        Get signal data (non-blocking)

        Args:
            name: Signal name
            default: Default value if signal not found

        Returns:
            Signal data or default
        """
        with self._lock:
            signal = self._signals.get(name)
            return signal['data'] if signal else default

    def wait_signal(self, name: str, timeout: Optional[float] = None) -> Any:
        """
        Wait for signal (blocking with timeout)

        Args:
            name: Signal name
            timeout: Timeout in seconds (None = wait forever)

        Returns:
            Signal data, or None if timeout

        Example:
            # Wait up to 5 seconds for startup
            data = THREAD_BUS.wait_signal('startup_complete', timeout=5.0)
            if data:
                print("Startup complete:", data)
        """
        # Check if signal already exists
        with self._lock:
            if name in self._signals:
                return self._signals[name]['data']

            # Create event if not exists
            if name not in self._events:
                self._events[name] = threading.Event()
            event = self._events[name]

        # Wait for signal
        if event.wait(timeout):
            with self._lock:
                signal = self._signals.get(name)
                return signal['data'] if signal else None
        return None

    def clear_signal(self, name: str) -> bool:
        """
        Clear a signal

        Args:
            name: Signal name

        Returns:
            True if signal was removed
        """
        with self._lock:
            if name in self._signals:
                del self._signals[name]
                if name in self._events:
                    self._events[name].clear()
                return True
            return False

    def clear_all_signals(self) -> None:
        """Clear all signals"""
        with self._lock:
            self._signals.clear()
            for event in self._events.values():
                event.clear()

    # ============ Thread State Operations ============

    def set_thread_state(self, thread_name: str, state: str, **kwargs) -> None:
        """
        Set thread state with metadata

        Args:
            thread_name: Thread identifier
            state: State string (e.g., 'starting', 'running', 'stopping')
            **kwargs: Additional state data

        Example:
            THREAD_BUS.set_thread_state('TkinterStartup', 'running',
                                       window_id=123, visible=True)
        """
        with self._lock:
            self._thread_states[thread_name] = {
                'state': state,
                'timestamp': time.time(),
                'thread_id': threading.get_ident(),
                **kwargs
            }

    def get_thread_state(self, thread_name: str) -> Optional[Dict[str, Any]]:
        """
        Get thread state

        Args:
            thread_name: Thread identifier

        Returns:
            Thread state dict or None
        """
        with self._lock:
            return self._thread_states.get(thread_name)

    def wait_thread_state(self, thread_name: str, expected_state: str,
                         timeout: Optional[float] = None) -> bool:
        """
        Wait for thread to reach expected state

        Args:
            thread_name: Thread identifier
            expected_state: State to wait for
            timeout: Timeout in seconds

        Returns:
            True if state reached, False if timeout

        Example:
            # Wait for Tkinter to be running
            if THREAD_BUS.wait_thread_state('TkinterStartup', 'running', timeout=3.0):
                print("Tkinter ready")
        """
        start_time = time.time()
        while True:
            with self._lock:
                state_data = self._thread_states.get(thread_name)
                if state_data and state_data['state'] == expected_state:
                    return True

            if timeout and (time.time() - start_time) >= timeout:
                return False

            time.sleep(0.01)  # Short sleep to avoid busy-wait

    def list_threads(self) -> List[str]:
        """
        Get list of all tracked threads

        Returns:
            List of thread names
        """
        with self._lock:
            return list(self._thread_states.keys())

    # ============ Message Queue Operations ============

    def send_message(self, queue_name: str, message: Any) -> None:
        """
        Send message to queue

        Args:
            queue_name: Queue identifier
            message: Message data (any type)

        Example:
            THREAD_BUS.send_message('work_queue', {
                'action': 'process',
                'data': {'id': 123}
            })
        """
        with self._lock:
            if queue_name not in self._queues:
                self._queues[queue_name] = deque()
            self._queues[queue_name].append({
                'message': message,
                'timestamp': time.time(),
                'sender_thread_id': threading.get_ident()
            })

    def receive_message(self, queue_name: str, block: bool = False,
                       timeout: Optional[float] = None) -> Any:
        """
        Receive message from queue

        Args:
            queue_name: Queue identifier
            block: If True, wait for message
            timeout: Timeout for blocking (None = wait forever)

        Returns:
            Message data or None

        Example:
            # Non-blocking
            msg = THREAD_BUS.receive_message('work_queue')

            # Blocking with timeout
            msg = THREAD_BUS.receive_message('work_queue', block=True, timeout=1.0)
        """
        if not block:
            with self._lock:
                queue = self._queues.get(queue_name)
                if queue and len(queue) > 0:
                    item = queue.popleft()
                    return item['message']
                return None

        # Blocking mode
        start_time = time.time()
        while True:
            with self._lock:
                queue = self._queues.get(queue_name)
                if queue and len(queue) > 0:
                    item = queue.popleft()
                    return item['message']

            if timeout and (time.time() - start_time) >= timeout:
                return None

            time.sleep(0.01)

    def queue_size(self, queue_name: str) -> int:
        """
        Get queue size

        Args:
            queue_name: Queue identifier

        Returns:
            Number of messages in queue
        """
        with self._lock:
            queue = self._queues.get(queue_name)
            return len(queue) if queue else 0

    def clear_queue(self, queue_name: str) -> None:
        """
        Clear all messages in queue

        Args:
            queue_name: Queue identifier
        """
        with self._lock:
            if queue_name in self._queues:
                self._queues[queue_name].clear()

    # ============ Utility Operations ============

    def reset(self) -> None:
        """Reset all data (for testing/cleanup)"""
        with self._lock:
            self._signals.clear()
            self._thread_states.clear()
            self._queues.clear()
            for event in self._events.values():
                event.clear()
            self._events.clear()

    def stats(self) -> Dict[str, Any]:
        """
        Get bus statistics

        Returns:
            Statistics dictionary
        """
        with self._lock:
            return {
                'signals_count': len(self._signals),
                'threads_count': len(self._thread_states),
                'queues_count': len(self._queues),
                'events_count': len(self._events),
                'active_threads': list(self._thread_states.keys()),
                'active_signals': list(self._signals.keys()),
                'active_queues': {name: len(q) for name, q in self._queues.items()}
            }

    def __repr__(self) -> str:
        """String representation"""
        stats = self.stats()
        return (f"ThreadBus(signals={stats['signals_count']}, "
                f"threads={stats['threads_count']}, "
                f"queues={stats['queues_count']})")


# Global instance
THREAD_BUS = ThreadBus()


def main():
    """Test ThreadBus"""
    from pycore.pyfoundations.color_print import ColorPrint

    ColorPrint.blue("=== Testing ThreadBus ===")

    # Test signals
    ColorPrint.blue("\n1. Testing Signals")
    THREAD_BUS.signal('test_signal', {'data': 'hello'})
    ColorPrint.green(f"Has signal: {THREAD_BUS.has_signal('test_signal')}")
    ColorPrint.green(f"Signal data: {THREAD_BUS.get_signal('test_signal')}")

    # Test thread states
    ColorPrint.blue("\n2. Testing Thread States")
    THREAD_BUS.set_thread_state('MainThread', 'running', status='ok')
    state = THREAD_BUS.get_thread_state('MainThread')
    ColorPrint.green(f"Thread state: {state}")

    # Test message queue
    ColorPrint.blue("\n3. Testing Message Queue")
    THREAD_BUS.send_message('test_queue', {'task': 'process'})
    THREAD_BUS.send_message('test_queue', {'task': 'cleanup'})
    ColorPrint.green(f"Queue size: {THREAD_BUS.queue_size('test_queue')}")
    msg1 = THREAD_BUS.receive_message('test_queue')
    ColorPrint.green(f"Received: {msg1}")
    msg2 = THREAD_BUS.receive_message('test_queue')
    ColorPrint.green(f"Received: {msg2}")

    # Test stats
    ColorPrint.blue("\n4. Bus Statistics")
    stats = THREAD_BUS.stats()
    ColorPrint.green(f"Stats: {stats}")

    ColorPrint.blue(f"\n{THREAD_BUS}")


if __name__ == "__main__":
    main()
