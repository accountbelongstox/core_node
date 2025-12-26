#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demonstrate how to get scrcpy command

This script shows how Matrix builds the scrcpy-server command
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.server_params import ServerParams, VideoCodec
from pyapps.matrix.matrix_config import Config

def show_scrcpy_command():
    """Show scrcpy command building process"""

    print("=" * 70)
    print("Matrix - Scrcpy Command Builder")
    print("=" * 70)

    # 1. Configuration
    print("\n1. Configuration:")
    print(f"   scrcpy-server JAR: {Config.SCRCPY_SERVER_JAR}")
    print(f"   scrcpy version: {Config.SCRCPY_SERVER_VERSION}")
    print(f"   ADB path: {Config.get_adb_path()}")

    # 2. Server parameters
    print("\n2. Server Parameters:")
    params = ServerParams(
        max_size=Config.DEFAULT_MAX_SIZE,
        bit_rate=Config.DEFAULT_BIT_RATE,
        max_fps=Config.DEFAULT_MAX_FPS,
        codec=VideoCodec(Config.DEFAULT_CODEC),
        control=True,
        locked_video_orientation=-1
    )

    print(f"   Max size: {params.max_size}")
    print(f"   Bit rate: {params.bit_rate} ({params.bit_rate / 1_000_000} Mbps)")
    print(f"   Max FPS: {params.max_fps}")
    print(f"   Codec: {params.codec.value}")
    print(f"   Control: {params.control}")
    print(f"   Locked orientation: {params.locked_video_orientation} (-1=auto)")

    # 3. Create device instance (example)
    print("\n3. Create ScrcpyDevice Instance:")
    example_serial = "EXAMPLE_DEVICE_SERIAL"
    device = ScrcpyDevice(example_serial, params, Config.get_adb_path())
    print(f"   Device serial: {example_serial}")

    # 4. Build command
    print("\n4. Build scrcpy-server Command:")
    example_scid = 0x1a2b3c4d  # Example Session ID
    server_cmd = device._build_server_command(example_scid)

    print(f"   Session ID (SCID): {example_scid:08x}")
    print(f"\n   Shell command arguments:")
    for i, arg in enumerate(server_cmd):
        print(f"      [{i}] {arg}")

    # 5. Full ADB command
    print("\n5. Full ADB Command:")
    adb_cmd = [
        Config.get_adb_path(),
        "-s", example_serial,
        "shell",
        *server_cmd
    ]

    full_command = ' '.join(adb_cmd)
    print(f"\n   {full_command}")

    # 6. One-line version (easy to copy)
    print("\n6. One-Line Version (easy to copy):")
    shell_command_only = ' '.join(server_cmd)
    print(f"\n   adb -s <DEVICE_SERIAL> shell {shell_command_only}")

    # 7. Usage example
    print("\n" + "=" * 70)
    print("Usage Steps:")
    print("=" * 70)
    print("\n1. Push scrcpy-server.jar to device:")
    print(f"   adb push {Config.SCRCPY_SERVER_JAR} /data/local/tmp/")
    print("\n2. Find device serial:")
    print("   adb devices")
    print("\n3. Replace <DEVICE_SERIAL> with actual serial and run:")
    print("   (command shown above)")
    print("\n4. Or use Matrix DeviceManager:")
    print("   from pycore.pyutils.device_manager import DeviceManager")
    print("   manager = DeviceManager.instance()")
    print("   device = await manager.connect_device('DEVICE_SERIAL')")
    print("\n" + "=" * 70)

    # 8. Parameter explanation
    print("\nParameter Explanation:")
    print("=" * 70)
    print(f"  max_size={params.max_size}")
    print("    - Limit the maximum resolution of the short side")
    print("    - Example: 720 means short side max 720px (720x1280 or 1280x720)")
    print()
    print(f"  max_fps={params.max_fps}")
    print("    - Limit maximum frame rate")
    print("    - Example: 60 means max 60fps")
    print()
    print(f"  video_bit_rate={params.bit_rate}")
    print("    - Video bit rate (affects quality and bandwidth)")
    print(f"    - Example: {params.bit_rate} = {params.bit_rate / 1_000_000} Mbps")
    print()
    print(f"  video_codec={params.codec.value}")
    print("    - Video codec")
    print("    - Options: h264, h265, av1")
    print()
    print("  log_level=debug")
    print("    - Log level")
    print("    - Options: verbose, debug, info, warn, error")
    print()
    print("  audio=false")
    print("    - Audio streaming (currently disabled in Matrix)")
    print()
    print(f"  scid={example_scid:08x}")
    print("    - Session ID (randomly generated each time)")
    print("    - Used to distinguish different scrcpy sessions")

    print("\n" + "=" * 70)
    print("Tips:")
    print("=" * 70)
    print("* SCID is randomly generated (31-bit random number) in production")
    print("* Matrix uses REVERSE tunnel mode (more reliable)")
    print("* See full docs: pyapps/matrix/docs/SCRCPY_INITIALIZATION.md")
    print("=" * 70)

if __name__ == "__main__":
    show_scrcpy_command()
