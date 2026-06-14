#!/usr/bin/env python3
"""
Diagnose ADB Offline Devices
"""
import subprocess
import sys
import time
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from pycore.pyutils.device.scrcpy_init import get_initializer

# Get ADB path
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

print("=" * 70)
print("ADB Offline Device Diagnostic Tool")
print("=" * 70)
print(f"ADB Path: {ADB_PATH}\n")

# Get ADB version
print("[Diagnosis 1] Checking ADB version...")
result = subprocess.run(
    [str(ADB_PATH), "version"],
    capture_output=True,
    text=True
)
print(result.stdout.strip())
print()

# Get devices
print("[Diagnosis 2] Getting device list...")
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
    print("No offline devices found")
    sys.exit(0)

print(f"Found {len(offline_devices)} offline device(s)\n")

# Try to reconnect each offline device
print("[Diagnosis 3] Attempting to reconnect offline devices...\n")

for i, serial in enumerate(offline_devices, 1):
    print(f"--- Device {i}/{len(offline_devices)}: {serial} ---")

    # Step 1: Disconnect
    print(f"  [1] Disconnecting...")
    subprocess.run(
        [str(ADB_PATH), "disconnect", serial],
        capture_output=True
    )

    # Step 2: Wait
    time.sleep(1)

    # Step 3: Reconnect
    print(f"  [2] Reconnecting...")
    result = subprocess.run(
        [str(ADB_PATH), "connect", serial],
        capture_output=True,
        text=True,
        timeout=10
    )
    print(f"      Result: {result.stdout.strip()}")

    # Step 4: Check status
    print(f"  [3] Checking status...")
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "get-state"],
        capture_output=True,
        text=True,
        timeout=5
    )

    if result.returncode == 0:
        state = result.stdout.strip()
        print(f"      Status: {state}")

        if state == "device":
            print(f"      [SUCCESS] Device is online")

            # Try to get device info
            result = subprocess.run(
                [str(ADB_PATH), "-s", serial, "shell", "getprop", "ro.product.model"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                model = result.stdout.strip()
                print(f"      Model: {model}")
    else:
        error = result.stderr.strip() if result.stderr else "Timeout or no response"
        print(f"      [FAILED] {error}")

    print()

# Final status
print("=" * 70)
print("[Final Status]")
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

print(f"Online: {online_count} | Offline: {offline_count}")

if offline_count > 0:
    print("\n" + "=" * 70)
    print("Common Offline Causes and Solutions:")
    print("=" * 70)
    print("1. ADB version mismatch")
    print("   Solution: Restart adbd service on device")
    print("   Command: adb shell \"su -c 'setprop service.adb.tcp.port 5555 && stop adbd && start adbd'\"")
    print()
    print("2. Device not authorized")
    print("   Solution: Connect device via USB and accept authorization popup")
    print()
    print("3. adbd daemon crashed on device")
    print("   Solution: Restart device or manually restart adbd")
    print()
    print("4. Firewall blocking")
    print("   Solution: Check firewall settings on both device and computer")
    print()
    print("5. High network latency")
    print("   Solution: Check network connection, try using wired connection")
