#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Handler Registry - extracted from ThreadBus

Priority-ordered event handler registry with synchronous and asynchronous
dispatch. Handlers are stored as (priority, handler) tuples per event name and
executed in priority order (lower number = higher priority).

This class is a stateless strategy operating on the owning ThreadBus's shared
RLock and the event-handler dict. The ThreadBus instance owns the ONE RLock
plus all internal dicts; EventHandlerRegistry only references them via the bus
so thread-safety is never split across separate locks.

TODO (reuse batch): consolidate with the overlapping
pycore/pyfoundations/event_bus.py (EventBus) once the two event systems are
reconciled.
"""

import threading
from typing import Any, Callable, Dict, List, Optional


class EventHandlerRegistry:
    """
    Priority-ordered event handler registry with sync/async dispatch.

    Owns no state: the event-handler dict (bus._event_handlers) lives on the
    composing ThreadBus instance and is guarded by the bus's single shared RLock.
    """

    def __init__(self, bus):
        """
        Args:
            bus: the owning ThreadBus instance. Provides the shared RLock
                 (bus._lock) and the event-handler store (bus._event_handlers).
        """
        self._bus = bus

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
        with self._bus._lock:
            if event_name not in self._bus._event_handlers:
                self._bus._event_handlers[event_name] = []

            # Add handler with priority
            self._bus._event_handlers[event_name].append((priority, handler))

            # Sort by priority (lower number = higher priority)
            self._bus._event_handlers[event_name].sort(key=lambda x: x[0])

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
        with self._bus._lock:
            if event_name not in self._bus._event_handlers:
                return False

            handlers = self._bus._event_handlers[event_name]
            original_len = len(handlers)

            # Remove handler
            self._bus._event_handlers[event_name] = [
                (p, h) for p, h in handlers if h != handler
            ]

            return len(self._bus._event_handlers[event_name]) < original_len

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
        with self._bus._lock:
            handlers = self._bus._event_handlers.get(event_name, [])
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
        with self._bus._lock:
            if event_name:
                handlers = self._bus._event_handlers.get(event_name, [])
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
                for name, handlers in self._bus._event_handlers.items()
            }

    def clear_event_handlers(self, event_name: Optional[str] = None) -> None:
        """
        Clear event handlers

        Args:
            event_name: Optional event name to clear (if None, clear all)
        """
        with self._bus._lock:
            if event_name:
                self._bus._event_handlers.pop(event_name, None)
            else:
                self._bus._event_handlers.clear()
