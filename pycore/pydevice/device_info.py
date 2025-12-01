"""
Device Information Structures

Defines all data structures for device metadata.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional


class VideoCodec(Enum):
    """Supported video codecs"""
    H264 = "h264"
    H265 = "h265"
    VP8 = "vp8"
    VP9 = "vp9"
    AV1 = "av1"


@dataclass
class Resolution:
    """Screen resolution"""
    width: int
    height: int

    def __str__(self) -> str:
        return f"{self.width}x{self.height}"

    @property
    def aspect_ratio(self) -> float:
        """Calculate aspect ratio"""
        if self.height == 0:
            return 0.0
        return self.width / self.height

    @staticmethod
    def from_string(resolution_str: str) -> 'Resolution':
        """Parse resolution from string (e.g., "1920x1080")"""
        try:
            width, height = resolution_str.split('x')
            return Resolution(width=int(width), height=int(height))
        except (ValueError, AttributeError):
            return Resolution(width=0, height=0)


@dataclass
class DeviceInfo:
    """
    Complete device information

    Contains all metadata about an Android device.
    """

    # Basic identification
    serial: str
    name: str  # User-friendly name
    model: str  # Device model (e.g., "Pixel 6 Pro")
    manufacturer: str  # Manufacturer (e.g., "Google")

    # System information
    android_version: str  # Android version (e.g., "13")
    sdk_version: int  # SDK API level (e.g., 33)
    build_id: str  # Build ID

    # Hardware information
    resolution: Resolution
    dpi: int
    cpu_abi: str  # CPU architecture (e.g., "arm64-v8a")

    # Network information
    ip_address: Optional[str] = None
    wifi_connected: bool = False

    # State information
    battery_level: int = 0
    battery_charging: bool = False
    temperature: float = 0.0  # Celsius

    # Connection metadata
    connection_type: str = "usb"  # "usb" or "wifi"
    last_seen: float = 0  # Unix timestamp

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "serial": self.serial,
            "name": self.name,
            "model": self.model,
            "manufacturer": self.manufacturer,
            "android_version": self.android_version,
            "sdk_version": self.sdk_version,
            "build_id": self.build_id,
            "resolution": {
                "width": self.resolution.width,
                "height": self.resolution.height
            },
            "dpi": self.dpi,
            "cpu_abi": self.cpu_abi,
            "ip_address": self.ip_address,
            "wifi_connected": self.wifi_connected,
            "battery_level": self.battery_level,
            "battery_charging": self.battery_charging,
            "temperature": self.temperature,
            "connection_type": self.connection_type,
            "last_seen": self.last_seen
        }

    @staticmethod
    def from_dict(data: dict) -> 'DeviceInfo':
        """Create DeviceInfo from dictionary"""
        resolution_data = data.get("resolution", {"width": 0, "height": 0})
        resolution = Resolution(
            width=resolution_data.get("width", 0),
            height=resolution_data.get("height", 0)
        )

        return DeviceInfo(
            serial=data.get("serial", ""),
            name=data.get("name", ""),
            model=data.get("model", ""),
            manufacturer=data.get("manufacturer", ""),
            android_version=data.get("android_version", ""),
            sdk_version=data.get("sdk_version", 0),
            build_id=data.get("build_id", ""),
            resolution=resolution,
            dpi=data.get("dpi", 0),
            cpu_abi=data.get("cpu_abi", ""),
            ip_address=data.get("ip_address"),
            wifi_connected=data.get("wifi_connected", False),
            battery_level=data.get("battery_level", 0),
            battery_charging=data.get("battery_charging", False),
            temperature=data.get("temperature", 0.0),
            connection_type=data.get("connection_type", "usb"),
            last_seen=data.get("last_seen", 0)
        )


@dataclass
class DeviceCapabilities:
    """Device capabilities and features"""

    # Video capabilities
    supports_h264: bool = True
    supports_h265: bool = False
    supports_vp8: bool = False
    max_resolution: Resolution = None
    max_fps: int = 60

    # Control capabilities
    supports_touch: bool = True
    supports_multitouch: bool = True
    supports_pressure: bool = False

    # System capabilities
    has_physical_keyboard: bool = False
    has_stylus: bool = False
    supports_rotation: bool = True

    def __post_init__(self):
        if self.max_resolution is None:
            self.max_resolution = Resolution(width=1920, height=1080)
