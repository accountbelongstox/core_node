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

class WindowsDebugger:
    """Windows platform debugging functionality"""

    def __init__(self, app: FlutterApp, action: str = "Debug"):
        self.app = app
        self.action = action
        self.project_path = global_config.flutter_project_dir

    def start_debug(self) -> str:
        """Start Windows debugging and return Flutter command"""
        log_blank()
        log_success("Starting Windows Debug Mode...")
        print("=" * 38, file=sys.stderr)

        # Display app information
        log_cyan(f"Selected App: {self.app.name}")
        log_cyan(f"Selected Action: {self.action}")
        log_cyan(f"Selected Platform: Windows")
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

        log_cyan("Launching Flutter Windows application...")
        log_warning(f"Running in {mode_description} mode")
        if self.action.lower() == "debug":
            self._show_debug_controls()
        log_cyan(f"Entry file: {entry_file}")

        # Build Flutter command
        flutter_command = FlutterCommandBuilder.create_windows_command(
            entry_file=entry_file,
            build_mode=build_mode
        )

        log_command(flutter_command)
        return flutter_command

    def validate_platform(self) -> bool:
        """Validate Windows platform requirements"""
        if platform.system() != "Windows":
            log_error("Windows debugging is only supported on Windows platform")
            log_info(f"Current platform: {platform.system()}")
            return False

        # Check if windows directory exists in Flutter project
        windows_dir = self.project_path / "windows"
        if not windows_dir.exists():
            log_error("Windows platform not found in Flutter project")
            log_info("Run 'flutter create --platforms=windows .' to add Windows support")
            return False

        return True

    def _show_debug_controls(self):
        """Show debug control information"""
        log_warning("Hot reload: press 'r' in terminal")
        log_warning("Hot restart: press 'R' in terminal")
        log_warning("Quit: press 'q' in terminal")

    def get_debug_info(self) -> Dict[str, any]:
        """Get debugging information for Windows platform"""
        return {
            "platform": "windows",
            "app_name": self.app.name,
            "entry_file": self.app.entry_file,
            "supports_hot_reload": True,
            "supports_debugging": True,
            "requires_windows": True,
            "current_platform": platform.system(),
            "windows_support_available": (self.project_path / "windows").exists()
        }

    @staticmethod
    def validate_requirements() -> bool:
        """Validate Windows debugging requirements"""
        try:
            FlutterUtility.assert_flutter_environment()

            if platform.system() != "Windows":
                log_error("Windows debugging requires Windows platform")
                return False

            return True
        except Exception as e:
            log_error(f"Windows debugging requirements not met: {e}")
            return False

    @staticmethod
    def get_platform_help() -> str:
        """Get help text for Windows platform debugging"""
        return """
Windows Platform Debugging:
- Runs Flutter app as native Windows application
- Supports hot reload and debugging
- Requires Windows operating system
- Creates .exe executable for distribution

Requirements:
- Flutter SDK with Windows desktop support
- Windows 10 version 1903 or higher
- Visual Studio 2022 or Visual Studio Build Tools 2022
- Windows 10/11 SDK

Setup:
1. Install Visual Studio with C++ development tools
2. Enable Windows desktop development in Flutter:
   flutter config --enable-windows-desktop
3. Add Windows platform to project:
   flutter create --platforms=windows .

Controls during debugging:
- r: Hot reload
- R: Hot restart
- q: Quit debugging session

Building for release:
- Use --release flag for optimized build
- Output will be in build/windows/runner/Release/

Troubleshooting:
- Ensure Visual Studio C++ tools are installed
- Check Windows SDK version compatibility
- Run 'flutter doctor' to verify Windows desktop setup
        """