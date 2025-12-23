#!/usr/bin/env python3
"""
通过USB连接批量启用设备的网络ADB
USB Enable Network ADB for All Devices
"""
import subprocess
import sys
import time
import json
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

# Save file for enabled devices
ENABLED_DEVICES_FILE = Path(__file__).parent / "enabled_devices.json"

def load_enabled_devices():
    """Load previously enabled devices"""
    if ENABLED_DEVICES_FILE.exists():
        with open(ENABLED_DEVICES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_enabled_device(serial, ip):
    """Save enabled device info"""
    devices = load_enabled_devices()
    devices[serial] = {
        'ip': ip,
        'enabled_at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    with open(ENABLED_DEVICES_FILE, 'w', encoding='utf-8') as f:
        json.dump(devices, f, indent=2, ensure_ascii=False)

def get_usb_device():
    """Get USB connected device (not network)"""
    result = subprocess.run(
        [str(ADB_PATH), "devices"],
        capture_output=True,
        text=True
    )

    for line in result.stdout.splitlines()[1:]:
        if '\tdevice' in line or ' device' in line:
            parts = line.split()
            if parts:
                serial = parts[0]
                # USB devices don't have ':' in serial
                if ':' not in serial:
                    return serial
    return None

def get_device_ip(serial):
    """Get device IP address"""
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "shell", "ip", "addr", "show", "wlan0"],
        capture_output=True,
        text=True,
        timeout=5
    )

    # Parse IP from output like: inet 192.168.31.117/24
    for line in result.stdout.splitlines():
        if 'inet ' in line:
            parts = line.strip().split()
            if len(parts) >= 2:
                ip_with_mask = parts[1]
                ip = ip_with_mask.split('/')[0]
                return ip

    return None

def enable_network_adb(serial):
    """Enable network ADB on device via USB"""
    print(f"  [1] 在设备上启用网络ADB (端口5555)...")

    # Method 1: Try with root
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "shell",
         "su -c 'setprop service.adb.tcp.port 5555 && stop adbd && start adbd'"],
        capture_output=True,
        text=True,
        timeout=10
    )

    if result.returncode != 0:
        # Method 2: Try without root (on some devices)
        print(f"      (尝试无root方式...)")
        subprocess.run(
            [str(ADB_PATH), "-s", serial, "tcpip", "5555"],
            capture_output=True,
            timeout=10
        )

    time.sleep(2)
    print(f"      [完成]")

print("=" * 70)
print("USB批量启用网络ADB工具")
print("=" * 70)
print(f"ADB路径: {ADB_PATH}\n")

# Load previously enabled devices
enabled_devices = load_enabled_devices()
if enabled_devices:
    print(f"已记录 {len(enabled_devices)} 个设备:")
    for serial, info in enabled_devices.items():
        print(f"  {serial} -> {info['ip']} ({info['enabled_at']})")
    print()

print("=" * 70)
print("操作说明:")
print("  1. 用USB线连接一个设备到电脑")
print("  2. 按回车键继续")
print("  3. 脚本会自动启用该设备的网络ADB并记录IP")
print("  4. 拔掉USB，连接下一个设备")
print("  5. 重复直到所有设备都启用")
print("  6. 按 Ctrl+C 退出")
print("=" * 70)
print()

enabled_count = 0

try:
    while True:
        input(">>> 请连接USB设备，然后按回车... ")

        # Check for USB device
        usb_serial = get_usb_device()

        if not usb_serial:
            print("[错误] 未检测到USB设备，请检查:")
            print("  - USB线是否连接")
            print("  - 设备是否开启USB调试")
            print("  - 是否接受了授权弹窗")
            print()
            continue

        print(f"\n>>> 检测到USB设备: {usb_serial}")

        # Get device model
        result = subprocess.run(
            [str(ADB_PATH), "-s", usb_serial, "shell", "getprop", "ro.product.model"],
            capture_output=True,
            text=True,
            timeout=5
        )
        model = result.stdout.strip() if result.returncode == 0 else "Unknown"
        print(f"    型号: {model}")

        # Get device IP
        ip = get_device_ip(usb_serial)
        if not ip:
            print("[错误] 无法获取设备IP地址，请检查设备是否连接WiFi")
            print()
            continue

        print(f"    IP地址: {ip}")

        # Enable network ADB
        enable_network_adb(usb_serial)

        # Try to connect via network
        print(f"  [2] 通过网络连接设备...")
        network_addr = f"{ip}:5555"

        time.sleep(2)

        result = subprocess.run(
            [str(ADB_PATH), "connect", network_addr],
            capture_output=True,
            text=True,
            timeout=10
        )

        if "connected" in result.stdout.lower() or "already connected" in result.stdout.lower():
            print(f"      [成功] {network_addr}")

            # Test connection
            result = subprocess.run(
                [str(ADB_PATH), "-s", network_addr, "shell", "echo", "test"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                print(f"      [验证] 网络ADB工作正常")
                save_enabled_device(usb_serial, ip)
                enabled_count += 1
                print(f"\n[总进度] 已启用 {enabled_count} 个设备\n")
            else:
                print(f"      [警告] 连接成功但无法执行命令")
        else:
            print(f"      [失败] {result.stdout.strip()}")

        print("=" * 70)

except KeyboardInterrupt:
    print("\n\n程序已停止")

print("\n" + "=" * 70)
print(f"已启用 {enabled_count} 个设备")
print("=" * 70)

# Show final device list
print("\n当前所有设备:")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)
print(result.stdout)
