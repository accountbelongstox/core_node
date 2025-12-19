#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Device Table - Centralized Device State Management

Maintains a thread-safe registry of all discovered ADB devices with their states,
capabilities, and connection information.
"""

import time
import threading
from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime


class DeviceState(Enum):
    """Device connection state"""
    UNKNOWN = "unknown"              # Initial state
    USB_CONNECTED = "usb_connected"  # Connected via USB
    WIFI_CONNECTED = "wifi_connected"  # Connected via WiFi
    CONFIGURING = "configuring"      # Being configured (tcpip 5555)
    DISCONNECTED = "disconnected"    # Disconnected
    ERROR = "error"                  # Error state


class DeviceType(Enum):
    """Device type"""
    USB = "usb"        # USB device (serial like "P7C0218510000537")
    WIFI = "wifi"      # WiFi device (IP:PORT like "192.168.1.100:5555")
    ROOT = "root"      # Root device (detected via network scan)


@dataclass
class DeviceInfo:
    """Device information"""
    serial: str                          # Device serial or IP:PORT
    device_type: DeviceType              # Device type
    state: DeviceState                   # Connection state
    ip_address: Optional[str] = None     # IP address (if available)
    is_root: bool = False                # Is device rooted
    model: Optional[str] = None          # Device model
    android_version: Optional[str] = None  # Android version

    # Timestamps
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)

    # Connection history
    usb_serial: Optional[str] = None     # Original USB serial (if converted from USB)
    wifi_ip: Optional[str] = None        # WiFi IP (if converted to WiFi)
    conversion_time: Optional[float] = None  # Time when converted to WiFi

    # Error tracking
    error_count: int = 0
    last_error: Optional[str] = None
    last_error_time: Optional[float] = None

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        data['device_type'] = self.device_type.value
        data['state'] = self.state.value
        data['first_seen_str'] = datetime.fromtimestamp(self.first_seen).strftime('%Y-%m-%d %H:%M:%S')
        data['last_seen_str'] = datetime.fromtimestamp(self.last_seen).strftime('%Y-%m-%d %H:%M:%S')
        return data

    def update_heartbeat(self):
        """Update last heartbeat timestamp"""
        self.last_heartbeat = time.time()
        self.last_seen = time.time()

    def mark_error(self, error_msg: str):
        """Mark device as error"""
        self.state = DeviceState.ERROR
        self.error_count += 1
        self.last_error = error_msg
        self.last_error_time = time.time()

    def is_stale(self, timeout: float = 60.0) -> bool:
        """Check if device heartbeat is stale"""
        return (time.time() - self.last_heartbeat) > timeout


class DeviceTable:
    """
    Thread-safe device registry (Singleton)

    Maintains a central table of all discovered devices with their states.
    Provides methods for adding, removing, updating, and querying devices.

    IMPORTANT: This is a singleton class. Use DeviceTable.instance() to get the global instance.
    DO NOT instantiate with DeviceTable() directly.
    """

    _instance: Optional['DeviceTable'] = None
    _instance_lock = threading.Lock()

    def __init__(self):
        """
        Initialize device table

        WARNING: Do not call directly. Use DeviceTable.instance() instead.
        """
        self._devices: Dict[str, DeviceInfo] = {}
        self._lock = threading.RLock()

        # Statistics
        self._total_added = 0
        self._total_removed = 0
        self._total_state_changes = 0

    @classmethod
    def instance(cls) -> 'DeviceTable':
        """
        Get global singleton instance of DeviceTable

        Returns:
            DeviceTable: The global singleton instance

        Example:
            device_table = DeviceTable.instance()
            device_table.add_device(device_info)
        """
        if cls._instance is None:
            with cls._instance_lock:
                # Double-check pattern for thread safety
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def add_device(self, device_info: DeviceInfo) -> bool:
        """
        Add device to table

        Args:
            device_info: Device information

        Returns:
            True if added, False if already exists
        """
        with self._lock:
            serial = device_info.serial

            if serial in self._devices:
                existing = self._devices[serial]
                existing.last_seen = time.time()
                existing.update_heartbeat()
                return False

            self._devices[serial] = device_info
            self._total_added += 1
            return True

    def remove_device(self, serial: str) -> bool:
        """
        Remove device from table

        Args:
            serial: Device serial

        Returns:
            True if removed, False if not found
        """
        with self._lock:
            if serial in self._devices:
                device = self._devices[serial]
                device.state = DeviceState.DISCONNECTED
                device.last_seen = time.time()
                del self._devices[serial]
                self._total_removed += 1
                return True
            return False

    def get_device(self, serial: str) -> Optional[DeviceInfo]:
        """
        Get device by serial

        Args:
            serial: Device serial

        Returns:
            DeviceInfo or None
        """
        with self._lock:
            return self._devices.get(serial)

    def update_device(self, serial: str, **updates) -> bool:
        """
        Update device attributes

        Args:
            serial: Device serial
            **updates: Attributes to update

        Returns:
            True if updated, False if not found
        """
        with self._lock:
            device = self._devices.get(serial)
            if not device:
                return False

            for key, value in updates.items():
                if hasattr(device, key):
                    setattr(device, key, value)

            device.last_seen = time.time()
            return True

    def update_device_state(self, serial: str, new_state: DeviceState) -> bool:
        """
        Update device state

        Args:
            serial: Device serial
            new_state: New state

        Returns:
            True if updated, False if not found
        """
        with self._lock:
            device = self._devices.get(serial)
            if not device:
                return False

            if device.state != new_state:
                device.state = new_state
                device.last_seen = time.time()
                self._total_state_changes += 1
                return True

            return False

    def get_all_devices(self) -> List[DeviceInfo]:
        """Get all devices (snapshot)"""
        with self._lock:
            return list(self._devices.values())

    def get_devices_by_state(self, state: DeviceState) -> List[DeviceInfo]:
        """Get devices by state"""
        with self._lock:
            return [d for d in self._devices.values() if d.state == state]

    def get_devices_by_type(self, device_type: DeviceType) -> List[DeviceInfo]:
        """Get devices by type"""
        with self._lock:
            return [d for d in self._devices.values() if d.device_type == device_type]

    def get_usb_devices(self) -> List[DeviceInfo]:
        """Get all USB devices"""
        return self.get_devices_by_type(DeviceType.USB)

    def get_wifi_devices(self) -> List[DeviceInfo]:
        """Get all WiFi devices"""
        return self.get_devices_by_type(DeviceType.WIFI)

    def get_root_devices(self) -> List[DeviceInfo]:
        """Get all Root devices"""
        with self._lock:
            return [d for d in self._devices.values() if d.is_root]

    def get_stale_devices(self, timeout: float = 60.0) -> List[DeviceInfo]:
        """Get devices with stale heartbeat"""
        with self._lock:
            return [d for d in self._devices.values() if d.is_stale(timeout)]

    def cleanup_stale_devices(self, timeout: float = 60.0) -> int:
        """
        Remove stale devices

        Args:
            timeout: Stale timeout in seconds

        Returns:
            Number of devices removed
        """
        stale = self.get_stale_devices(timeout)
        count = 0

        for device in stale:
            if self.remove_device(device.serial):
                count += 1

        return count

    def get_stats(self) -> Dict[str, Any]:
        """Get device table statistics"""
        with self._lock:
            return {
                'total_devices': len(self._devices),
                'usb_devices': len(self.get_usb_devices()),
                'wifi_devices': len(self.get_wifi_devices()),
                'root_devices': len(self.get_root_devices()),
                'total_added': self._total_added,
                'total_removed': self._total_removed,
                'total_state_changes': self._total_state_changes,
                'devices_by_state': {
                    state.value: len(self.get_devices_by_state(state))
                    for state in DeviceState
                }
            }

    def clear(self):
        """Clear all devices"""
        with self._lock:
            self._devices.clear()
