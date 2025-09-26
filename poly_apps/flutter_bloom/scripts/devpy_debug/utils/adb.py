#!/usr/bin/env python3

import subprocess
import sys
from typing import List, Dict, Optional

class ADBUtility:
    """ADB (Android Debug Bridge) utilities for Android debugging"""

    @staticmethod
    def is_adb_available() -> bool:
        """Check if ADB is available in the system PATH"""
        try:
            result = subprocess.run(['adb', 'version'], capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
            return False

    @staticmethod
    def get_adb_devices() -> List[Dict[str, str]]:
        """Get list of connected ADB devices"""
        if not ADBUtility.is_adb_available():
            return []

        try:
            result = subprocess.run(['adb', 'devices'], capture_output=True, text=True, timeout=10)
            devices = []

            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')[1:]  # Skip header line
                for line in lines:
                    line = line.strip()
                    if line and '\t' in line:
                        device_id, status = line.split('\t', 1)
                        devices.append({
                            "ID": device_id,
                            "Status": status,
                            "Info": f"{device_id} ({status})"
                        })

            return devices

        except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
            print(f"[WARNING] Failed to get ADB devices: {e}", file=sys.stderr)
            return []

    @staticmethod
    def get_device_info(device_id: str) -> Optional[Dict[str, str]]:
        """Get detailed information about a specific device"""
        if not ADBUtility.is_adb_available():
            return None

        try:
            # Get device properties
            result = subprocess.run(
                ['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'],
                capture_output=True, text=True, timeout=10
            )

            if result.returncode == 0:
                model = result.stdout.strip()
                return {
                    "id": device_id,
                    "model": model,
                    "info": f"{device_id} - {model}"
                }
        except Exception as e:
            print(f"[WARNING] Failed to get device info for {device_id}: {e}", file=sys.stderr)

        return {"id": device_id, "model": "Unknown", "info": device_id}

    @staticmethod
    def show_adb_device_info(devices: List[Dict[str, str]]):
        """Display ADB device information"""
        print("", file=sys.stderr)
        print("[ADB] Device Detection Results:", file=sys.stderr)
        print("=" * 40, file=sys.stderr)

        if not devices:
            if ADBUtility.is_adb_available():
                print("  No ADB devices detected", file=sys.stderr)
                print("  Make sure USB debugging is enabled on your device", file=sys.stderr)
            else:
                print("  ADB is not available in PATH", file=sys.stderr)
                print("  Install Android SDK platform-tools to enable ADB", file=sys.stderr)
        else:
            print(f"  Found {len(devices)} device(s):", file=sys.stderr)
            for i, device in enumerate(devices, 1):
                status_color = "✓" if device["Status"] == "device" else "⚠"
                print(f"    {i}. {status_color} {device['Info']}", file=sys.stderr)
        print("", file=sys.stderr)

    @staticmethod
    def select_device(devices: List[Dict[str, str]]) -> Optional[str]:
        """Interactive device selection for multiple devices"""
        if not devices:
            return None

        if len(devices) == 1:
            return devices[0]["ID"]

        print("[INFO] Multiple devices detected. Select device:", file=sys.stderr)
        for i, device in enumerate(devices):
            print(f"  {i + 1}. {device['Info']}", file=sys.stderr)

        while True:
            try:
                selection = input(f"Enter device number (1-{len(devices)}): ")
                index = int(selection) - 1
                if 0 <= index < len(devices):
                    return devices[index]["ID"]
                else:
                    print(f"[ERROR] Invalid selection. Please enter 1-{len(devices)}", file=sys.stderr)
            except ValueError:
                print("[ERROR] Invalid input. Please enter a number.", file=sys.stderr)
            except KeyboardInterrupt:
                return None

    @staticmethod
    def kill_adb_server():
        """Kill ADB server (useful for troubleshooting connection issues)"""
        if ADBUtility.is_adb_available():
            try:
                subprocess.run(['adb', 'kill-server'], capture_output=True, timeout=10)
                print("[INFO] ADB server killed", file=sys.stderr)
            except Exception as e:
                print(f"[WARNING] Failed to kill ADB server: {e}", file=sys.stderr)

    @staticmethod
    def start_adb_server():
        """Start ADB server"""
        if ADBUtility.is_adb_available():
            try:
                subprocess.run(['adb', 'start-server'], capture_output=True, timeout=10)
                print("[INFO] ADB server started", file=sys.stderr)
            except Exception as e:
                print(f"[WARNING] Failed to start ADB server: {e}", file=sys.stderr)