"""
ADB Type Definitions

All type definitions for ADB operations.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional


class ADBDeviceState(Enum):
    """ADB device connection states"""
    DEVICE = "device"  # Fully connected and authorized
    OFFLINE = "offline"  # Device offline
    UNAUTHORIZED = "unauthorized"  # USB debugging not authorized
    BOOTLOADER = "bootloader"  # Device in bootloader mode
    RECOVERY = "recovery"  # Device in recovery mode
    SIDELOAD = "sideload"  # Device in sideload mode
    UNKNOWN = "unknown"  # Unknown state


class ADBConnectionType(Enum):
    """Device connection type"""
    USB = "usb"  # USB connection
    WIFI = "wifi"  # WiFi (TCP/IP) connection
    UNKNOWN = "unknown"  # Cannot determine


@dataclass
class ADBExecuteResult:
    """Result of ADB command execution"""
    success: bool
    stdout: str
    stderr: str
    returncode: int


@dataclass
class ADBDeviceBasic:
    """Basic ADB device information from 'adb devices'"""
    serial: str
    state: ADBDeviceState

    @property
    def is_wifi(self) -> bool:
        """Check if device is connected via WiFi"""
        return ':' in self.serial

    @property
    def connection_type(self) -> ADBConnectionType:
        """Get connection type"""
        if self.is_wifi:
            return ADBConnectionType.WIFI
        elif self.serial and not self.serial.startswith('emulator'):
            return ADBConnectionType.USB
        return ADBConnectionType.UNKNOWN

    @property
    def ip_address(self) -> Optional[str]:
        """Get IP address if WiFi connection"""
        if self.is_wifi and ':' in self.serial:
            return self.serial.split(':')[0]
        return None

    @property
    def port(self) -> Optional[int]:
        """Get port if WiFi connection"""
        if self.is_wifi and ':' in self.serial:
            try:
                return int(self.serial.split(':')[1])
            except (IndexError, ValueError):
                return 5555
        return None


@dataclass
class ADBDeviceProperties:
    """Detailed device properties from getprop"""
    # Device identification
    manufacturer: str = ""
    model: str = ""
    brand: str = ""
    device: str = ""

    # System information
    android_version: str = ""
    sdk_version: int = 0
    build_id: str = ""

    # Hardware information
    cpu_abi: str = ""
    screen_density: int = 0
    screen_resolution: str = ""

    # Network information
    wifi_mac: str = ""
    ip_address: str = ""


@dataclass
class ADBDeviceBattery:
    """Battery status information"""
    level: int  # 0-100
    charging: bool
    temperature: float  # Celsius
    voltage: int  # mV
    health: str  # good, overheat, dead, etc.


@dataclass
class ADBForwardSpec:
    """Port forwarding specification"""
    local_port: int
    remote_socket: str  # e.g., "scrcpy", "localabstract:name"
    protocol: str = "tcp"  # tcp or localabstract
