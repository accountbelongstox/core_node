#!/usr/bin/env python3

import os
import sys
import platform
from pathlib import Path
from typing import Dict, Optional

from core.config import global_config
from core.app_manager import FlutterApp
from utils.flutter import FlutterUtility, FlutterCommandBuilder
from utils.logger import log_success, log_info, log_warning, log_error, log_cyan, log_command, log_header, log_blank

class iOSDebugger:
    """iOS platform debugging functionality"""

    def __init__(self, app: FlutterApp, action: str = "Debug"):
        self.app = app
        self.action = action
        self.project_path = global_config.flutter_project_dir

    def start_debug(self) -> str:
        """Start iOS debugging and return Flutter command"""
        log_blank()
        log_success("Starting iOS Debug Mode...")
        print("=" * 34, file=sys.stderr)

        # Display app information
        log_cyan(f"Selected App: {self.app.name}")
        log_cyan(f"Selected Action: {self.action}")
        log_cyan(f"Selected Platform: iOS")
        if self.app.entry_file:
            log_cyan(f"Entry File: {self.app.entry_file}")

        # Skip Flutter environment validation - just generate command

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

        log_cyan("Launching Flutter iOS application...")
        log_warning(f"Running in {mode_description} mode")
        if self.action.lower() == "debug":
            self._show_debug_controls()
        log_cyan(f"Entry file: {entry_file}")

        # Build Flutter command
        flutter_command = FlutterCommandBuilder.create_ios_command(
            entry_file=entry_file,
            build_mode=build_mode
        )

        log_command(flutter_command)
        return flutter_command

    def validate_platform(self) -> bool:
        """Validate iOS platform requirements"""
        if platform.system() != "Darwin":
            log_error("iOS debugging is only supported on macOS")
            log_info(f"Current platform: {platform.system()}")
            log_info("iOS development requires Xcode, which is only available on macOS")
            return False

        # Check if iOS directory exists in Flutter project
        ios_dir = self.project_path / "ios"
        if not ios_dir.exists():
            log_error("iOS platform not found in Flutter project")
            log_info("Run 'flutter create --platforms=ios .' to add iOS support")
            return False

        return True

    def _show_debug_controls(self):
        """Show debug control information"""
        log_warning("Hot reload: press 'r' in terminal")
        log_warning("Hot restart: press 'R' in terminal")
        log_warning("Quit: press 'q' in terminal")

    def get_debug_info(self) -> Dict[str, any]:
        """Get debugging information for iOS platform"""
        return {
            "platform": "ios",
            "app_name": self.app.name,
            "entry_file": self.app.entry_file,
            "supports_hot_reload": True,
            "supports_debugging": True,
            "requires_macos": True,
            "requires_xcode": True,
            "current_platform": platform.system(),
            "ios_support_available": (self.project_path / "ios").exists()
        }

    @staticmethod
    def validate_requirements() -> bool:
        """Validate iOS debugging requirements"""
        try:
            FlutterUtility.assert_flutter_environment()

            if platform.system() != "Darwin":
                log_error("iOS debugging requires macOS platform")
                return False

            return True
        except Exception as e:
            log_error(f"iOS debugging requirements not met: {e}")
            return False

    @staticmethod
    def get_platform_help() -> str:
        """Get help text for iOS platform debugging"""
        return """
iOS Platform Debugging:
- Runs Flutter app on iOS device or simulator
- Supports hot reload and debugging
- Requires macOS and Xcode
- Can target physical devices or iOS Simulator

Requirements:
- macOS (iOS development only supported on Mac)
- Xcode (latest stable version recommended)
- iOS device with development profile, OR iOS Simulator
- Flutter SDK with iOS support
- CocoaPods (usually installed with Xcode)

Setup for Physical Device:
1. Connect iOS device via USB
2. Trust the computer on iOS device
3. Enable Developer Mode in iOS Settings
4. Add Apple Developer account in Xcode
5. Create and install development profile

Setup for Simulator:
1. Install Xcode from Mac App Store
2. Open Xcode and install iOS Simulator
3. Launch desired iOS Simulator version

Controls during debugging:
- r: Hot reload
- R: Hot restart
- q: Quit debugging session

Common Commands:
- flutter devices: List available iOS devices/simulators
- flutter run -d ios: Run on iOS (will prompt for device selection)
- flutter run -d <device-id>: Run on specific device

Building for release:
- Use --release flag for App Store builds
- Requires proper code signing and provisioning profiles

Troubleshooting:
- Run 'flutter doctor' to check iOS development setup
- Ensure Xcode command line tools are installed
- Check code signing settings in Xcode
- Verify device is unlocked and trusted
        """