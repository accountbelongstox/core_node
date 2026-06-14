#!/usr/bin/env python3
"""
批量连接网络ADB设备 / Batch Connect Network ADB Devices
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

# 你的设备IP列表
DEVICE_IPS = [
    "192.168.31.117",
    "192.168.31.119",
    "192.168.31.120",
    "192.168.31.121",
    "192.168.31.123",
    "192.168.31.124",
    "192.168.31.125",
    "192.168.31.126",
    "192.168.31.128",
    "192.168.31.129",
    "192.168.31.131",
    "192.168.31.132",
    "192.168.31.133",
    "192.168.31.134",
    "192.168.31.135",
    "192.168.31.136",
    "192.168.31.138",
    "192.168.31.139",
]

ADB_PORT = 5555

print("=" * 70)
print("批量连接网络ADB设备 / Batch Connect Network ADB Devices")
print("=" * 70)
print(f"ADB路径: {ADB_PATH}")
print(f"设备数量: {len(DEVICE_IPS)}")
print(f"ADB端口: {ADB_PORT}\n")

connected = []
failed = []

for i, ip in enumerate(DEVICE_IPS, 1):
    device_addr = f"{ip}:{ADB_PORT}"
    print(f"[{i}/{len(DEVICE_IPS)}] 连接 {device_addr}... ", end='', flush=True)

    try:
        result = subprocess.run(
            [str(ADB_PATH), "connect", device_addr],
            capture_output=True,
            text=True,
            timeout=5
        )

        if "connected" in result.stdout.lower() or "already connected" in result.stdout.lower():
            print("[OK]")
            connected.append(device_addr)
        else:
            print(f"[FAIL] {result.stdout.strip()}")
            failed.append(device_addr)
    except subprocess.TimeoutExpired:
        print("[TIMEOUT]")
        failed.append(device_addr)
    except Exception as e:
        print(f"[ERROR] {e}")
        failed.append(device_addr)

    # 小延迟避免网络拥塞
    time.sleep(0.2)

print("\n" + "=" * 70)
print(f"连接完成: {len(connected)}/{len(DEVICE_IPS)} 成功")
print("=" * 70)

if failed:
    print(f"\n失败的设备 ({len(failed)}):")
    for addr in failed:
        print(f"  - {addr}")

# 显示最终设备状态
print("\n最终设备列表:")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

online_count = 0
for line in result.stdout.splitlines()[1:]:
    if '\tdevice' in line:
        online_count += 1
        serial = line.split('\t')[0]
        print(f"  [OK] {serial}")

print(f"\n在线设备: {online_count}")
