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
Windows Platform Debugger
Handles Flutter Windows desktop debug operations
"""

from typing import Dict, Any

from .base_debugger import BaseDebugger
from utils.print_helper import PrintHelper


class WindowsDebugger(BaseDebugger):
    """
    Windows platform debugger for Flutter applications
    """

    def get_platform_name(self) -> str:
        """Get platform name for logging"""
        return "WINDOWS"

    def validate_platform_requirements(self) -> bool:
        """Validate Windows platform requirements"""
        try:
            PrintHelper.info("Validating Windows platform requirements...", "WINDOWS")

            # Check if Flutter is available
            result = self._run_command(["flutter", "--version"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter not found in PATH", "WINDOWS")
                return False

            # Check if Windows desktop support is enabled
            result = self._run_command(["flutter", "config", "--list"], capture_output=True)
            if result["success"] and "enable-windows-desktop: true" not in result["stdout"]:
                PrintHelper.warning("Windows desktop support may not be enabled", "WINDOWS")
                # Try to enable Windows desktop support
                enable_result = self._run_command(["flutter", "config", "--enable-windows-desktop"], capture_output=True)
                if enable_result["success"]:
                    PrintHelper.info("Windows desktop support enabled", "WINDOWS")
                else:
                    PrintHelper.warning("Could not enable Windows desktop support", "WINDOWS")

            PrintHelper.info("Windows development tools found", "WINDOWS")
            return True

        except Exception as e:
            PrintHelper.error(f"Windows requirements validation failed: {e}", "WINDOWS")
            return False

    def prepare_debug_environment(self) -> bool:
        """Prepare Windows debug environment"""
        try:
            PrintHelper.info("Preparing Windows debug environment...", "WINDOWS")

            # Get dependencies
            result = self._run_command(["flutter", "pub", "get"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter pub get failed", "WINDOWS")
                return False

            PrintHelper.success("Windows debug environment prepared", "WINDOWS")
            return True

        except Exception as e:
            PrintHelper.error(f"Windows environment preparation failed: {e}", "WINDOWS")
            return False

    def execute_debug_command(self) -> Dict[str, Any]:
        """Execute Windows debug command"""
        try:
            PrintHelper.info("Starting Windows debug...", "WINDOWS")

            # Build Flutter command for Windows
            flutter_command = ["flutter", "run", "-d", "windows"]

            # Add entry point if specified
            if self.entry_file:
                flutter_command.extend(["-t", self.entry_file])

            # Add debug-specific options
            if self.action.lower() == "debug":
                flutter_command.append("--debug")
            else:
                flutter_command.append("--release")

            PrintHelper.info("Starting Flutter app on Windows desktop", "WINDOWS")

            # Start the debug session
            result = self._run_command(flutter_command, capture_output=False)

            if result["success"]:
                return {
                    "success": True,
                    "message": "Windows debug completed successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"Windows debug failed (exit code: {result.get('returncode', 'unknown')})"
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"Windows debug execution failed: {e}"
            }