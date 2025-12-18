"""Group control controller"""

from typing import Set, Optional, Dict, Any
from pycore.pyutils.group.sync_strategy import SyncStrategy, AllSyncStrategy
from pycore.pyutils.group.sync_event import SyncEvent


class GroupController:
    """
    Group control controller (core algorithm)

    Features:
    - Manage master-slave device relationships
    - Event broadcasting strategy
    - Synchronization rules

    Characteristics:
    - Stateless (does not depend on WebSocket)
    - Pure algorithm logic
    - Easy to test

    Example:
        controller = GroupController()

        # Set up group
        controller.set_master("device1")
        controller.add_slave("device2")
        controller.add_slave("device3")

        # Process event
        event = SyncEvent(
            from_device="device1",
            event_type="touch",
            event_data={"x": 500, "y": 1000}
        )

        targets = controller.get_sync_targets(event)
        # Returns: {"device2", "device3"}
    """

    def __init__(self, strategy: Optional[SyncStrategy] = None):
        """
        Initialize group controller

        Args:
            strategy: Synchronization strategy (default: AllSyncStrategy)
        """
        self.strategy = strategy or AllSyncStrategy()
        self.master_device: Optional[str] = None
        self.slave_devices: Set[str] = set()
        self._device_metadata: Dict[str, Dict[str, Any]] = {}

    def set_master(self, serial: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Set master device

        Args:
            serial: Device serial number
            metadata: Device metadata (e.g., resolution)
        """
        # If there was a previous master, move it to slaves if still in group
        if self.master_device and self.master_device != serial:
            old_master = self.master_device
            if old_master in self._device_metadata:
                self.slave_devices.add(old_master)

        self.master_device = serial
        self.slave_devices.discard(serial)  # Remove from slaves if present

        if metadata:
            self._device_metadata[serial] = metadata

    def add_slave(self, serial: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Add slave device

        Args:
            serial: Device serial number
            metadata: Device metadata
        """
        if serial != self.master_device:
            self.slave_devices.add(serial)

            if metadata:
                self._device_metadata[serial] = metadata

    def remove_device(self, serial: str):
        """
        Remove device from group

        Args:
            serial: Device serial number
        """
        if serial == self.master_device:
            self.master_device = None

        self.slave_devices.discard(serial)
        self._device_metadata.pop(serial, None)

    def get_sync_targets(self, event: SyncEvent) -> Set[str]:
        """
        Get devices that should receive this event

        Args:
            event: Sync event

        Returns:
            Set of target device serials
        """
        # Only master device events are synchronized
        if event.from_device != self.master_device:
            return set()

        if not self.master_device:
            return set()

        # Filter devices based on strategy
        targets = {
            slave for slave in self.slave_devices
            if self.strategy.should_sync(
                event, self.master_device, slave
            )
        }

        return targets

    def is_master(self, serial: str) -> bool:
        """
        Check if device is master

        Args:
            serial: Device serial number

        Returns:
            True if master, False otherwise
        """
        return serial == self.master_device

    def is_slave(self, serial: str) -> bool:
        """
        Check if device is slave

        Args:
            serial: Device serial number

        Returns:
            True if slave, False otherwise
        """
        return serial in self.slave_devices

    def get_device_count(self) -> int:
        """
        Get total device count in group

        Returns:
            Number of devices (master + slaves)
        """
        count = len(self.slave_devices)
        if self.master_device:
            count += 1
        return count

    def get_master(self) -> Optional[str]:
        """
        Get master device serial

        Returns:
            Master device serial or None
        """
        return self.master_device

    def get_slaves(self) -> Set[str]:
        """
        Get all slave device serials

        Returns:
            Set of slave device serials
        """
        return self.slave_devices.copy()

    def get_device_metadata(self, serial: str) -> Optional[Dict[str, Any]]:
        """
        Get device metadata

        Args:
            serial: Device serial number

        Returns:
            Device metadata or None
        """
        return self._device_metadata.get(serial)

    def clear(self):
        """Clear all devices from group"""
        self.master_device = None
        self.slave_devices.clear()
        self._device_metadata.clear()

    def __repr__(self) -> str:
        return (
            f"GroupController(master={self.master_device}, "
            f"slaves={len(self.slave_devices)}, "
            f"total={self.get_device_count()})"
        )
