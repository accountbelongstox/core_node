#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""列出指定设备上已安装的 APP（包名）。"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pycore.pyutils.device.scrcpy_init import get_initializer
from pycore.pyutils.device.adb_commands import ADBCommands
from pycore.pyutils.device.adb_manager import ADBManager


def list_packages_third_party(serial: str, adb_path: str) -> list:
    """仅第三方应用：pm list packages -3"""
    try:
        out = ADBManager.execute_shell(serial, "pm list packages -3", adb_path, timeout=60)
        return [line.replace("package:", "").strip() for line in out.splitlines() if line.strip().startswith("package:")]
    except Exception:
        return []


def main():
    ap = argparse.ArgumentParser(description="列出设备已安装 APP")
    ap.add_argument("-s", "--serial", default="", help="设备序列号，不填则用当前唯一设备")
    ap.add_argument("-3", "--third-party", action="store_true", help="仅列出第三方应用")
    args = ap.parse_args()

    init = get_initializer()
    adb_path = init.get_adb_path()
    if not adb_path:
        print("ADB 未初始化。")
        return 1
    adb_path = str(adb_path)

    serial = args.serial.strip()
    if not serial:
        devices = ADBCommands.get_connected_devices(adb_path)
        if not devices:
            print("未发现设备，请用 -s 指定序列号。")
            return 1
        if len(devices) > 1:
            print("多台设备连接，请用 -s 指定序列号。")
            for d in devices:
                print(f"  {d.serial}")
            return 1
        serial = devices[0].serial

    if args.third_party:
        packages = list_packages_third_party(serial, adb_path)
    else:
        packages = ADBCommands.list_packages(serial, adb_path)

    print(f"设备: {serial}")
    print(f"应用数: {len(packages)}\n")
    for i, pkg in enumerate(sorted(packages), 1):
        print(f"  [{i}] {pkg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
