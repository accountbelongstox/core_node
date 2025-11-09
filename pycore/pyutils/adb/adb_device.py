"""ADB device information dataclass"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class DeviceState(Enum):
    """Device state enumeration"""
    DEVICE = "device"              # Device normally connected
    OFFLINE = "offline"            # Device offline
    UNAUTHORIZED = "unauthorized"  # Unauthorized
    UNKNOWN = "unknown"            # Unknown state


@dataclass
class ADBDevice:
    """ADB device information"""
    serial: str                    # Device serial number (unique identifier)
    state: DeviceState             # Device state
    model: Optional[str] = None    # Device model (requires additional query)
    product: Optional[str] = None  # Product name

    @property
    def is_available(self) -> bool:
        """Whether available (authorized and online)"""
        return self.state == DeviceState.DEVICE

    def __repr__(self) -> str:
        return f"ADBDevice(serial='{self.serial}', state={self.state.value}, model='{self.model}')"
