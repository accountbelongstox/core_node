"""Synchronization strategy implementations"""

from abc import ABC, abstractmethod
from typing import Set
from .sync_event import SyncEvent


class SyncStrategy(ABC):
    """
    Synchronization strategy abstract base class

    Allows customization of which events should be synchronized to which devices.
    """

    @abstractmethod
    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        """
        Determine if event should be synchronized to slave device

        Args:
            event: Sync event
            master_serial: Master device serial
            slave_serial: Slave device serial

        Returns:
            True if should sync, False otherwise
        """
        pass


class AllSyncStrategy(SyncStrategy):
    """
    All sync strategy

    Synchronizes all events from master to all slaves.
    """

    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        """Always sync to all slaves"""
        return True


class SelectiveSyncStrategy(SyncStrategy):
    """
    Selective sync strategy

    Only synchronizes specific event types to specific devices.

    Example:
        strategy = SelectiveSyncStrategy(
            allowed_event_types={'touch', 'key'},
            allowed_slaves={'device2', 'device3'}
        )
    """

    def __init__(
        self,
        allowed_event_types: Set[str] = None,
        allowed_slaves: Set[str] = None
    ):
        """
        Initialize selective sync strategy

        Args:
            allowed_event_types: Set of allowed event types (None = all)
            allowed_slaves: Set of allowed slave serials (None = all)
        """
        self.allowed_event_types = allowed_event_types
        self.allowed_slaves = allowed_slaves

    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        """Check if event type and slave are allowed"""
        # Check event type
        if self.allowed_event_types is not None:
            if event.event_type not in self.allowed_event_types:
                return False

        # Check slave device
        if self.allowed_slaves is not None:
            if slave_serial not in self.allowed_slaves:
                return False

        return True


class TouchOnlySyncStrategy(SyncStrategy):
    """
    Touch-only sync strategy

    Only synchronizes touch events, ignores other events.
    """

    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        """Only sync touch events"""
        return event.event_type == 'touch'
