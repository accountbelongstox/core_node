#!/usr/bin/env python3
"""
重启ADB服务 / Restart ADB Server
"""
import subprocess
import sys
import time
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.device.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

print("=" * 70)
print("重启ADB服务 / Restart ADB Server")
print("=" * 70)
print(f"ADB路径: {ADB_PATH}\n")

# Step 1: Kill ADB server
print("[1/3] 停止ADB服务器...")
result = subprocess.run(
    [str(ADB_PATH), "kill-server"],
    capture_output=True,
    text=True
)
print("  [OK] ADB服务器已停止")
time.sleep(2)

# Step 2: Start ADB server
print("\n[2/3] 启动ADB服务器...")
result = subprocess.run(
    [str(ADB_PATH), "start-server"],
    capture_output=True,
    text=True
)
if result.stdout:
    print(f"  {result.stdout.strip()}")
print("  [OK] ADB服务器已启动")
time.sleep(2)

# Step 3: Check devices
print("\n[3/3] 检查设备状态...")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

print("\n" + "=" * 70)
print("设备列表:")
print("=" * 70)
print(result.stdout)

# Count devices
online_count = 0
offline_count = 0
unauthorized_count = 0

for line in result.stdout.splitlines()[1:]:
    if '\tdevice' in line:
        online_count += 1
    elif '\toffline' in line:
        offline_count += 1
    elif '\tunauthorized' in line:
        unauthorized_count += 1

print(f"在线: {online_count} | 离线: {offline_count} | 未授权: {unauthorized_count}")
print("=" * 70)

if offline_count > 0:
    print("\n提示: 如果仍有离线设备，请尝试:")
    print("  1. 检查设备是否开启了网络ADB (端口5555)")
    print("  2. 检查网络连接是否正常")
    print("  3. 在设备上重新开启网络ADB调试")
    print("  4. 手动连接: adb connect <IP>:5555")
