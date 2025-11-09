"""
ADB Types and Enums

Reference: SmartMatrixCore/src/adb/adbprocess.h
"""

from dataclasses import dataclass
from enum import Enum, IntEnum


class AdbExecResult(Enum):
    """
    ADB execution result codes
    Reference: adbprocess.h:14-21
    """
    SUCCESS_START = 0       # Started successfully
    ERROR_START = 1         # Failed to start
    SUCCESS_EXEC = 2        # Executed successfully
    ERROR_EXEC = 3          # Execution failed
    ERROR_MISSING_BINARY = 4  # ADB binary not found


@dataclass
class AdbDeviceInfo:
    """Device information"""
    serial: str
    state: str
    model: str = ""
    device: str = ""
    product: str = ""
    transport_id: str = ""
