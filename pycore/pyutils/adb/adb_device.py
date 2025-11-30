"""ADB 设备信息数据类"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class DeviceState(Enum):
    """设备状态枚举"""
    DEVICE = "device"              # 设备正常连接
    OFFLINE = "offline"            # 设备离线
    UNAUTHORIZED = "unauthorized"  # 未授权
    UNKNOWN = "unknown"            # 未知状态


@dataclass
class ADBDevice:
    """ADB 设备信息"""
    serial: str                    # 设备序列号（唯一标识）
    state: DeviceState             # 设备状态
    model: Optional[str] = None    # 设备型号（需额外查询）
    product: Optional[str] = None  # 产品名称

    @property
    def is_available(self) -> bool:
        """是否可用（已授权且在线）"""
        return self.state == DeviceState.DEVICE

    def __repr__(self) -> str:
        return f"ADBDevice(serial='{self.serial}', state={self.state.value}, model='{self.model}')"
