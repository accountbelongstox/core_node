"""Device information data classes"""

from dataclasses import dataclass
from typing import Tuple


@dataclass
class Resolution:
    """Screen resolution"""
    width: int
    height: int

    @property
    def aspect_ratio(self) -> float:
        """Calculate aspect ratio"""
        return self.width / self.height

    def __str__(self) -> str:
        return f"{self.width}x{self.height}"


@dataclass
class DeviceInfo:
    """Complete Android device information"""
    serial: str                     # Device serial number
    model: str                      # Device model
    resolution: Resolution          # Screen resolution
    dpi: int                        # Screen DPI
    android_version: str            # Android version
    sdk_version: int                # SDK version

    def __repr__(self) -> str:
        return (
            f"DeviceInfo(serial='{self.serial}', model='{self.model}', "
            f"resolution={self.resolution}, android={self.android_version})"
        )
