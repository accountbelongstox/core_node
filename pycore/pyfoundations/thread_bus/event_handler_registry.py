#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Handler Registry - extracted from ThreadBus

Priority-ordered event handler registry with synchronous and asynchronous
dispatch. Handlers are stored as (priority, handler) tuples per event name and
executed in priority order (lower number = higher priority).

This class is a stateless strategy operating on the owning ThreadBus's
copy-on-write event-handler snapshots.

TODO (reuse batch): consolidate with the overlapping
pycore/pyfoundations/event_bus.py (EventBus) once the two event systems are
reconciled.
"""

import threading
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class EventDispatchThread(threading.Thread):
    """Dispatch one event after receiving its payload from THREAD_BUS."""

    def __init__(self, bus, queue_name: str, event_name: str) -> None:
        super().__init__(name=f"EventHandler-{event_name}", daemon=True)
        self._bus = bus
        self._queue_name = queue_name
        self._event_name = event_name

    def run(self) -> None:
        payload = self._bus.receive_message(self._queue_name)
        if not isinstance(payload, dict):
            return

        handlers = payload.get('handlers', ())
        event_data = payload.get('event_data')
        EventHandlerRegistry.execute_handlers(
            self._event_name,
            event_data,
            handlers,
        )
        self._bus.clear_queue(self._queue_name)


class EventHandlerRegistry:
    """
    Priority-ordered event handler registry with sync/async dispatch.

    Owns no state: the event-handler snapshots live on the composing ThreadBus.
    """

    def __init__(self, bus):
        """
        Args:
            bus: the owning ThreadBus instance.
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
        handlers = list(self._bus._event_handlers.get(event_name, ()))
        handlers.append((priority, handler))
        handlers.sort(key=lambda item: item[0])
        self._bus._event_handlers = {
            **self._bus._event_handlers,
            event_name: handlers,
        }

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
        handlers = self._bus._event_handlers.get(event_name)
        if handlers is None:
            return False

        updated_handlers = [
            (priority, registered_handler)
            for priority, registered_handler in handlers
            if registered_handler != handler
        ]
        self._bus._event_handlers = {
            **self._bus._event_handlers,
            event_name: updated_handlers,
        }
        return len(updated_handlers) < len(handlers)

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
        handlers = tuple(self._bus._event_handlers.get(event_name, ()))
        if not handlers:
            return True

        if async_mode:
            queue_name = (
                f"thread_bus.event.{event_name}."
                f"{threading.get_ident()}.{time.time_ns()}"
            )
            self._bus.send_message(queue_name, {
                'event_data': event_data,
                'handlers': handlers,
            })
            EventDispatchThread(self._bus, queue_name, event_name).start()
        else:
            self.execute_handlers(event_name, event_data, handlers)

        return True

    @staticmethod
    def execute_handlers(
        event_name: str,
        event_data: Any,
        handlers: tuple,
    ) -> None:
        """Execute a stable handler snapshot in priority order."""
        for _priority, handler in handlers:
            try:
                handler(event_data)
            except Exception as exc:
                ColorPrint.red(
                    f"[ThreadBus] Event handler '{event_name}' failed: {exc}"
                )

    def list_event_handlers(self, event_name: Optional[str] = None) -> Dict:
        """
        List registered event handlers

        Args:
            event_name: Optional event name to filter

        Returns:
            Dictionary of event handlers
        """
        handler_snapshots = self._bus._event_handlers
        if event_name:
            handlers = handler_snapshots.get(event_name, [])
            return {
                event_name: [
                    {
                        'priority': priority,
                        'handler': handler.__name__
                        if hasattr(handler, '__name__') else str(handler)
                    }
                    for priority, handler in handlers
                ]
            }

        return {
            name: [
                {
                    'priority': priority,
                    'handler': handler.__name__
                    if hasattr(handler, '__name__') else str(handler)
                }
                for priority, handler in handlers
            ]
            for name, handlers in handler_snapshots.items()
        }

    def clear_event_handlers(self, event_name: Optional[str] = None) -> None:
        """
        Clear event handlers

        Args:
            event_name: Optional event name to clear (if None, clear all)
        """
        if event_name:
            self._bus._event_handlers = {
                name: handlers
                for name, handlers in self._bus._event_handlers.items()
                if name != event_name
            }
            return
        self._bus._event_handlers = {}
