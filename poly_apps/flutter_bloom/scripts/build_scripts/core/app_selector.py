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
Flutter App Selector
Interactive application selection with caching and platform/mode toggling
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from core.app_scanner import FlutterAppScanner
from shared.data_exchange.unified_variable_system import unified_vars
from utils.print_helper import PrintHelper


class FlutterAppSelector:
    """
    Interactive Flutter application selector with arrow key navigation
    """

    def __init__(self, scanner: Optional[FlutterAppScanner] = None):
        """Initialize the app selector"""
        self.scanner = scanner or FlutterAppScanner()
        # PrintHelper is now a static class
        self.platforms = ["Web", "Android", "Windows", "All"]

        # All keys are now defined in unified_variable_system.py for consistency

    def get_user_input_key(self) -> Dict[str, Any]:
        """Get a single key input from user with support for arrow keys"""
        try:
            import msvcrt
            key = msvcrt.getch()

            # Handle special keys (arrow keys return two bytes)
            if key == b'\xe0':  # Special key prefix on Windows
                key = msvcrt.getch()
                if key == b'H':  # Up arrow
                    return {"type": "arrow", "direction": "up", "code": 38}
                elif key == b'P':  # Down arrow
                    return {"type": "arrow", "direction": "down", "code": 40}
                elif key == b'K':  # Left arrow
                    return {"type": "arrow", "direction": "left", "code": 37}
                elif key == b'M':  # Right arrow
                    return {"type": "arrow", "direction": "right", "code": 39}
            elif key == b'\r':  # Enter
                return {"type": "key", "char": "enter", "code": 13}
            elif key == b'\x1b':  # Escape
                return {"type": "key", "char": "escape", "code": 27}
            else:
                return {"type": "key", "char": key.decode('utf-8').upper(), "code": ord(key)}
        except ImportError:
            # For non-Windows systems, fallback to simple input
            user_input = input().strip().upper()
            return {"type": "key", "char": user_input, "code": 0}

    def select_application(self) -> Dict[str, Any]:
        """
        Interactive application selection with arrow key navigation

        Returns:
            Selected application information
        """
        apps = self.scanner.get_apps_with_index()

        if not apps:
            PrintHelper.error("No Flutter apps found in the project", "APP-SELECTOR")
            return {"success": False, "error": "No applications found"}

        # Load last selected app index from cache
        current_selection_str = unified_vars.get_file_variable(unified_vars.KEY_LAST_SELECTED_APP_INDEX, "1")
        try:
            current_selection = int(current_selection_str)
        except:
            current_selection = 1

        # Filter apps to exclude app_main (since it's shown as option 0)
        filtered_apps = [app for app in apps if app["name"] != "app_main"]
        max_selection = len(filtered_apps)

        # Ensure current_selection is within valid range
        if current_selection < 0 or current_selection > max_selection:
            current_selection = 1

        while True:
            # Clear screen and show header
            os.system('cls' if os.name == 'nt' else 'clear')
            PrintHelper.header("Flutter Bloom App Selection", "APP-SELECTOR")

            print("\nAvailable Flutter Apps:")
            print("-" * 50)

            # Display "All Apps" option (app_main)
            all_highlight = " -> " if current_selection == 0 else "    "
            all_action_mode = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + "app_main", "Debug")
            all_platform_mode = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + "app_main", "Android")
            color_prefix = "\033[92m" if current_selection == 0 else "\033[97m"  # Green if selected, white otherwise
            color_suffix = "\033[0m"
            print(f"{color_prefix}{all_highlight} 0. app_main (Main Entry Point) [{all_action_mode}/{all_platform_mode}]{color_suffix}")

            # Display individual apps with highlighting and platform info
            for i, app in enumerate(filtered_apps):
                app_index = i + 1
                action_mode = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + app["name"], "Debug")
                platform_mode = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + app["name"], "Android")
                display_name = app["name"]
                display_name += f" [{action_mode}/{platform_mode}]"

                highlight = " -> " if current_selection == app_index else "    "
                color_prefix = "\033[92m" if current_selection == app_index else "\033[97m"
                color_suffix = "\033[0m"

                print(f"{color_prefix}{highlight} {app_index}. {display_name}{color_suffix}")

            print()
            print("\033[96mControls:\033[0m")  # Cyan
            print("\033[90m  Up/Down arrows: Navigate apps\033[0m")  # Gray
            print("\033[90m  Left arrow: Toggle Debug/Build mode\033[0m")  # Gray
            print("\033[90m  Right arrow: Toggle platform (Web/Android/Windows/All)\033[0m")  # Gray
            print("\033[90m  Enter: Select app\033[0m")  # Gray
            print()

            # Get key input
            key_info = self.get_user_input_key()

            if key_info["type"] == "arrow":
                if key_info["direction"] == "up":
                    current_selection = max_selection if current_selection == 0 else current_selection - 1
                elif key_info["direction"] == "down":
                    current_selection = 0 if current_selection == max_selection else current_selection + 1
                elif key_info["direction"] == "left":
                    self._toggle_action_mode(current_selection, filtered_apps)
                elif key_info["direction"] == "right":
                    self._toggle_platform_mode(current_selection, filtered_apps)

            elif key_info["type"] == "key" and (key_info["char"] == "enter" or key_info["char"] == ""):
                return self._confirm_selection(current_selection, filtered_apps, apps)

    def _toggle_action_mode(self, current_selection: int, filtered_apps: List[Dict[str, Any]]):
        """Toggle Debug/Build mode for current selection"""
        if current_selection == 0:
            # Handle app_main toggle
            current_action = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + "app_main", "Debug")
            new_action = "Build" if current_action == "Debug" else "Debug"
            unified_vars.set_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + "app_main", new_action)
        elif current_selection > 0:
            selected_app = filtered_apps[current_selection - 1]
            current_action = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + selected_app["name"], "Debug")
            new_action = "Build" if current_action == "Debug" else "Debug"
            unified_vars.set_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + selected_app["name"], new_action)

    def _toggle_platform_mode(self, current_selection: int, filtered_apps: List[Dict[str, Any]]):
        """Toggle platform mode for current selection"""
        if current_selection == 0:
            # Handle app_main platform toggle
            current_platform = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + "app_main", "Android")
            try:
                current_index = self.platforms.index(current_platform)
            except ValueError:
                current_index = 0
            new_index = 0 if current_index == len(self.platforms) - 1 else current_index + 1
            unified_vars.set_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + "app_main", self.platforms[new_index])
        elif current_selection > 0:
            selected_app = filtered_apps[current_selection - 1]
            current_platform = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + selected_app["name"], "Android")
            try:
                current_index = self.platforms.index(current_platform)
            except ValueError:
                current_index = 0
            new_index = 0 if current_index == len(self.platforms) - 1 else current_index + 1
            unified_vars.set_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + selected_app["name"], self.platforms[new_index])

    def _confirm_selection(self, current_selection: int, filtered_apps: List[Dict[str, Any]], all_apps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Confirm and return the current selection"""
        if current_selection == 0:
            # Get current action and platform for app_main
            current_action = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + "app_main", "Debug")
            current_platform = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + "app_main", "Android")

            # Calculate correct entry file (relative path)
            entry_file = f"lib/apps/app_main/main_app_main.dart"

            # Store selection data
            selection_data = {
                "app": "app_main",
                "action": current_action,
                "platform": current_platform,
                "entry_file": entry_file,
                "port": "10000",
                "index": "0",
                "is_all_option": True
            }

            # Save to unified variables
            self._save_selection_to_variables(selection_data)

            # Save current selection index for next time
            unified_vars.set_file_variable(unified_vars.KEY_LAST_SELECTED_APP_INDEX, "0")

            return {"success": True, "selection": selection_data}
        else:
            selected_app = filtered_apps[current_selection - 1]

            # Get current action and platform for the selected app
            current_action = unified_vars.get_file_variable(unified_vars.KEY_APP_ACTION_MODE_PREFIX + selected_app["name"], "Debug")
            current_platform = unified_vars.get_file_variable(unified_vars.KEY_APP_PLATFORM_MODE_PREFIX + selected_app["name"], "Android")

            # Calculate correct entry file (relative path) and port based on index
            app_name = selected_app["name"]
            entry_file = f"lib/apps/{app_name}/main_{app_name}.dart"

            # Find app index from display list (0=app_main, 1=first app, 2=second app, etc.)
            app_index = current_selection  # This is already the correct index since 0=app_main
            port = 10000 + app_index

            # Store selection data
            selection_data = {
                "app": app_name,
                "action": current_action,
                "platform": current_platform,
                "entry_file": entry_file,
                "port": str(port),
                "index": str(app_index),
                "is_all_option": False
            }

            # Save to unified variables
            self._save_selection_to_variables(selection_data)

            # Save current selection index for next time
            unified_vars.set_file_variable(unified_vars.KEY_LAST_SELECTED_APP_INDEX, str(current_selection))

            return {"success": True, "selection": selection_data}

    def _save_selection_to_variables(self, selection_data: Dict[str, Any]):
        """Save selection data to unified variables for PowerShell compatibility"""
        # Set current active variables
        unified_vars.set_file_variable(unified_vars.KEY_CURRENT_ACTIVE_APP, selection_data["app"])
        unified_vars.set_file_variable(unified_vars.KEY_CURRENT_ACTIVE_ACTION, selection_data["action"])
        unified_vars.set_file_variable(unified_vars.KEY_CURRENT_ACTIVE_PLATFORM, selection_data["platform"])

        # Set selected variables for backward compatibility
        unified_vars.set_file_variable(unified_vars.KEY_SELECTED_APP, selection_data["app"])
        unified_vars.set_file_variable(unified_vars.KEY_SELECTED_ACTION, selection_data["action"])
        unified_vars.set_file_variable(unified_vars.KEY_SELECTED_PLATFORM, selection_data["platform"])
        unified_vars.set_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, selection_data["entry_file"])
        unified_vars.set_file_variable(unified_vars.KEY_APP_INDEX, selection_data["index"])
        unified_vars.set_file_variable(unified_vars.KEY_DEBUG_PORT, selection_data["port"])

        # Set app variables for PowerShell scripts
        unified_vars.set_file_variable(unified_vars.KEY_APP_NAME, selection_data["app"])
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_ACTION, selection_data["action"])
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_PLATFORM, selection_data["platform"])

        # Additional PowerShell compatibility variables (without KEY_ prefix)
        unified_vars.set_file_variable("SELECTED_APP", selection_data["app"])
        unified_vars.set_file_variable("SELECTED_ACTION", selection_data["action"])
        unified_vars.set_file_variable("SELECTED_PLATFORM", selection_data["platform"])
        unified_vars.set_file_variable("SELECTED_ENTRY_FILE", selection_data["entry_file"])
        unified_vars.set_file_variable("APP_INDEX", selection_data["index"])
        unified_vars.set_file_variable("DEBUG_PORT", selection_data["port"])

    def get_cached_selection(self) -> Optional[Dict[str, Any]]:
        """
        Get cached selection information

        Returns:
            Cached selection data or None
        """
        app_name = unified_vars.get_file_variable(unified_vars.KEY_CURRENT_ACTIVE_APP, "")
        if not app_name:
            return None

        return {
            "app": app_name,
            "action": unified_vars.get_file_variable(unified_vars.KEY_CURRENT_ACTIVE_ACTION, "Debug"),
            "platform": unified_vars.get_file_variable(unified_vars.KEY_CURRENT_ACTIVE_PLATFORM, "Web"),
            "entry_file": unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, ""),
            "port": unified_vars.get_file_variable(unified_vars.KEY_DEBUG_PORT, "10000"),
            "index": unified_vars.get_file_variable(unified_vars.KEY_APP_INDEX, "0")
        }