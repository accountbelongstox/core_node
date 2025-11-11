"""Push scrcpy-server.jar to device"""

from pathlib import Path
from pycore.pyutils.device import ADBManager

jar_path = Path("poly_apps/pyMatrix/resources/scrcpy-server.jar")
serial = "LZUWEIONHUAUHUMR"
remote_path = "/data/local/tmp/scrcpy-server.jar"

print(f"Pushing {jar_path} to {serial}:{remote_path}")
success = ADBManager.push_file(serial, jar_path, remote_path, "adb")

if success:
    print("✓ File pushed successfully")
else:
    print("❌ Failed to push file")
