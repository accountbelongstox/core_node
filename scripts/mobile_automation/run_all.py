#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""依次执行：列出设备 -> 列出 APP -> 桌面从左到右逐屏打开并关闭每个 APP。"""
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent


def run(script: str, *args) -> int:
    cmd = [sys.executable, str(DIR / script)] + list(args)
    return subprocess.call(cmd)


def main():
    print("=== 1. 列出可调试设备 ===\n")
    if run("list_devices.py") != 0:
        return 1
    print("\n=== 2. 列出设备上的 APP（第三方） ===\n")
    if run("list_apps.py", "-3") != 0:
        return 1
    print("\n=== 3. 桌面逐屏打开并关闭每个 APP ===\n")
    return run("launcher_open_close_all.py")


if __name__ == "__main__":
    sys.exit(main())
