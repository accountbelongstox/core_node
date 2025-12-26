#!/usr/bin/env python3
"""Check scrcpy-server files on all devices"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from pycore.pyutils.scrcpy_init import get_initializer

scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()

# All devices
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

print("=" * 80)
print("Check scrcpy-server files on all devices")
print("=" * 80)

results = []

for device in DEVICES:
    # Check if file exists
    check_result = subprocess.run(
        [str(ADB_PATH), "-s", device, "shell", "ls -lh /data/local/tmp/scrcpy-server 2>&1"],
        capture_output=True,
        text=True,
        timeout=5
    )

    if check_result.returncode == 0 and "No such file" not in check_result.stdout:
        # File exists, get size
        output = check_result.stdout.strip()
        results.append((device, "EXISTS", output))
    else:
        results.append((device, "MISSING", check_result.stdout.strip()))

print(f"\n{'Device':<25} {'Status':<15} {'Details'}")
print("-" * 80)
for device, status, details in results:
    print(f"{device:<25} {status:<15} {details}")

# Statistics
exists_count = sum(1 for _, status, _ in results if status == "EXISTS")
missing_count = len(results) - exists_count

print("=" * 80)
print(f"Total: {len(results)} devices")
print(f"File exists: {exists_count} devices")
print(f"File missing: {missing_count} devices")
print("=" * 80)
