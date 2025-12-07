#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Android Platform Debugger
Handles Flutter Android debug operations with ADB device detection
"""

import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

from .base_debugger import BaseDebugger
from utils.print_helper import PrintHelper


class AndroidDebugger(BaseDebugger):
    """
    Android platform debugger for Flutter applications
    """

    def __init__(self, app: str, action: str, entry_file: str, debug_port: str):
        """Initialize Android debugger"""
        super().__init__(app, action, entry_file, debug_port)
        self.adb_devices = []
        self.selected_device = None

    def get_platform_name(self) -> str:
        """Get platform name for logging"""
        return "ANDROID"

    def validate_platform_requirements(self) -> bool:
        """Validate Android platform requirements"""
        try:
            PrintHelper.info("Validating Android platform requirements...", "ANDROID")

            # Check if Flutter is available
            result = self._run_command(["flutter", "--version"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter not found in PATH", "ANDROID")
                return False

            # Check if ADB is available
            result = self._run_command(["adb", "version"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("ADB not found in PATH", "ANDROID")
                PrintHelper.info("Please install Android SDK and add ADB to PATH", "ANDROID")
                return False

            PrintHelper.info("Android development tools found", "ANDROID")
            return True

        except Exception as e:
            PrintHelper.error(f"Android requirements validation failed: {e}", "ANDROID")
            return False

    def _detect_adb_devices(self) -> List[Dict[str, str]]:
        """Detect available ADB devices"""
        try:
            PrintHelper.info("Detecting Android devices...", "ANDROID")

            result = self._run_command(["adb", "devices", "-l"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Failed to detect ADB devices", "ANDROID")
                return []

            devices = []
            lines = result["stdout"].strip().split('\n')[1:]  # Skip header line

            for line in lines:
                line = line.strip()
                if not line or line.startswith('*'):
                    continue

                parts = line.split()
                if len(parts) >= 2:
                    device_id = parts[0]
                    status = parts[1]

                    # Extract device info
                    device_info = {
                        'id': device_id,
                        'status': status,
                        'model': 'Unknown',
                        'product': 'Unknown'
                    }

                    # Parse additional device information
                    for part in parts[2:]:
                        if ':' in part:
                            key, value = part.split(':', 1)
                            if key == 'model':
                                device_info['model'] = value
                            elif key == 'product':
                                device_info['product'] = value

                    devices.append(device_info)

            return devices

        except Exception as e:
            PrintHelper.error(f"Device detection failed: {e}", "ANDROID")
            return []

    def _select_device(self, devices: List[Dict[str, str]]) -> Optional[str]:
        """Select Android device for debugging"""
        if not devices:
            PrintHelper.error("No Android devices found", "ANDROID")
            PrintHelper.info("Please connect an Android device or start an emulator", "ANDROID")
            return None

        # Filter online devices
        online_devices = [d for d in devices if d['status'] == 'device']

        if not online_devices:
            PrintHelper.error("No online Android devices found", "ANDROID")
            PrintHelper.info("Device status:", "ANDROID")
            for device in devices:
                PrintHelper.info(f"  {device['id']}: {device['status']}", "ANDROID")
            return None

        # If only one device, select it automatically
        if len(online_devices) == 1:
            selected = online_devices[0]
            PrintHelper.info(f"Auto-selected device: {selected['id']} ({selected['model']})", "ANDROID")
            return selected['id']

        # Multiple devices - select first one (can be enhanced with user choice)
        selected = online_devices[0]
        PrintHelper.info(f"Multiple devices found, using: {selected['id']} ({selected['model']})", "ANDROID")
        return selected['id']

    def _setup_wireless_debugging(self) -> bool:
        """Setup wireless debugging if needed"""
        try:
            # Check if device supports wireless debugging
            if self.selected_device:
                # Enable wireless debugging mode
                result = self._run_command(
                    ["adb", "-s", self.selected_device, "tcpip", "5555"],
                    capture_output=True
                )
                if result["success"]:
                    PrintHelper.info("Wireless debugging enabled", "ANDROID")
                    return True

            return False

        except Exception as e:
            PrintHelper.warning(f"Wireless debugging setup failed: {e}", "ANDROID")
            return False

    def prepare_debug_environment(self) -> bool:
        """Prepare Android debug environment"""
        try:
            PrintHelper.info("Preparing Android debug environment...", "ANDROID")

            # Detect and select device
            devices = self._detect_adb_devices()
            self.selected_device = self._select_device(devices)

            if not self.selected_device:
                return False

            # Setup wireless debugging (optional)
            self._setup_wireless_debugging()

            # Get dependencies
            PrintHelper.info("Getting Flutter dependencies...", "ANDROID")
            result = self._run_command(["flutter", "pub", "get"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter pub get failed", "ANDROID")
                return False

            PrintHelper.success("Android debug environment prepared", "ANDROID")
            return True

        except Exception as e:
            PrintHelper.error(f"Android environment preparation failed: {e}", "ANDROID")
            return False

    def execute_debug_command(self) -> Dict[str, Any]:
        """Execute Android debug command"""
        try:
            PrintHelper.info("Starting Android debug...", "ANDROID")

            # Build Flutter command
            flutter_command = ["flutter", "run", "-d", self.selected_device]

            # Add entry point if specified
            if self.entry_file:
                flutter_command.extend(["-t", self.entry_file])

            # Add debug-specific options
            if self.action.lower() == "debug":
                flutter_command.append("--debug")
                flutter_command.append("--hot-reload")
            else:
                flutter_command.append("--release")

            PrintHelper.info(f"Starting Flutter app on device: {self.selected_device}", "ANDROID")
            PrintHelper.info("Press 'r' to hot reload, 'R' to hot restart, 'q' to quit", "ANDROID")

            # Start the debug session
            result = self._run_command(flutter_command, capture_output=False)

            if result["success"]:
                return {
                    "success": True,
                    "message": f"Android debug completed successfully on device {self.selected_device}"
                }
            else:
                return {
                    "success": False,
                    "error": f"Android debug failed (exit code: {result.get('returncode', 'unknown')})"
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"Android debug execution failed: {e}"
            }

    def get_device_info(self) -> Dict[str, Any]:
        """Get information about connected Android devices"""
        devices = self._detect_adb_devices()
        return {
            "total_devices": len(devices),
            "online_devices": len([d for d in devices if d['status'] == 'device']),
            "devices": devices
        }