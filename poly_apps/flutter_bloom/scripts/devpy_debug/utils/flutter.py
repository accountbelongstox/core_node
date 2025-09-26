#!/usr/bin/env python3

import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

class FlutterUtility:
    """Flutter-related utilities and command building"""

    @staticmethod
    def is_flutter_available() -> bool:
        """Check if Flutter is available in the system PATH"""
        try:
            result = subprocess.run(['flutter', '--version'], capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
            return False

    @staticmethod
    def get_flutter_version() -> Optional[str]:
        """Get Flutter version string"""
        try:
            result = subprocess.run(['flutter', '--version'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                # Extract version from first line
                first_line = result.stdout.split('\n')[0]
                return first_line.strip()
        except Exception:
            pass
        return None

    @staticmethod
    def assert_flutter_environment():
        """Assert that Flutter environment is properly set up"""
        if not FlutterUtility.is_flutter_available():
            raise Exception("Flutter is not installed or not available in PATH")

    @staticmethod
    def assert_flutter_project(project_path: Path):
        """Assert that the given path is a valid Flutter project"""
        pubspec_path = project_path / "pubspec.yaml"
        if not pubspec_path.exists():
            raise Exception(f"pubspec.yaml not found in {project_path}")

    @staticmethod
    def run_flutter_pub_get(project_path: Path) -> bool:
        """Run flutter pub get in the specified project directory"""
        try:
            original_cwd = os.getcwd()
            os.chdir(project_path)

            print("[INFO] Running flutter pub get...", file=sys.stderr)
            result = subprocess.run(['flutter', 'pub', 'get'], capture_output=True, text=True, timeout=60)

            if result.returncode == 0:
                print("[SUCCESS] flutter pub get completed successfully", file=sys.stderr)
                return True
            else:
                print(f"[ERROR] flutter pub get failed: {result.stderr}", file=sys.stderr)
                return False

        except Exception as e:
            print(f"[ERROR] Failed to run flutter pub get: {e}", file=sys.stderr)
            return False
        finally:
            os.chdir(original_cwd)

    @staticmethod
    def get_flutter_devices() -> List[Dict[str, str]]:
        """Get list of available Flutter devices"""
        try:
            result = subprocess.run(['flutter', 'devices', '--machine'], capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                import json
                devices = json.loads(result.stdout)
                return devices
        except Exception as e:
            print(f"[WARNING] Failed to get Flutter devices: {e}", file=sys.stderr)
        return []

class FlutterCommandBuilder:
    """Builder for Flutter commands with various options"""

    def __init__(self):
        self.action = "run"
        self.platform = None
        self.entry_file = None
        self.port = None
        self.hostname = None
        self.build_mode = "--debug"
        self.device_id = None
        self.additional_args = []

    def set_action(self, action: str) -> 'FlutterCommandBuilder':
        """Set Flutter action (run, build, test, etc.)"""
        self.action = action
        return self

    def set_platform(self, platform: str) -> 'FlutterCommandBuilder':
        """Set target platform"""
        self.platform = platform
        return self

    def set_entry_file(self, entry_file: str) -> 'FlutterCommandBuilder':
        """Set entry file path"""
        self.entry_file = entry_file
        return self

    def set_port(self, port: int) -> 'FlutterCommandBuilder':
        """Set port for web debugging"""
        self.port = port
        return self

    def set_hostname(self, hostname: str) -> 'FlutterCommandBuilder':
        """Set hostname for web debugging"""
        self.hostname = hostname
        return self

    def set_build_mode(self, build_mode: str) -> 'FlutterCommandBuilder':
        """Set build mode (--debug, --release, --profile)"""
        self.build_mode = build_mode
        return self

    def set_device_id(self, device_id: str) -> 'FlutterCommandBuilder':
        """Set target device ID"""
        self.device_id = device_id
        return self

    def add_argument(self, arg: str) -> 'FlutterCommandBuilder':
        """Add additional command line argument"""
        self.additional_args.append(arg)
        return self

    def build(self) -> str:
        """Build the final Flutter command string"""
        cmd_parts = ["flutter", self.action]

        # Add device selection
        if self.device_id:
            cmd_parts.extend(["-d", self.device_id])

        # Add web-specific options
        if self.platform == "web" or self.platform == "web-server":
            if self.hostname:
                cmd_parts.extend(["--web-hostname", self.hostname])
            if self.port:
                cmd_parts.extend(["--web-port", str(self.port)])

        # Add build mode
        if self.build_mode:
            cmd_parts.append(self.build_mode)

        # Add entry file
        if self.entry_file:
            cmd_parts.extend(["-t", self.entry_file])

        # Add additional arguments
        cmd_parts.extend(self.additional_args)

        return " ".join(cmd_parts)

    @staticmethod
    def create_web_command(entry_file: str, port: int, hostname: str = "0.0.0.0",
                          build_mode: str = "--debug") -> str:
        """Quick method to create web debug command"""
        return (FlutterCommandBuilder()
                .set_action("run")
                .set_platform("web-server")
                .set_entry_file(entry_file)
                .set_port(port)
                .set_hostname(hostname)
                .set_build_mode(build_mode)
                .build())

    @staticmethod
    def create_android_command(entry_file: str, device_id: str = None,
                             build_mode: str = "--debug") -> str:
        """Quick method to create Android debug command"""
        builder = (FlutterCommandBuilder()
                  .set_action("run")
                  .set_entry_file(entry_file)
                  .set_build_mode(build_mode))

        if device_id:
            builder.set_device_id(device_id)

        return builder.build()

    @staticmethod
    def create_windows_command(entry_file: str, build_mode: str = "--debug") -> str:
        """Quick method to create Windows debug command"""
        return (FlutterCommandBuilder()
                .set_action("run")
                .set_device_id("windows")
                .set_entry_file(entry_file)
                .set_build_mode(build_mode)
                .build())

    @staticmethod
    def create_ios_command(entry_file: str, build_mode: str = "--debug") -> str:
        """Quick method to create iOS debug command"""
        return (FlutterCommandBuilder()
                .set_action("run")
                .set_device_id("ios")
                .set_entry_file(entry_file)
                .set_build_mode(build_mode)
                .build())