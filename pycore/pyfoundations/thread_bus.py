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
from typing import Any, Dict, List, Optional, Callable
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

        # Event handlers: {event_name: [(priority, handler_func), ...]}
        # Handlers are called in priority order (lower number = higher priority)
        self._event_handlers: Dict[str, List[tuple]] = {}

        # Shutdown handlers: [(priority, name, handler_func), ...]
        # Stack-based shutdown: lower priority executes first (子进程先关)
        # Example: RPC(priority=50) -> Heartbeat(priority=100)
        self._shutdown_handlers: List[tuple] = []
        self._shutdown_executed: bool = False
        self._restart_requested: bool = False  # Flag for restart after shutdown

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

    # ============ Event Handler Operations ============

    def register_event_handler(
        self,
        event_name: str,
        handler: Callable,
        priority: int = 100
    ) -> None:
        """
        Register event handler for global events

        Args:
            event_name: Event name (e.g., 'app.close', 'app.restart', 'window.minimize')
            handler: Handler function that receives event data
            priority: Execution priority (lower = higher priority, default: 100)

        Example:
            def on_close(event_data):
                print("Cleaning up before close...")
                stopserver()

            THREAD_BUS.register_event_handler('app.close', on_close, priority=10)
        """
        with self._lock:
            if event_name not in self._event_handlers:
                self._event_handlers[event_name] = []

            # Add handler with priority
            self._event_handlers[event_name].append((priority, handler))

            # Sort by priority (lower number = higher priority)
            self._event_handlers[event_name].sort(key=lambda x: x[0])

    def unregister_event_handler(
        self,
        event_name: str,
        handler: Callable
    ) -> bool:
        """
        Unregister event handler

        Args:
            event_name: Event name
            handler: Handler function to remove

        Returns:
            True if handler was removed
        """
        with self._lock:
            if event_name not in self._event_handlers:
                return False

            handlers = self._event_handlers[event_name]
            original_len = len(handlers)

            # Remove handler
            self._event_handlers[event_name] = [
                (p, h) for p, h in handlers if h != handler
            ]

            return len(self._event_handlers[event_name]) < original_len

    def trigger_event(
        self,
        event_name: str,
        event_data: Any = None,
        async_mode: bool = False
    ) -> bool:
        """
        Trigger event and execute all registered handlers

        Args:
            event_name: Event name
            event_data: Data to pass to handlers
            async_mode: If True, execute handlers in separate thread

        Returns:
            True if event was triggered successfully

        Example:
            # Trigger app close event
            THREAD_BUS.trigger_event('app.close', {'reason': 'user_request'})

            # Trigger window maximize event
            THREAD_BUS.trigger_event('window.maximize')
        """
        with self._lock:
            handlers = self._event_handlers.get(event_name, [])
            if not handlers:
                return True  # No handlers, event succeeds

            # Copy handlers list
            handlers_copy = list(handlers)

        # Execute handlers
        def _execute_handlers():
            for priority, handler in handlers_copy:
                try:
                    handler(event_data)
                except Exception as e:
                    # Log error but continue with other handlers
                    print(f"Error in event handler for '{event_name}': {e}")

        if async_mode:
            # Execute in separate thread
            thread = threading.Thread(
                target=_execute_handlers,
                name=f"EventHandler-{event_name}",
                daemon=True
            )
            thread.start()
        else:
            # Execute synchronously
            _execute_handlers()

        return True

    def list_event_handlers(self, event_name: Optional[str] = None) -> Dict:
        """
        List registered event handlers

        Args:
            event_name: Optional event name to filter

        Returns:
            Dictionary of event handlers
        """
        with self._lock:
            if event_name:
                handlers = self._event_handlers.get(event_name, [])
                return {
                    event_name: [
                        {
                            'priority': p,
                            'handler': h.__name__ if hasattr(h, '__name__') else str(h)
                        }
                        for p, h in handlers
                    ]
                }

            return {
                name: [
                    {
                        'priority': p,
                        'handler': h.__name__ if hasattr(h, '__name__') else str(h)
                    }
                    for p, h in handlers
                ]
                for name, handlers in self._event_handlers.items()
            }

    def clear_event_handlers(self, event_name: Optional[str] = None) -> None:
        """
        Clear event handlers

        Args:
            event_name: Optional event name to clear (if None, clear all)
        """
        with self._lock:
            if event_name:
                self._event_handlers.pop(event_name, None)
            else:
                self._event_handlers.clear()

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
            self._event_handlers.clear()

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
                'event_handlers_count': len(self._event_handlers),
                'active_threads': list(self._thread_states.keys()),
                'active_signals': list(self._signals.keys()),
                'active_queues': {name: len(q) for name, q in self._queues.items()},
                'active_event_handlers': {
                    name: len(handlers) for name, handlers in self._event_handlers.items()
                }
            }

    def __repr__(self) -> str:
        """String representation"""
        stats = self.stats()
        return (f"ThreadBus(signals={stats['signals_count']}, "
                f"threads={stats['threads_count']}, "
                f"queues={stats['queues_count']})")

    # ============ Global Shutdown Operations (Queue/Stack System) ============

    def register_shutdown_handler(
        self,
        handler: Callable,
        priority: int = 100,
        name: Optional[str] = None
    ) -> str:
        """
        Register shutdown handler in the shutdown stack

        Shutdown handlers are executed in priority order (lower priority first).
        This creates a stack effect: child processes (lower priority) shut down
        before main process (higher priority).

        Args:
            handler: Shutdown handler function
            priority: Execution priority (lower = earlier shutdown)
                     Examples: RPC=50, Speech=60, Heartbeat=100
            name: Handler name (auto-generated if None)

        Returns:
            Handler name (for unregistration)

        Example:
            def cleanup_rpc():
                print("Closing RPC server...")
                rpc_server.stop()

            THREAD_BUS.register_shutdown_handler(
                cleanup_rpc,
                priority=50,
                name="rpc_cleanup"
            )
        """
        with self._lock:
            if name is None:
                name = f"handler_{len(self._shutdown_handlers)}"

            # Check if already registered
            existing = [h for h in self._shutdown_handlers if h[1] == name]
            if existing:
                # Replace existing handler
                self._shutdown_handlers = [h for h in self._shutdown_handlers if h[1] != name]

            # Add handler
            self._shutdown_handlers.append((priority, name, handler))

            # Sort by priority (lower priority executes first)
            self._shutdown_handlers.sort(key=lambda x: x[0])

            return name

    def unregister_shutdown_handler(self, name: str) -> bool:
        """
        Unregister shutdown handler

        Args:
            name: Handler name

        Returns:
            True if handler was removed
        """
        with self._lock:
            original_len = len(self._shutdown_handlers)
            self._shutdown_handlers = [
                h for h in self._shutdown_handlers if h[1] != name
            ]
            return len(self._shutdown_handlers) < original_len

    def execute_shutdown(self, reason: str = "User requested shutdown") -> None:
        """
        Execute all registered shutdown handlers in priority order

        This is the core of the shutdown stack system.
        Handlers are executed in order: lower priority first (子进程先关).

        Args:
            reason: Reason for shutdown

        Example:
            THREAD_BUS.execute_shutdown("Application closing")
            # Executes: RPC(50) -> Speech(60) -> Heartbeat(100)
        """
        with self._lock:
            if self._shutdown_executed:
                return

            handlers = list(self._shutdown_handlers)
            self._shutdown_executed = True

        if not handlers:
            return

        print(f"[ThreadBus] Executing shutdown stack: {reason}")
        print(f"[ThreadBus] Shutdown order: {[h[1] for h in handlers]}")

        for priority, name, handler in handlers:
            try:
                print(f"[ThreadBus] Executing shutdown handler: {name} (priority: {priority})")
                handler()
            except Exception as e:
                print(f"[ThreadBus] Error in shutdown handler '{name}': {e}")

        print(f"[ThreadBus] Shutdown stack execution completed")

    def request_shutdown(
        self,
        reason: str = "User requested shutdown",
        execute_handlers: bool = True
    ) -> None:
        """
        Request global application shutdown

        Sends a shutdown signal that can be monitored by all threads.
        Optionally executes all registered shutdown handlers.

        Args:
            reason: Reason for shutdown
            execute_handlers: If True, execute shutdown handlers immediately

        Example:
            # Request shutdown and execute handlers
            THREAD_BUS.request_shutdown("Replacing with new instance")

            # Or just signal (let threads handle it themselves)
            THREAD_BUS.request_shutdown("User exit", execute_handlers=False)
        """
        self.signal('global.shutdown.requested', {
            'reason': reason,
            'requester_thread_id': threading.get_ident()
        })

        if execute_handlers:
            self.execute_shutdown(reason)

    def request_restart(
        self,
        reason: str = "User requested restart",
        execute_handlers: bool = True
    ) -> None:
        """
        Request global application restart

        Sets restart flag and triggers shutdown sequence.
        After shutdown completes, the application should restart using os.execv().

        Args:
            reason: Reason for restart
            execute_handlers: If True, execute shutdown handlers immediately

        Example:
            # Request restart via API
            THREAD_BUS.request_restart("API restart request")

            # In main loop after shutdown:
            if THREAD_BUS.is_restart_requested():
                import os, sys
                os.execv(sys.executable, [sys.executable] + sys.argv)
        """
        with self._lock:
            self._restart_requested = True

        # Signal restart (in addition to shutdown)
        self.signal('global.restart.requested', {
            'reason': reason,
            'requester_thread_id': threading.get_ident()
        })

        # Request shutdown with restart flag set
        self.request_shutdown(reason, execute_handlers)

    def is_shutdown_requested(self) -> bool:
        """
        Check if global shutdown has been requested

        Returns:
            True if shutdown signal exists

        Example:
            if THREAD_BUS.is_shutdown_requested():
                print("Shutdown requested, cleaning up...")
                break
        """
        return self.has_signal('global.shutdown.requested')

    def is_restart_requested(self) -> bool:
        """
        Check if restart was requested (used after shutdown)

        Returns:
            True if restart flag is set

        Example:
            if THREAD_BUS.is_restart_requested():
                # Restart process
                os.execv(sys.executable, [sys.executable] + sys.argv)
        """
        with self._lock:
            return self._restart_requested

    def get_shutdown_reason(self) -> Optional[str]:
        """
        Get reason for shutdown request

        Returns:
            Shutdown reason string or None if no shutdown requested
        """
        data = self.get_signal('global.shutdown.requested')
        if data and isinstance(data, dict):
            return data.get('reason')
        return None

    def clear_shutdown(self) -> None:
        """
        Clear shutdown request signal and reset execution flag

        Use this after handling shutdown to reset state.
        """
        with self._lock:
            if 'global.shutdown.requested' in self._signals:
                del self._signals['global.shutdown.requested']
            if 'global.shutdown.requested' in self._events:
                self._events['global.shutdown.requested'].clear()
            self._shutdown_executed = False

    def get_shutdown_handlers(self) -> List[tuple]:
        """
        Get list of registered shutdown handlers

        Returns:
            List of (priority, name, handler) tuples sorted by priority
        """
        with self._lock:
            return list(self._shutdown_handlers)

    # ============ Application Busy State (for Singleton Shutdown Control) ============

    def set_busy(self, busy: bool, reason: str = "") -> None:
        """
        Set application busy state

        Any thread can call this to prevent shutdown when processing critical tasks.
        When busy=True, singleton detector will reject shutdown requests.

        Args:
            busy: True to mark as busy, False to clear
            reason: Reason for busy state (optional)

        Example:
            # Before critical operation
            THREAD_BUS.set_busy(True, "Processing database transaction")

            # After operation
            THREAD_BUS.set_busy(False)
        """
        self.set_thread_state('app', 'busy' if busy else 'idle', reason=reason)

    def is_busy(self) -> bool:
        """
        Check if application is busy

        Returns:
            True if any thread marked application as busy

        Example:
            if THREAD_BUS.is_busy():
                print("Cannot shutdown: Application is busy")
        """
        state = self.get_thread_state('app')
        return state is not None and state.get('state') == 'busy'

    def get_busy_reason(self) -> Optional[str]:
        """
        Get reason for busy state

        Returns:
            Busy reason string or None
        """
        state = self.get_thread_state('app')
        if state and state.get('state') == 'busy':
            return state.get('reason', '')
        return None


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
