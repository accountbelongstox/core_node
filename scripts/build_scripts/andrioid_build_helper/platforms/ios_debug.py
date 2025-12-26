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
iOS Platform Debugger
Handles Flutter iOS debug operations
"""

from typing import Dict, Any

from .base_debugger import BaseDebugger
from utils.print_helper import PrintHelper


class IOSDebugger(BaseDebugger):
    """
    iOS platform debugger for Flutter applications
    """

    def get_platform_name(self) -> str:
        """Get platform name for logging"""
        return "IOS"

    def validate_platform_requirements(self) -> bool:
        """Validate iOS platform requirements"""
        try:
            PrintHelper.info("Validating iOS platform requirements...", "IOS")

            # Check if Flutter is available
            result = self._run_command(["flutter", "--version"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter not found in PATH", "IOS")
                return False

            # Check if running on macOS
            import platform
            if platform.system() != "Darwin":
                PrintHelper.error("iOS development requires macOS", "IOS")
                return False

            # Check if Xcode is available
            result = self._run_command(["xcode-select", "--print-path"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Xcode not found", "IOS")
                return False

            PrintHelper.info("iOS development tools found", "IOS")
            return True

        except Exception as e:
            PrintHelper.error(f"iOS requirements validation failed: {e}", "IOS")
            return False

    def prepare_debug_environment(self) -> bool:
        """Prepare iOS debug environment"""
        try:
            PrintHelper.info("Preparing iOS debug environment...", "IOS")

            # Get dependencies
            result = self._run_command(["flutter", "pub", "get"], capture_output=True)
            if not result["success"]:
                PrintHelper.error("Flutter pub get failed", "IOS")
                return False

            PrintHelper.success("iOS debug environment prepared", "IOS")
            return True

        except Exception as e:
            PrintHelper.error(f"iOS environment preparation failed: {e}", "IOS")
            return False

    def execute_debug_command(self) -> Dict[str, Any]:
        """Execute iOS debug command"""
        try:
            PrintHelper.info("Starting iOS debug...", "IOS")

            # Build Flutter command for iOS simulator
            flutter_command = ["flutter", "run", "-d", "ios"]

            # Add entry point if specified
            if self.entry_file:
                flutter_command.extend(["-t", self.entry_file])

            # Add debug-specific options
            if self.action.lower() == "debug":
                flutter_command.append("--debug")
            else:
                flutter_command.append("--release")

            PrintHelper.info("Starting Flutter app on iOS simulator", "IOS")

            # Start the debug session
            result = self._run_command(flutter_command, capture_output=False)

            if result["success"]:
                return {
                    "success": True,
                    "message": "iOS debug completed successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"iOS debug failed (exit code: {result.get('returncode', 'unknown')})"
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"iOS debug execution failed: {e}"
            }