#!/usr/bin/env python3
"""
Debug Script Generator - Sets variables only
PowerShell scripts read variables and execute
"""

from pathlib import Path
from shared.data_exchange.unified_variable_system import unified_vars


class DebugScriptGenerator:
    """Sets variables for PowerShell debug scripts"""

    def __init__(self):
        self.project_root = unified_vars.flutter_bloom_root
        self.dev_debug_dir = self.project_root / "scripts" / "dev_debug"

    def prepare_debug_script(self):
        """Set variables and script path"""

        # Get configuration
        platform = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_PLATFORM, "Android")

        # Set project root for PowerShell
        unified_vars.set_file_variable("KEY_PROJECT_ROOT", str(self.project_root))

        # Determine script path based on platform
        platform_lower = platform.lower()

        if platform_lower in ["android", "android_emulator"]:
            script_path = self.dev_debug_dir / "startDebugByPhone.ps1"
        elif platform_lower in ["web", "web-server", "chrome"]:
            script_path = self.dev_debug_dir / "startDebugByWeb.ps1"
        elif platform_lower == "ios":
            script_path = self.dev_debug_dir / "startDebugByIOS.ps1"
        elif platform_lower in ["windows", "linux"]:
            script_path = self.dev_debug_dir / "startDebugByWindows.ps1"
        else:
            script_path = self.dev_debug_dir / "startDebugByPhone.ps1"

        # Set script path
        unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, str(script_path))
        unified_vars.set_file_variable(unified_vars.KEY_DEBUG_SCRIPT_PATH, str(script_path))

        print(f"[INFO] Platform: {platform}")
        print(f"[INFO] Script: {script_path.name}")


# Global instance
debug_script_generator = DebugScriptGenerator()
