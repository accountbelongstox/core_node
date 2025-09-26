#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, Optional

from core.config import global_config
from core.app_manager import FlutterApp
from utils.network import NetworkUtility
from utils.flutter import FlutterUtility, FlutterCommandBuilder
from utils.logger import log_success, log_info, log_warning, log_error, log_cyan, log_command, log_header, log_blank

class WebDebugger:
    """Web platform debugging functionality"""

    def __init__(self, app: FlutterApp, action: str = "Debug"):
        self.app = app
        self.action = action
        self.project_path = global_config.flutter_project_dir

    def start_debug(self) -> str:
        """Start web debugging and return Flutter command"""
        log_blank()
        log_success("Starting Web Debug Mode...")
        print("=" * 35, file=sys.stderr)

        # Display app information
        log_cyan(f"Selected App: {self.app.name}")
        log_cyan(f"Selected Action: {self.action}")
        log_cyan(f"Selected Platform: Web")
        log_cyan(f"Entry File: {self.app.entry_file}")
        log_cyan(f"Debug Port: {self.app.port}")

        # Skip Flutter environment validation - just generate command

        # Display network URLs for testing
        NetworkUtility.show_network_urls(
            port=self.app.port,
            title="COPY URLs - Available Network URLs",
            show_copy_hint=True
        )

        log_success("URLs are ready for copying to test on different devices")
        log_info(f"Starting Flutter web server on port {self.app.port}...")
        log_info("Chrome will open automatically, or manually copy URLs above")

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

        # Build Flutter command
        flutter_command = FlutterCommandBuilder.create_web_command(
            entry_file=entry_file,
            port=self.app.port,
            hostname="0.0.0.0",
            build_mode=build_mode
        )

        log_info("Launching Flutter web server (accessible from network)...")
        log_info(f"Running in {mode_description} mode")
        log_info(f"Entry file: {entry_file}")
        log_command(flutter_command)

        return flutter_command

    def get_debug_info(self) -> Dict[str, any]:
        """Get debugging information for web platform"""
        return {
            "platform": "web",
            "app_name": self.app.name,
            "entry_file": self.app.entry_file,
            "port": self.app.port,
            "hostname": "0.0.0.0",
            "supports_hot_reload": True,
            "supports_network_access": True,
            "network_ips": NetworkUtility.get_network_ips()
        }

    @staticmethod
    def validate_requirements() -> bool:
        """Validate web debugging requirements"""
        try:
            FlutterUtility.assert_flutter_environment()
            return True
        except Exception as e:
            log_error(f"Web debugging requirements not met: {e}")
            return False

    @staticmethod
    def get_platform_help() -> str:
        """Get help text for web platform debugging"""
        return """
Web Platform Debugging:
- Runs Flutter app in web browser
- Accessible from network (0.0.0.0 binding)
- Supports hot reload (press 'r' in terminal)
- Supports hot restart (press 'R' in terminal)
- Chrome will open automatically
- Network URLs provided for testing on other devices

Requirements:
- Flutter SDK installed
- Chrome or compatible browser
- Valid Flutter web project

Controls during debugging:
- r: Hot reload
- R: Hot restart
- q: Quit debugging session
        """