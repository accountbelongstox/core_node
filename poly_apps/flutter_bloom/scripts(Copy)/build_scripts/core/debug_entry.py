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
Debug Entry Point
Handles debug operation execution with platform-specific logic
"""

from typing import Dict, Any

from core.debug.debug_system import FlutterBloomDebugSystem
from utils.print_helper import PrintHelper


class DebugEntryPoint:
    """
    Entry point for debug operations
    """

    def __init__(self):
        """Initialize debug entry point"""
        # PrintHelper is now a static class
        self.debug_system = FlutterBloomDebugSystem()

    def execute_debug(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute debug operation with given parameters

        Args:
            parameters: Debug parameters including platform, app, action, etc.

        Returns:
            Debug operation result
        """
        try:
            PrintHelper.header(f"Starting Debug Operation", "DEBUG-ENTRY")

            # Log debug parameters
            PrintHelper.info("Debug parameters:", "DEBUG-ENTRY")
            for key, value in parameters.items():
                PrintHelper.info(f"  {key}: {value}", "DEBUG-ENTRY")

            # Validate required parameters
            if not self._validate_debug_parameters(parameters):
                return {"success": False, "error": "Invalid debug parameters"}

            # Execute debug system
            result = self.debug_system.run(
                platform=parameters.get("platform"),
                app=parameters.get("app"),
                action=parameters.get("action", "debug")
            )

            if result["success"]:
                PrintHelper.success("Debug operation completed successfully", "DEBUG-ENTRY")
            else:
                PrintHelper.error(f"Debug operation failed: {result.get('error', 'Unknown error')}", "DEBUG-ENTRY")

            return result

        except Exception as e:
            error_message = f"Debug entry point error: {e}"
            PrintHelper.error(error_message, "DEBUG-ENTRY")
            return {"success": False, "error": error_message}

    def _validate_debug_parameters(self, parameters: Dict[str, Any]) -> bool:
        """
        Validate debug parameters

        Args:
            parameters: Debug parameters to validate

        Returns:
            True if parameters are valid, False otherwise
        """
        required_params = ["platform", "app"]

        for param in required_params:
            if not parameters.get(param):
                PrintHelper.error(f"Missing required parameter: {param}", "DEBUG-ENTRY")
                return False

        # Validate platform
        valid_platforms = ["web", "android", "ios", "windows"]
        platform = parameters.get("platform", "").lower()
        if platform not in valid_platforms:
            PrintHelper.error(f"Invalid platform: {platform}. Valid options: {valid_platforms}", "DEBUG-ENTRY")
            return False

        return True

    def get_supported_platforms(self) -> list:
        """
        Get list of supported debug platforms

        Returns:
            List of supported platform names
        """
        return self.debug_system.get_available_platforms()

    def validate_platform(self, platform: str) -> bool:
        """
        Validate if platform is supported

        Args:
            platform: Platform name to validate

        Returns:
            True if platform is supported, False otherwise
        """
        return self.debug_system.validate_platform(platform)