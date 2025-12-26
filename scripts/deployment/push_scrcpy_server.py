"""
Push scrcpy-server to device and test
"""
import subprocess
from pycore.pyutils.scrcpy_init import get_adb_path
from pathlib import Path

adb = str(get_adb_path())
device = "192.168.31.116:5555"

# Find scrcpy-server
scrcpy_server = Path("D:/.tmp/Users/MyBest11/.core_node/scrcpy/scrcpy-server")

if not scrcpy_server.exists():
    print(f"ERROR: scrcpy-server not found at {scrcpy_server}")
    exit(1)

print(f"Found scrcpy-server: {scrcpy_server}")
print(f"File size: {scrcpy_server.stat().st_size} bytes")
print(f"Pushing to device: {device}")
print()

# Push file
# CRITICAL: Use //data/local/tmp/ to prevent Git Bash path translation on Windows
result = subprocess.run(
    [adb, '-s', device, 'push', str(scrcpy_server), '//data/local/tmp/scrcpy-server.jar'],
    capture_output=True,
    text=True
)

print(f"Push result: {result.returncode}")
if result.stdout:
    print(f"STDOUT: {result.stdout}")
if result.stderr:
    print(f"STDERR: {result.stderr}")

# Verify push
print("\nVerifying...")
result = subprocess.run(
    [adb, '-s', device, 'shell', 'ls', '-lh', '/data/local/tmp/scrcpy-server.jar'],
    capture_output=True,
    text=True
)
print(f"Verification: {result.stdout if result.stdout else result.stderr}")

print("\nDone! Now you can test with your application.")
