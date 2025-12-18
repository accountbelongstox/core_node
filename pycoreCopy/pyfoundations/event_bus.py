"""
Event Bus for Cross-App Communication

This is a core pycore component that enables different apps to communicate
through events without tight coupling.
"""

from typing import Dict, Set, Callable, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import asyncio


@dataclass
class Event:
    """Event data structure"""
    type: str
    source: str  # App name that emitted the event
    timestamp: datetime
    data: Any
    metadata: Optional[Dict[str, Any]] = None


class EventBus:
    """
    Global Event Bus

    Enables communication between different apps (pyMatrix, screencast, etc.)
    without tight coupling.

    Usage:
        # Get singleton instance
        bus = EventBus.instance()

        # Subscribe to events
        bus.subscribe('device.connected', callback)

        # Emit events
        await bus.emit('device.connected', source='pyMatrix', data={...})

        # Unsubscribe
        bus.unsubscribe('device.connected', callback)

    Event Types:
        - device.connected - Device connected
        - device.disconnected - Device disconnected
        - device.error - Device error
        - video.started - Video stream started
        - video.stopped - Video stream stopped
        - control.touch - Touch event
        - control.key - Key event
        - group.created - Group created
        - group.enabled - Group enabled
        - group.disabled - Group disabled
    """

    _instance: Optional['EventBus'] = None

    def __init__(self):
        # Event subscribers
        self._subscribers: Dict[str, Set[Callable]] = {}

        # Event history (for debugging)
        self._history: list[Event] = []
        self._max_history = 1000

        # Lock for thread safety
        self._lock = asyncio.Lock()

    @classmethod
    def instance(cls) -> 'EventBus':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def subscribe(self, event_type: str, callback: Callable[[Event], Any]):
        """
        Subscribe to event

        Args:
            event_type: Event type to subscribe to (e.g., 'device.connected')
            callback: Callback function (can be async or sync)
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = set()

        self._subscribers[event_type].add(callback)

    def unsubscribe(self, event_type: str, callback: Callable[[Event], Any]):
        """
        Unsubscribe from event

        Args:
            event_type: Event type
            callback: Callback to remove
        """
        if event_type in self._subscribers:
            self._subscribers[event_type].discard(callback)

    async def emit(
        self,
        event_type: str,
        source: str,
        data: Any,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Emit event

        Args:
            event_type: Event type (e.g., 'device.connected')
            source: Source app name (e.g., 'pyMatrix')
            data: Event data
            metadata: Optional metadata
        """
        # Create event
        event = Event(
            type=event_type,
            source=source,
            timestamp=datetime.now(),
            data=data,
            metadata=metadata
        )

        # Add to history
        async with self._lock:
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)

        # Notify subscribers
        if event_type in self._subscribers:
            for callback in self._subscribers[event_type].copy():
                # Verify callback is callable
                if not callable(callback):
                    continue

                # Call callback - let errors expose naturally
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)

    def get_history(self, event_type: Optional[str] = None, limit: int = 100) -> list[Event]:
        """
        Get event history

        Args:
            event_type: Filter by event type (optional)
            limit: Maximum number of events to return

        Returns:
            List of events
        """
        if event_type:
            events = [e for e in self._history if e.type == event_type]
        else:
            events = self._history.copy()

        return events[-limit:]

    def clear_history(self):
        """Clear event history"""
        self._history.clear()

    def get_subscribers_count(self, event_type: str) -> int:
        """Get number of subscribers for event type"""
        return len(self._subscribers.get(event_type, set()))


# Pre-defined event types (for IDE autocomplete)
class EventTypes:
    """Standard event types"""

    # Device events
    DEVICE_CONNECTED = "device.connected"
    DEVICE_DISCONNECTED = "device.disconnected"
    DEVICE_ERROR = "device.error"

    # Video events
    VIDEO_STARTED = "video.started"
    VIDEO_STOPPED = "video.stopped"
    VIDEO_FRAME = "video.frame"

    # Control events
    CONTROL_TOUCH = "control.touch"
    CONTROL_KEY = "control.key"
    CONTROL_TEXT = "control.text"

    # Group events
    GROUP_CREATED = "group.created"
    GROUP_DESTROYED = "group.destroyed"
    GROUP_ENABLED = "group.enabled"
    GROUP_DISABLED = "group.disabled"
    GROUP_SLAVE_ADDED = "group.slave_added"
    GROUP_SLAVE_REMOVED = "group.slave_removed"

    # App lifecycle events
    APP_STARTED = "app.started"
    APP_STOPPED = "app.stopped"


# Example usage:
if __name__ == "__main__":
    async def main():
        bus = EventBus.instance()

        # Subscribe to device connected event
        def on_device_connected(event: Event):
            print(f"Device connected: {event.data}")

        bus.subscribe(EventTypes.DEVICE_CONNECTED, on_device_connected)

        # Emit event
        await bus.emit(
            EventTypes.DEVICE_CONNECTED,
            source="pyMatrix",
            data={"serial": "ABC123", "model": "Pixel 5"}
        )

        # Check history
        history = bus.get_history(EventTypes.DEVICE_CONNECTED)
        print(f"History: {len(history)} events")

    asyncio.run(main())
