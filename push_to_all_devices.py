"""
Push scrcpy-server.jar to all 19 devices and prepare for testing
"""
import subprocess
from pathlib import Path
from pycore.pyutils.scrcpy_init import get_adb_path

adb = str(get_adb_path())
scrcpy_server = Path("D:/.tmp/Users/MyBest11/.core_node/scrcpy/scrcpy-server")

# All 19 devices
devices = [f"192.168.31.{100 + i}:5555" for i in range(16, 40)]  # 116-139

print("="*60)
print("PUSHING scrcpy-server.jar TO ALL 19 DEVICES")
print("="*60)
print(f"Source: {scrcpy_server}")
print(f"Size: {scrcpy_server.stat().st_size} bytes")
print()

success_count = 0
failed_devices = []

for device in devices:
    print(f"Pushing to {device}... ", end='', flush=True)

    result = subprocess.run(
        [adb, '-s', device, 'push', str(scrcpy_server), '/data/local/tmp/scrcpy-server.jar'],
        capture_output=True,
        text=True,
        timeout=10
    )

    if result.returncode == 0:
        print("OK")
        success_count += 1
    else:
        print(f"FAILED: {result.stderr.strip()}")
        failed_devices.append(device)

print()
print("="*60)
print(f"PUSH COMPLETE: {success_count}/{len(devices)} successful")
print("="*60)

if failed_devices:
    print("\nFailed devices:")
    for device in failed_devices:
        print(f"  - {device}")
else:
    print("\n[SUCCESS] ALL DEVICES READY FOR TESTING")

print("\nNow you can test your Matrix application with all 19 devices!")
