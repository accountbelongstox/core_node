#!/usr/bin/env python3
"""
Push scrcpy-server.jar to all online devices using FIXED double-slash path
"""
import subprocess
import sys
from pathlib import Path

# Make pycore importable so ADB resolves via the centralized system_paths
# module (D:\programing\Users\<user>\.core_node\scrcpy\adb.exe on Windows).
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
from pycore.pyfoundations.system_paths import get_system_cache_dir

# Configuration
ADB = str(get_system_cache_dir() / 'scrcpy' / 'adb.exe')
JAR_PATH = Path(__file__).parent / "pyapps" / "matrix" / "resources" / "scrcpy-server.jar"

# CRITICAL: Use //data/local/tmp/ to prevent Git Bash path translation
DEVICE_PATH = "//data/local/tmp/scrcpy-server.jar"

def get_devices():
    """Get all online devices"""
    result = subprocess.run(
        [ADB, "devices"],
        capture_output=True,
        text=True
    )

    devices = []
    for line in result.stdout.splitlines()[1:]:  # Skip header
        if '\tdevice' in line:
            serial = line.split('\t')[0]
            devices.append(serial)

    return devices

def push_to_device(serial):
    """Push jar to single device"""
    print(f"\n{'='*60}")
    print(f"[{serial}] Pushing jar file...")
    print(f"{'='*60}")

    # Push jar file
    print(f"[{serial}] Pushing jar (using double-slash path)...")
    push_result = subprocess.run(
        [ADB, "-s", serial, "push", str(JAR_PATH), DEVICE_PATH],
        capture_output=True,
        text=True,
        timeout=15
    )

    if push_result.returncode != 0:
        print(f"[{serial}] PUSH FAILED:")
        print(push_result.stderr)
        return False

    print(f"[{serial}] Push successful")
    print(push_result.stdout.strip())

    # Verify file exists
    print(f"\n[{serial}] Verifying file exists...")
    verify_result = subprocess.run(
        [ADB, "-s", serial, "shell", "ls -la /data/local/tmp/scrcpy-server.jar"],
        capture_output=True,
        text=True,
        timeout=5
    )

    if verify_result.returncode != 0:
        print(f"[{serial}] VERIFICATION FAILED:")
        print(verify_result.stderr)
        return False

    print(f"[{serial}] File exists:")
    print(verify_result.stdout.strip())

    return True

def main():
    """Main function"""
    print("="*60)
    print("Push scrcpy-server.jar to All Devices (FIXED)")
    print("="*60)

    # Check jar file exists
    if not JAR_PATH.exists():
        print(f"ERROR: jar file not found at {JAR_PATH}")
        sys.exit(1)

    print(f"Local jar file: {JAR_PATH}")
    print(f"Target device path: {DEVICE_PATH}")
    print(f"Using double-slash to prevent Git Bash translation\n")

    # Get all devices
    devices = get_devices()
    if not devices:
        print("No devices found!")
        sys.exit(1)

    print(f"Found {len(devices)} device(s):")
    for serial in devices:
        print(f"  - {serial}")
    print()

    # Push to all devices
    success_count = 0
    fail_count = 0

    for serial in devices:
        try:
            if push_to_device(serial):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"[{serial}] EXCEPTION: {e}")
            fail_count += 1

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Success: {success_count}/{len(devices)}")
    print(f"Failed:  {fail_count}/{len(devices)}")

    if success_count == len(devices):
        print("\nAll devices updated successfully!")
        print("\nNext step: RESTART your Matrix application to load new code")
    else:
        print(f"\n{fail_count} device(s) failed. Check errors above.")

if __name__ == "__main__":
    main()
