#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""列出可调试的 Android 设备。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pycore.pyutils.scrcpy_init import get_initializer
from pycore.pyutils.device.adb_commands import ADBCommands


def main():
    init = get_initializer()
    adb_path = init.get_adb_path()
    if not adb_path:
        print("ADB 未初始化，请先安装/配置 ADB。")
        return 1
    adb_path = str(adb_path)
    devices = ADBCommands.get_connected_devices(adb_path)
    if not devices:
        print("未发现可调试设备。请连接设备并开启 USB 调试。")
        return 1
    print(f"可调试设备数: {len(devices)}\n")
    for i, d in enumerate(devices, 1):
        state = d.state.value if hasattr(d.state, "value") else str(d.state)
        print(f"  [{i}] {d.serial}  ({state})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
