#!/usr/bin/env python3
"""
Reconnect all offline ADB devices
重新连接所有离线的ADB设备
"""
import subprocess
import sys
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.device.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

print("=" * 70)
print("重新连接所有ADB设备 / Reconnect All ADB Devices")
print("=" * 70)
print(f"ADB路径: {ADB_PATH}")
print()

# Get all devices
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

devices = []
for line in result.stdout.splitlines()[1:]:
    if '\t' in line:
        serial = line.split('\t')[0]
        status = line.split('\t')[1]
        devices.append((serial, status))

print(f"找到 {len(devices)} 个设备:")
for serial, status in devices:
    print(f"  {serial} - {status}")
print()

# Disconnect all devices first
print("[1/3] 断开所有设备...")
for serial, _ in devices:
    # Extract IP from serial (e.g., 192.168.31.117:5555 -> 192.168.31.117)
    if ':' in serial:
        ip = serial.split(':')[0]
        print(f"  断开 {ip}")
        subprocess.run(
            [str(ADB_PATH), "disconnect", ip],
            capture_output=True
        )

print()

# Wait a moment
import time
print("[2/3] 等待 2 秒...")
time.sleep(2)
print()

# Reconnect all devices
print("[3/3] 重新连接所有设备...")
connected_count = 0
failed = []

for serial, _ in devices:
    if ':' in serial:
        # Use the full serial (IP:port)
        print(f"  连接 {serial}... ", end='', flush=True)
        result = subprocess.run(
            [str(ADB_PATH), "connect", serial],
            capture_output=True,
            text=True,
            timeout=10
        )

        if "connected" in result.stdout.lower():
            print("✓ 成功")
            connected_count += 1
        else:
            print("✗ 失败")
            failed.append(serial)

print()
print("=" * 70)
print(f"重连完成: {connected_count}/{len(devices)} 成功")
if failed:
    print(f"失败的设备:")
    for serial in failed:
        print(f"  - {serial}")
print("=" * 70)

# Show final status
print("\n最终设备状态:")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)
print(result.stdout)

# Count online devices
online_count = 0
offline_count = 0
for line in result.stdout.splitlines()[1:]:
    if '\tdevice' in line:
        online_count += 1
    elif '\toffline' in line:
        offline_count += 1

print(f"在线: {online_count} | 离线: {offline_count}")
