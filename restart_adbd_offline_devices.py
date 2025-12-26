#!/usr/bin/env python3
"""
Try to restart adbd on offline devices via ADB shell
尝试通过ADB shell重启离线设备的adbd守护进程
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
print("Restart ADBD on Offline Devices")
print("=" * 70)

# Get all offline devices
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

offline_devices = []
for line in result.stdout.splitlines()[1:]:
    if 'offline' in line:
        parts = line.split()
        if parts:
            offline_devices.append(parts[0])

print(f"Found {len(offline_devices)} offline devices")

if not offline_devices:
    print("No offline devices found!")
    sys.exit(0)

print("\nAttempting to restart adbd on offline devices...")
print("This may not work if devices are truly unresponsive")
print()

success_count = 0
failed = []

for i, serial in enumerate(offline_devices, 1):
    print(f"[{i}/{len(offline_devices)}] {serial}... ", end='', flush=True)

    # Try to execute shell command
    # Even in offline state, sometimes simple commands work
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "shell",
         "su -c 'setprop service.adb.tcp.port 5555 && stop adbd && start adbd'"],
        capture_output=True,
        text=True,
        timeout=10
    )

    if result.returncode == 0:
        print("[OK]")
        success_count += 1
    else:
        print("[FAIL]")
        failed.append(serial)
        # Try alternative method
        print(f"  Trying alternative: reboot adbd...", end='', flush=True)
        result = subprocess.run(
            [str(ADB_PATH), "-s", serial, "shell", "stop adbd; start adbd"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(" [OK]")
            success_count += 1
            failed.remove(serial)
        else:
            print(" [FAIL]")

print()
print("=" * 70)
print(f"Results: {success_count}/{len(offline_devices)} succeeded")

if failed:
    print(f"\nFailed devices ({len(failed)}):")
    for serial in failed:
        print(f"  - {serial}")
    print("\nThese devices need USB activation:")
    print("  python usb_enable_network_adb.py")

# Check final status
print("\nFinal device status:")
result = subprocess.run(
    [str(ADB_PATH), "devices"],
    capture_output=True,
    text=True
)

online_count = 0
offline_count = 0

for line in result.stdout.splitlines()[1:]:
    if 'device' in line and 'offline' not in line:
        online_count += 1
    elif 'offline' in line:
        offline_count += 1

print(f"  Online: {online_count}")
print(f"  Offline: {offline_count}")

print("=" * 70)
