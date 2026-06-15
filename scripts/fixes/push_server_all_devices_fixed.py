#!/usr/bin/env python3
"""
批量推送scrcpy-server到所有在线设备
CRITICAL: 文件名必须是 scrcpy-server (没有.jar后缀)
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.device.scrcpy_init import get_initializer
from pycore import ColorPrint

scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

# 找到scrcpy-server文件
scrcpy_server = scrcpy_init.scrcpy_dir / "scrcpy-server"

if not scrcpy_server.exists():
    ColorPrint.red(f"ERROR: scrcpy-server not found at {scrcpy_server}")
    ColorPrint.yellow("Looking for scrcpy-server.jar...")
    scrcpy_server_jar = scrcpy_init.scrcpy_dir / "scrcpy-server.jar"
    if scrcpy_server_jar.exists():
        ColorPrint.green(f"Found: {scrcpy_server_jar}")
        scrcpy_server = scrcpy_server_jar
    else:
        ColorPrint.red("No scrcpy-server file found!")
        sys.exit(1)

file_size = scrcpy_server.stat().st_size
ColorPrint.green(f"Source file: {scrcpy_server}")
ColorPrint.green(f"File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")

# 所有设备
DEVICES = [
    "192.168.31.116:5555",
    "192.168.31.117:5555",
    "192.168.31.119:5555",
    "192.168.31.120:5555",
    "192.168.31.121:5555",
    "192.168.31.123:5555",
    "192.168.31.124:5555",
    "192.168.31.125:5555",
    "192.168.31.126:5555",
    "192.168.31.128:5555",
    "192.168.31.129:5555",
    "192.168.31.132:5555",
    "192.168.31.133:5555",
    "192.168.31.134:5555",
    "192.168.31.135:5555",
    "192.168.31.136:5555",
    "192.168.31.138:5555",
    "192.168.31.139:5555",
]

print("\n" + "=" * 80)
ColorPrint.blue(f"推送scrcpy-server到 {len(DEVICES)} 台设备")
print("=" * 80)

success_count = 0
failed_devices = []

for i, device in enumerate(DEVICES, 1):
    ColorPrint.blue(f"\n[{i}/{len(DEVICES)}] {device}")

    # CRITICAL: 目标文件名必须是 scrcpy-server (没有.jar后缀)
    # CRITICAL: 使用 //data/local/tmp/ 防止Git Bash路径转换
    result = subprocess.run(
        [str(ADB_PATH), "-s", device, "push", str(scrcpy_server), "//data/local/tmp/scrcpy-server"],
        capture_output=True,
        text=True,
        timeout=30
    )

    if result.returncode == 0:
        # 验证
        verify_result = subprocess.run(
            [str(ADB_PATH), "-s", device, "shell", "ls -lh /data/local/tmp/scrcpy-server"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if verify_result.returncode == 0:
            ColorPrint.green(f"  ✓ SUCCESS: {verify_result.stdout.strip()}")
            success_count += 1
        else:
            ColorPrint.red(f"  ✗ FAILED to verify: {verify_result.stderr.strip()}")
            failed_devices.append(device)
    else:
        ColorPrint.red(f"  ✗ FAILED to push: {result.stderr.strip()}")
        failed_devices.append(device)

print("\n" + "=" * 80)
ColorPrint.green(f"成功: {success_count}/{len(DEVICES)} 台设备")
if failed_devices:
    ColorPrint.red(f"失败: {len(failed_devices)} 台设备")
    for device in failed_devices:
        ColorPrint.red(f"  - {device}")
else:
    ColorPrint.green("所有设备推送成功！")
print("=" * 80)
