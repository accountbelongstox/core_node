"""
ADB Device Representation

Represents a single ADB device with all its properties and capabilities.
"""

from dataclasses import dataclass, field
from typing import Optional
from pycore.pyadb.adb_types import (
    ADBDeviceBasic,
    ADBDeviceState,
    ADBConnectionType,
    ADBDeviceProperties,
    ADBDeviceBattery
)


@dataclass
class ADBDevice:
    """
    Complete ADB device representation

    This class combines basic device info with detailed properties.
    Immutable after creation (frozen=True for performance).
    """

    # Basic information
    serial: str
    state: ADBDeviceState
    connection_type: ADBConnectionType

    # Optional detailed properties
    properties: Optional[ADBDeviceProperties] = None
    battery: Optional[ADBDeviceBattery] = None

    # Connection metadata
    ip_address: Optional[str] = None
    port: Optional[int] = None
    last_seen: float = 0  # Unix timestamp

    @staticmethod
    def from_basic(basic: ADBDeviceBasic) -> 'ADBDevice':
        """Create ADBDevice from basic device info"""
        return ADBDevice(
            serial=basic.serial,
            state=basic.state,
            connection_type=basic.connection_type,
            ip_address=basic.ip_address,
            port=basic.port if basic.port else None
        )

    @property
    def is_online(self) -> bool:
        """Check if device is online and ready"""
        return self.state == ADBDeviceState.DEVICE

    @property
    def is_unauthorized(self) -> bool:
        """Check if device needs USB debugging authorization"""
        return self.state == ADBDeviceState.UNAUTHORIZED

    @property
    def is_wifi(self) -> bool:
        """Check if connected via WiFi"""
        return self.connection_type == ADBConnectionType.WIFI

    @property
    def is_usb(self) -> bool:
        """Check if connected via USB"""
        return self.connection_type == ADBConnectionType.USB

    @property
    def display_name(self) -> str:
        """Get human-readable device name"""
        if self.properties:
            if self.properties.model:
                return f"{self.properties.manufacturer} {self.properties.model}"
            return self.properties.device

        # Fallback to serial
        if self.is_wifi:
            return f"WiFi Device ({self.ip_address})"
        return f"USB Device ({self.serial[:12]}...)"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "serial": self.serial,
            "state": self.state.value,
            "connection_type": self.connection_type.value,
            "ip_address": self.ip_address,
            "port": self.port,
            "display_name": self.display_name,
            "is_online": self.is_online,
            "is_unauthorized": self.is_unauthorized,
            "is_wifi": self.is_wifi,
            "is_usb": self.is_usb,
            "properties": self.properties.__dict__ if self.properties else None,
            "battery": self.battery.__dict__ if self.battery else None,
        }
