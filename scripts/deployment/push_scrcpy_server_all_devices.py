#!/usr/bin/env python3
"""Push scrcpy-server to all devices (correct filename without .jar extension)"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pycore import ColorPrint
from pycore.pyutils.device.scrcpy_init import get_initializer
from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager
from pyapps.matrix.matrix_config import Config

async def main():
    """Push scrcpy-server to all devices"""

    # Get paths
    scrcpy_init = get_initializer()
    adb_path = scrcpy_init.get_adb_path()
    jar_path = Config.get_scrcpy_server_jar()

    # Initialize server manager
    server_manager = get_scrcpy_server_manager(adb_path, jar_path)

    # Ensure local jar is valid
    if not server_manager.ensure_local_jar(auto_download=True):
        ColorPrint.red("[ERROR] Failed to ensure local scrcpy-server.jar")
        return False

    # Define all device serials (192.168.31.116-139, excluding .133 and .134)
    base_ip = "192.168.31."
    port = 5555
    excluded = {133, 134}
    device_serials = [
        f"{base_ip}{i}:{port}"
        for i in range(116, 140)
        if i not in excluded
    ]

    ColorPrint.blue(f"\n{'='*80}")
    ColorPrint.blue(f"Pushing scrcpy-server to {len(device_serials)} devices")
    ColorPrint.blue(f"{'='*80}\n")

    success_count = 0
    failed_devices = []

    for serial in device_serials:
        ColorPrint.blue(f"[{serial}] Pushing scrcpy-server...")
        try:
            # Force push to ensure correct filename (no .jar extension)
            result = await server_manager.push_jar_to_device(serial, force=True)
            if result:
                success_count += 1
                ColorPrint.green(f"[{serial}] ✓ Success")
            else:
                failed_devices.append(serial)
                ColorPrint.red(f"[{serial}] ✗ Failed")
        except Exception as e:
            failed_devices.append(serial)
            ColorPrint.red(f"[{serial}] ✗ Exception: {e}")

    ColorPrint.blue(f"\n{'='*80}")
    ColorPrint.blue(f"Summary: {success_count}/{len(device_serials)} devices succeeded")
    if failed_devices:
        ColorPrint.yellow(f"Failed devices: {', '.join(failed_devices)}")
    ColorPrint.blue(f"{'='*80}\n")

    return success_count == len(device_serials)

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
