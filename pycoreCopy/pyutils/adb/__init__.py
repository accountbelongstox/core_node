"""
pyutils.adb - ADB 通信模块

功能：
- ADB 设备管理
- 文件推送/拉取
- Shell 命令执行
- 端口转发

依赖：
- 标准库：subprocess, pathlib, typing
- 外部工具：adb（需在 PATH 或指定路径）

示例：
    from pycore.pyutils.adb import ADBManager, ADBDevice

    # 列出设备
    devices = ADBManager.list_devices()
    for device in devices:
        print(device.serial, device.state)

    # 推送文件
    from pathlib import Path
    ADBManager.push_file(
        "ABC123",
        Path("scrcpy-server.jar"),
        "/data/local/tmp/scrcpy-server.jar"
    )

    # 端口转发
    ADBManager.forward_port("ABC123", 27183, 27183)
"""

from .adb_manager import ADBManager
from .adb_device import ADBDevice, DeviceState
from .adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)

__all__ = [
    'ADBManager',
    'ADBDevice',
    'DeviceState',
    'ADBException',
    'DeviceNotFoundException',
    'ADBCommandFailedException'
]

__version__ = '1.0.0'
