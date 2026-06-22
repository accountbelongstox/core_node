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
Web Platform Debugger
Handles Flutter web debug operations
"""

import os
import webbrowser
from pathlib import Path
from typing import Dict, Any, List

from .base_debugger import BaseDebugger
from utils.print_helper import PrintHelper


class WebDebugger(BaseDebugger):
    """
    Web platform debugger for Flutter applications
    """

    def __init__(self, app: str, action: str, entry_file: str, debug_port: str):
        """Initialize web debugger"""
        super().__init__(app, action, entry_file, debug_port)
        self.web_port = debug_port or "8080"
        self.hostname = "localhost"

    def get_platform_name(self) -> str:
        """Get platform name for logging"""
        return "WEB"

    def validate_platform_requirements(self) -> bool:
        """Validate web platform requirements"""
        try:
            PrintHelper.info("Validating web platform requirements...", "WEB")

            # Check if Flutter is available
            result = self._run_command(["flutter", "--version"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter not found in PATH", "WEB")
                return False

            PrintHelper.info("Flutter installation found", "WEB")

            # Check if web support is enabled
            result = self._run_command(["flutter", "config", "--list"], capture_output=True)
            if result["success"] and "enable-web: true" not in result["stdout"]:
                PrintHelper.warning("Web support may not be enabled", "WEB")
                # Try to enable web support
                enable_result = self._run_command(["flutter", "config", "--enable-web"], capture_output=True)
                if enable_result["success"]:
                    PrintHelper.info("Web support enabled", "WEB")
                else:
                    PrintHelper.warning("Could not enable web support", "WEB")

            return True

        except Exception as e:
            PrintHelper.error(f"Web requirements validation failed: {e}", "WEB")
            return False

    def prepare_debug_environment(self) -> bool:
        """Prepare web debug environment"""
        try:
            PrintHelper.info("Preparing web debug environment...", "WEB")

            # Clean previous web build if exists
            web_build_dir = self.project_root / "build" / "web"
            if web_build_dir.exists():
                PrintHelper.info("Cleaning previous web build...", "WEB")
                result = self._run_command(["flutter", "clean"], capture_output=True)
                if not result["success"]:
                    PrintHelper.warning("Flutter clean failed, continuing anyway", "WEB")

            # Get dependencies
            PrintHelper.info("Getting Flutter dependencies...", "WEB")
            result = self._run_command(["flutter", "pub", "get"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter pub get failed", "WEB")
                return False

            PrintHelper.success("Web debug environment prepared", "WEB")
            return True

        except Exception as e:
            PrintHelper.error(f"Web environment preparation failed: {e}", "WEB")
            return False

    def execute_debug_command(self) -> Dict[str, Any]:
        """Execute web debug command"""
        try:
            PrintHelper.info("Starting web debug server...", "WEB")

            # Build Flutter command
            flutter_command = ["flutter", "run", "-d", "web-server"]

            # Add port specification
            flutter_command.extend(["--web-port", self.web_port])
            flutter_command.extend(["--web-hostname", self.hostname])

            # Add entry point if specified
            if self.entry_file:
                flutter_command.extend(["-t", self.entry_file])

            # Add debug-specific options
            if self.action.lower() == "debug":
                flutter_command.append("--debug")
                flutter_command.append("--hot-reload")
            else:
                flutter_command.append("--release")

            PrintHelper.info(f"Debug server will be available at: http://{self.hostname}:{self.web_port}", "WEB")
            PrintHelper.info("Press 'r' to hot reload, 'R' to hot restart, 'q' to quit", "WEB")

            # Start the debug server
            result = self._run_command(flutter_command, capture_output=False)

            if result["success"]:
                return {
                    "success": True,
                    "message": f"Web debug server started on http://{self.hostname}:{self.web_port}"
                }
            else:
                return {
                    "success": False,
                    "error": f"Web debug server failed to start (exit code: {result.get('returncode', 'unknown')})"
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"Web debug execution failed: {e}"
            }

    def open_browser(self) -> bool:
        """Open browser to debug URL"""
        try:
            debug_url = f"http://{self.hostname}:{self.web_port}"
            PrintHelper.info(f"Opening browser to {debug_url}", "WEB")
            webbrowser.open(debug_url)
            return True
        except Exception as e:
            PrintHelper.warning(f"Could not open browser automatically: {e}", "WEB")
            return False