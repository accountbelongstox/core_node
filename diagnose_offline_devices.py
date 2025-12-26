#!/usr/bin/env python3
"""
诊断ADB offline设备问题 / Diagnose ADB Offline Devices
"""
import subprocess
import sys
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

print("=" * 70)
print("ADB Offline 设备诊断工具")
print("=" * 70)
print(f"ADB路径: {ADB_PATH}\n")

# Get ADB version
print("[诊断1] 检查ADB版本...")
result = subprocess.run(
    [str(ADB_PATH), "version"],
    capture_output=True,
    text=True
)
print(result.stdout.strip())
print()

# Get devices
print("[诊断2] 获取设备列表...")
result = subprocess.run(
    [str(ADB_PATH), "devices", "-l"],
    capture_output=True,
    text=True
)
print(result.stdout)

offline_devices = []
for line in result.stdout.splitlines()[1:]:
    if 'offline' in line:
        # Extract serial (first column)
        parts = line.split()
        if parts:
            serial = parts[0]
            offline_devices.append(serial)

if not offline_devices:
    print("没有offline设备")
    sys.exit(0)

print(f"发现 {len(offline_devices)} 个offline设备\n")

# Try to reconnect each offline device
print("[诊断3] 尝试重新连接offline设备...\n")

for i, serial in enumerate(offline_devices, 1):
    print(f"--- 设备 {i}/{len(offline_devices)}: {serial} ---")

    # Step 1: Disconnect
    print(f"  [1] 断开连接...")
    subprocess.run(
        [str(ADB_PATH), "disconnect", serial],
        capture_output=True
    )

    # Step 2: Wait
    import time
    time.sleep(1)

    # Step 3: Reconnect
    print(f"  [2] 重新连接...")
    result = subprocess.run(
        [str(ADB_PATH), "connect", serial],
        capture_output=True,
        text=True,
        timeout=10
    )
    print(f"      结果: {result.stdout.strip()}")

    # Step 4: Check status
    print(f"  [3] 检查状态...")
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "get-state"],
        capture_output=True,
        text=True,
        timeout=5
    )

    if result.returncode == 0:
        state = result.stdout.strip()
        print(f"      状态: {state}")

        if state == "device":
            print(f"      [成功] 设备已在线")

            # Try to get device info
            result = subprocess.run(
                [str(ADB_PATH), "-s", serial, "shell", "getprop", "ro.product.model"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                model = result.stdout.strip()
                print(f"      型号: {model}")
    else:
        error = result.stderr.strip() if result.stderr else "超时或无响应"
        print(f"      [失败] {error}")

    print()

# Final status
print("=" * 70)
print("[最终状态]")
print("=" * 70)
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)
print(result.stdout)

online_count = 0
offline_count = 0
for line in result.stdout.splitlines()[1:]:
    if 'device' in line and 'offline' not in line:
        online_count += 1
    elif 'offline' in line:
        offline_count += 1

print(f"在线: {online_count} | 离线: {offline_count}")

if offline_count > 0:
    print("\n" + "=" * 70)
    print("常见offline原因及解决方法:")
    print("=" * 70)
    print("1. ADB版本不匹配")
    print("   解决: 在设备上重启adbd服务")
    print("   命令: adb shell \"su -c 'setprop service.adb.tcp.port 5555 && stop adbd && start adbd'\"")
    print()
    print("2. 设备未授权")
    print("   解决: 通过USB连接设备，接受授权弹窗")
    print()
    print("3. 设备上adbd守护进程崩溃")
    print("   解决: 重启设备或手动重启adbd")
    print()
    print("4. 防火墙阻止")
    print("   解决: 检查设备和电脑的防火墙设置")
    print()
    print("5. 网络延迟过高")
    print("   解决: 检查网络连接，尝试使用有线连接")
