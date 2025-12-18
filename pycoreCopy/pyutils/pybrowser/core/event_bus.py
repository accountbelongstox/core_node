#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Bus

Provides event-driven communication system
"""

import asyncio
from typing import Dict, List, Callable, Any
from pycore.pyfoundations.color_print import ColorPrint


class EventBus:
    """Event bus for event-driven communication"""

    def __init__(self):
        self.events: Dict[str, List[Callable]] = {}
        self.max_listeners = 100

    def on(self, event: str, callback: Callable):
        """
        Register event listener

        Args:
            event: Event name
            callback: Callback function
        """
        if event not in self.events:
            self.events[event] = []

        listeners = self.events[event]
        if len(listeners) >= self.max_listeners:
            ColorPrint.warn(f"Event {event} has reached maximum listeners ({self.max_listeners})")
            return

        listeners.append(callback)
        ColorPrint.debug(f"Listener added for event: {event}")

    def off(self, event: str, callback: Callable):
        """
        Remove event listener

        Args:
            event: Event name
            callback: Callback function to remove
        """
        if event not in self.events:
            return

        listeners = self.events[event]
        if callback in listeners:
            listeners.remove(callback)
            ColorPrint.debug(f"Listener removed for event: {event}")

    def emit(self, event: str, data: Any = None):
        """
        Emit event synchronously

        Args:
            event: Event name
            data: Event data
        """
        if event not in self.events:
            return

        listeners = self.events[event]
        ColorPrint.debug(f"Emitting event: {event} to {len(listeners)} listeners")

        for callback in listeners:
            callback(data)

    async def emit_async(self, event: str, data: Any = None):
        """
        Emit event asynchronously

        Args:
            event: Event name
            data: Event data
        """
        if event not in self.events:
            return

        listeners = self.events[event]
        ColorPrint.debug(f"Emitting async event: {event} to {len(listeners)} listeners")

        tasks = []
        for callback in listeners:
            if asyncio.iscoroutinefunction(callback):
                tasks.append(callback(data))
            else:
                callback(data)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def once(self, event: str, callback: Callable):
        """
        Register one-time event listener

        Args:
            event: Event name
            callback: Callback function
        """
        def once_callback(data):
            callback(data)
            self.off(event, once_callback)

        self.on(event, once_callback)

    def remove_all_listeners(self, event: str = None):
        """
        Remove all listeners for an event or all events

        Args:
            event: Event name (None to remove all)
        """
        if event:
            if event in self.events:
                del self.events[event]
                ColorPrint.debug(f"All listeners removed for event: {event}")
        else:
            self.events.clear()
            ColorPrint.debug("All listeners removed")

    def get_event_names(self) -> List[str]:
        """
        Get all registered event names

        Returns:
            List of event names
        """
        return list(self.events.keys())

    def get_listener_count(self, event: str) -> int:
        """
        Get listener count for an event

        Args:
            event: Event name

        Returns:
            Number of listeners
        """
        return len(self.events.get(event, []))

    def get_info(self) -> Dict[str, Any]:
        """
        Get event bus information

        Returns:
            Dictionary with event bus info
        """
        event_info = {event: len(listeners) for event, listeners in self.events.items()}

        return {
            'total_events': len(self.events),
            'max_listeners': self.max_listeners,
            'events': event_info
        }
