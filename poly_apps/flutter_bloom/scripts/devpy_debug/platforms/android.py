#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, Optional, List

from core.config import global_config
from core.app_manager import FlutterApp
from utils.network import NetworkUtility
from utils.adb import ADBUtility
from utils.flutter import FlutterUtility, FlutterCommandBuilder
from utils.logger import log_success, log_info, log_warning, log_error, log_cyan, log_command, log_header, log_blank

class AndroidDebugger:
    """Android platform debugging functionality"""

    def __init__(self, app: FlutterApp, action: str = "Debug"):
        self.app = app
        self.action = action
        self.project_path = global_config.flutter_project_dir

    def start_debug(self) -> str:
        """Start Android debugging and return Flutter command"""
        log_blank()
        log_success("Starting Android Debug Mode...")
        print("=" * 36, file=sys.stderr)

        # Display app information
        log_cyan(f"Selected App: {self.app.name}")
        log_cyan(f"Selected Action: {self.action}")
        log_cyan(f"Selected Platform: Android")
        if self.app.entry_file:
            log_cyan(f"Entry File: {self.app.entry_file}")

        # Skip Flutter environment validation - just generate command

        # Show network URLs for wireless debugging
        NetworkUtility.show_network_urls(
            port=self.app.port,
            title="COPY URLs - Network URLs for wireless debugging",
            show_copy_hint=True
        )

        # Detect ADB devices
        adb_devices = ADBUtility.get_adb_devices()
        ADBUtility.show_adb_device_info(adb_devices)

        if not adb_devices:
            log_success("You can still use wireless debugging with URLs above")

        log_success("Starting Flutter for Android debugging...")

        # Use app entry file or fallback to default
        entry_file_path = Path(self.app.entry_file)
        if not entry_file_path.exists():
            log_warning(f"Entry file not found: {self.app.entry_file}")
            log_info("Using default main.dart entry")
            entry_file = str(self.project_path / "lib" / "main.dart")
        else:
            entry_file = self.app.entry_file

        # Determine build mode
        build_mode = "--release" if self.action.lower() == "build" else "--debug"
        mode_description = "Release" if self.action.lower() == "build" else "Debug"

        # Build Flutter command based on device availability
        if adb_devices:
            # Select device
            device_id = self._select_device(adb_devices)
            if device_id:
                log_cyan("Launching on connected Android device...")
                log_warning(f"Running in {mode_description} mode")
                if self.action.lower() == "debug":
                    self._show_debug_controls()
                log_cyan(f"Entry file: {entry_file}")
                log_cyan(f"Using device: {device_id}")

                flutter_command = FlutterCommandBuilder.create_android_command(
                    entry_file=entry_file,
                    device_id=device_id,
                    build_mode=build_mode
                )
            else:
                log_error("No device selected")
                return ""
        else:
            log_cyan("No physical device detected, checking for emulator...")
            log_warning(f"Running in {mode_description} mode")
            if self.action.lower() == "debug":
                self._show_debug_controls()
            log_cyan(f"Entry file: {entry_file}")

            flutter_command = FlutterCommandBuilder.create_android_command(
                entry_file=entry_file,
                build_mode=build_mode
            )

        log_command(flutter_command)
        return flutter_command

    def _select_device(self, devices: List[Dict[str, str]]) -> Optional[str]:
        """Select Android device for debugging"""
        if len(devices) == 1:
            return devices[0]["ID"]

        # For automated selection, use first available device
        # In interactive mode, this would prompt user
        available_devices = [d for d in devices if d["Status"] == "device"]
        if available_devices:
            selected_device = available_devices[0]["ID"]
            log_info(f"Auto-selected device: {selected_device}")
            return selected_device

        # Use first device regardless of status
        if devices:
            selected_device = devices[0]["ID"]
            log_warning(f"Using device with status '{devices[0]['Status']}': {selected_device}")
            return selected_device

        return None

    def _show_debug_controls(self):
        """Show debug control information"""
        log_warning("Hot reload: press 'r'")
        log_warning("Hot restart: press 'R'")
        log_warning("Quit: press 'q'")

    def get_debug_info(self) -> Dict[str, any]:
        """Get debugging information for Android platform"""
        return {
            "platform": "android",
            "app_name": self.app.name,
            "entry_file": self.app.entry_file,
            "port": self.app.port,
            "supports_hot_reload": True,
            "supports_debugging": True,
            "requires_device": True,
            "adb_available": ADBUtility.is_adb_available(),
            "connected_devices": ADBUtility.get_adb_devices()
        }

    @staticmethod
    def validate_requirements() -> bool:
        """Validate Android debugging requirements"""
        try:
            FlutterUtility.assert_flutter_environment()
            # ADB is optional - can work with emulators
            return True
        except Exception as e:
            log_error(f"Android debugging requirements not met: {e}")
            return False

    @staticmethod
    def get_platform_help() -> str:
        """Get help text for Android platform debugging"""
        return """
Android Platform Debugging:
- Runs Flutter app on Android device/emulator
- Supports hot reload and debugging
- Requires Android device or emulator
- Can use physical device or Android Virtual Device (AVD)

Requirements:
- Flutter SDK with Android support
- Android device with USB debugging enabled, OR
- Android emulator running
- ADB (Android Debug Bridge) - optional but recommended

Setup:
1. Enable Developer Options on Android device
2. Enable USB Debugging in Developer Options
3. Connect device via USB or start Android emulator
4. Accept USB debugging permission on device

Controls during debugging:
- r: Hot reload
- R: Hot restart
- q: Quit debugging session

Troubleshooting:
- If no devices detected, try 'adb devices' command
- Restart ADB server with 'adb kill-server' then 'adb start-server'
- Check USB cable and debugging permissions
        """