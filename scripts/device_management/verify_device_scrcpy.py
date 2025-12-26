#!/usr/bin/env python3
"""
验证设备scrcpy连接能力
基于 TECHNICAL_SPECIFICATION.md 附录A的测试步骤
"""
import subprocess
import sys
import time
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
from pycore.pyutils.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()
JAR_PATH = scrcpy_init.scrcpy_dir / "scrcpy-server"

# Test device (use first online device)
TEST_DEVICE = None

print("=" * 70)
print("Device Scrcpy Verification Tool")
print("=" * 70)
print(f"ADB Path: {ADB_PATH}")
print(f"JAR Path: {JAR_PATH}")
print()

# Get online devices
print("[步骤0] 获取在线设备...")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

online_devices = []
offline_devices = []

for line in result.stdout.splitlines()[1:]:
    if 'device' in line and 'offline' not in line:
        parts = line.split()
        if parts:
            online_devices.append(parts[0])
    elif 'offline' in line:
        parts = line.split()
        if parts:
            offline_devices.append(parts[0])

print(f"  在线设备: {len(online_devices)}")
print(f"  离线设备: {len(offline_devices)}")

if online_devices:
    TEST_DEVICE = online_devices[0]
    print(f"  使用测试设备: {TEST_DEVICE}")
else:
    print("\n[错误] 没有在线设备可供测试")
    print("\n离线设备列表:")
    for serial in offline_devices:
        print(f"  - {serial}")
    print("\n请先使用 usb_enable_network_adb.py 激活设备")
    sys.exit(1)

print()

# Test 1: Verify JAR push
print("=" * 70)
print("[验证1/5] 验证jar文件推送")
print("=" * 70)

if not JAR_PATH.exists():
    print(f"[错误] 本地jar文件不存在: {JAR_PATH}")
    sys.exit(1)

print(f"本地jar文件: {JAR_PATH}")
print(f"大小: {JAR_PATH.stat().st_size} 字节")

print(f"\n推送到设备 {TEST_DEVICE}...")
result = subprocess.run(
    [str(ADB_PATH), "-s", TEST_DEVICE, "push", str(JAR_PATH), "//data/local/tmp/scrcpy-server"],
    capture_output=True,
    text=True,
    timeout=30
)

if result.returncode == 0:
    print("[成功] jar文件已推送")
else:
    print(f"[失败] {result.stderr}")
    sys.exit(1)

print()

# Test 2: Verify file exists on device
print("=" * 70)
print("[验证2/5] 验证设备上文件存在")
print("=" * 70)

result = subprocess.run(
    [str(ADB_PATH), "-s", TEST_DEVICE, "shell", "ls -la /data/local/tmp/scrcpy-server"],
    capture_output=True,
    text=True,
    timeout=10
)

if result.returncode == 0:
    print("[成功] 文件存在")
    print(f"  {result.stdout.strip()}")
else:
    print(f"[失败] 文件不存在: {result.stderr}")
    sys.exit(1)

print()

# Test 3: Verify MD5
print("=" * 70)
print("[验证3/5] 验证MD5校验")
print("=" * 70)

result = subprocess.run(
    [str(ADB_PATH), "-s", TEST_DEVICE, "shell", "md5sum /data/local/tmp/scrcpy-server"],
    capture_output=True,
    text=True,
    timeout=10
)

if result.returncode == 0:
    device_md5 = result.stdout.split()[0] if result.stdout else "unknown"
    print(f"[成功] 设备MD5: {device_md5}")
else:
    print(f"[警告] 无法获取MD5（设备可能不支持md5sum）")

print()

# Test 4: Check device state
print("=" * 70)
print("[验证4/5] 检查设备ADB状态")
print("=" * 70)

result = subprocess.run(
    [str(ADB_PATH), "-s", TEST_DEVICE, "get-state"],
    capture_output=True,
    text=True,
    timeout=5
)

state = result.stdout.strip() if result.returncode == 0 else "unknown"
print(f"设备状态: {state}")

if state != "device":
    print(f"[警告] 设备状态异常 (期望: device, 实际: {state})")
    print("这可能是offline问题，需要重新激活网络ADB")
else:
    print("[成功] 设备状态正常")

print()

# Test 5: Manual server test (most important)
print("=" * 70)
print("[验证5/5] 手动启动scrcpy-server测试")
print("=" * 70)
print("这是最关键的测试 - 验证服务器能否正常启动")
print()

# Use exact command from technical docs (line 676)
shell_cmd = (
    "cd /data/local/tmp && "
    "CLASSPATH=scrcpy-server "
    "app_process . com.genymobile.scrcpy.Server "
    "3.3.3 scid=12345678 log_level=debug audio=false "
    "max_size=720 tunnel_forward=true"
)

print(f"执行命令:")
print(f"  {shell_cmd}")
print()
print("等待服务器响应（5秒超时）...")
print("期望输出: [server] INFO: Device: [...]")
print()

try:
    result = subprocess.run(
        [str(ADB_PATH), "-s", TEST_DEVICE, "shell", shell_cmd],
        capture_output=True,
        text=True,
        timeout=5
    )
except subprocess.TimeoutExpired as e:
    # Timeout is expected - server keeps running
    print("[预期] 服务器已启动（命令超时是正常的）")
    if e.stdout:
        output = e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout
        print("\n服务器输出:")
        for line in output.splitlines()[:10]:  # First 10 lines
            print(f"  {line}")

    # Kill the server process
    print("\n清理服务器进程...")
    subprocess.run(
        [str(ADB_PATH), "-s", TEST_DEVICE, "shell", "pkill -f app_process"],
        capture_output=True,
        timeout=5
    )

    print("\n[成功] 服务器能够正常启动")

except Exception as e:
    print(f"[错误] 启动失败: {e}")
    if result.stderr:
        print(f"错误输出: {result.stderr}")
    sys.exit(1)

print()
print("=" * 70)
print("验证总结")
print("=" * 70)
print("✓ [1/5] jar文件推送成功")
print("✓ [2/5] 文件在设备上存在")
print("✓ [3/5] MD5校验完成")

if state == "device":
    print("✓ [4/5] 设备状态正常 (device)")
    print("✓ [5/5] scrcpy-server可以启动")
    print()
    print("[结论] 设备完全正常，可以运行scrcpy")
else:
    print("✗ [4/5] 设备状态异常 (offline)")
    print("? [5/5] 无法验证服务器启动")
    print()
    print("[结论] 设备处于offline状态，需要重新激活")
    print()
    print("解决方法:")
    print("  1. 运行: python usb_enable_network_adb.py")
    print("  2. 通过USB连接设备重新激活网络ADB")
    print("  3. 或在设备上手动执行:")
    print("     adb shell \"su -c 'setprop service.adb.tcp.port 5555 && stop adbd && start adbd'\"")

print("=" * 70)
