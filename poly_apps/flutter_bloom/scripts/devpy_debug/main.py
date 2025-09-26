#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Optional

# Add current directory to Python path for imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Import core modules
from core.config import global_config
from core.app_manager import FlutterAppManager
from core.file_manager import DebugSessionManager

# Import platform debuggers
from platforms.web import WebDebugger
from platforms.android import AndroidDebugger
from platforms.windows import WindowsDebugger
from platforms.ios import iOSDebugger

# Import utilities
from utils.logger import log_success, log_info, log_warning, log_error, log_cyan, log_header, log_blank

class FlutterDebugController:
    """Main controller for Flutter debugging operations"""

    def __init__(self):
        self.app_manager = FlutterAppManager(global_config.flutter_project_dir)
        self.session_manager = DebugSessionManager()

    def run(self) -> str:
        """Main execution method - returns Flutter command to run"""
        try:
            # Print header to stderr
            print("[MAIN-DEBUG] Flutter Bloom Dev Debug Main Script", file=sys.stderr)
            print("=" * 44, file=sys.stderr)

            # Get current selection from file variables
            selection = self.session_manager.get_current_selection()

            if not selection["app"]:
                log_error("No app selection found")
                log_warning("Please run start.ps1 first to select an app")
                return ""

            # Display current selection
            self.session_manager.print_selection_summary()

            # Get the selected app information
            app = self.app_manager.get_app_by_name(selection["app"])
            if not app:
                log_error(f"App '{selection['app']}' not found in project")
                available_apps = self.app_manager.list_app_names()
                log_info(f"Available apps: {', '.join(available_apps)}")
                return ""

            # Show app information
            log_info(f"App found: {app.name} (index: {app.index}, port: {app.port})")
            log_info(f"Entry file: {app.entry_file}")

            # Route to appropriate platform debugger
            platform = selection["platform"].lower()
            action = selection["action"]

            flutter_command = self._route_to_platform_debugger(app, platform, action)

            if not flutter_command:
                log_error("Failed to generate Flutter command")
                return ""

            return flutter_command

        except Exception as e:
            print(f"[ERROR] Script execution failed: {e}", file=sys.stderr)
            return ""

    def _route_to_platform_debugger(self, app, platform: str, action: str) -> str:
        """Route to the appropriate platform debugger"""
        platform_map = {
            "web": WebDebugger,
            "android": AndroidDebugger,
            "windows": WindowsDebugger,
            "ios": iOSDebugger
        }

        debugger_class = platform_map.get(platform)
        if not debugger_class:
            log_error(f"Unsupported platform: {platform}")
            log_info(f"Supported platforms: {', '.join(platform_map.keys())}")
            # Default to web
            log_cyan("Defaulting to Web platform")
            debugger_class = WebDebugger

        log_cyan(f"Using {debugger_class.__name__} for {platform} debugging")

        # Create and run debugger
        debugger = debugger_class(app, action)
        return debugger.start_debug()

    def show_debug_info(self):
        """Show debugging information about current setup"""
        log_header("Flutter Debug System Information")

        # App information
        apps = self.app_manager.get_flutter_apps()
        log_info(f"Found {len(apps)} Flutter apps:")
        for app in apps:
            log_info(f"  - {app.name} (port: {app.port}, entry: {app.entry_file})")

        # Current selection
        selection = self.session_manager.get_current_selection()
        log_info("Current selection:")
        for key, value in selection.items():
            log_info(f"  {key}: {value}")

        # Platform support
        log_info("Platform support:")
        for platform_name, debugger_class in [
            ("Web", WebDebugger),
            ("Android", AndroidDebugger),
            ("Windows", WindowsDebugger),
            ("iOS", iOSDebugger)
        ]:
            try:
                supported = debugger_class.validate_requirements()
                status = "✓" if supported else "✗"
                log_info(f"  {status} {platform_name}")
            except Exception as e:
                log_info(f"  ✗ {platform_name} (error: {e})")

def main():
    """Main entry point"""
    controller = FlutterDebugController()

    # Check for special commands
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "--info" or command == "-i":
            controller.show_debug_info()
            return ""
        elif command == "--help" or command == "-h":
            print_help()
            return ""

    # Run normal debug process
    flutter_command = controller.run()

    # Only output the final command to stdout
    if flutter_command.strip():
        print(flutter_command.strip())
    else:
        print("echo 'No Flutter command generated'")

def print_help():
    """Print help information"""
    help_text = """
Flutter Bloom Python Debug System

Usage:
  python main.py              - Run debug process with current selection
  python main.py --info       - Show system information
  python main.py --help       - Show this help message

The system reads app selection from file variables set by start.ps1 and
generates the appropriate Flutter debug command for the selected platform.

Supported platforms:
  - Web: Runs in browser with network access
  - Android: Runs on Android device or emulator
  - Windows: Runs as native Windows application (Windows only)
  - iOS: Runs on iOS device or simulator (macOS only)

Debug flow:
1. start.ps1 sets app selection in file variables
2. This script reads the selection
3. Appropriate platform debugger is chosen
4. Flutter command is generated and returned
5. startByPy.ps1 executes the returned command

For more information about specific platforms, check the platform help:
  - Web debugging: Accessible from any device on network
  - Android debugging: Requires ADB and device/emulator
  - Windows debugging: Requires Visual Studio tools
  - iOS debugging: Requires macOS and Xcode
    """
    print(help_text, file=sys.stderr)

if __name__ == "__main__":
    main()