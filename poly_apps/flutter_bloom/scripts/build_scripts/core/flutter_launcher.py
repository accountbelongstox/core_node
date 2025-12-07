#!/usr/bin/env python3
"""
Flutter Bloom Launcher - Class Library
Encapsulates main.py logic for app selection and routing
"""

import sys
import traceback
from pathlib import Path
from core.app_scanner import FlutterAppScanner
from core.app_selector import FlutterAppSelector
from core.decision_engine import FlutterDecisionEngine
from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager


class FlutterBloomLauncher:
    """Main Flutter Bloom launcher class"""

    def __init__(self):
        self.scanner = FlutterAppScanner()
        self.selector = FlutterAppSelector(self.scanner)
        self.decision_engine = FlutterDecisionEngine()
        self.dir_manager = DirectoryManager()

    def initialize_environment(self) -> bool:
        """Initialize the Flutter environment"""
        try:
            return self.decision_engine.initialize_environment()
        except Exception as e:
            print(f"[ERROR] Environment initialization failed: {e}")
            return False

    def select_app(self) -> dict:
        """Handle app selection and return result"""
        try:
            print("[INFO] Loading app selector...")
            selection_result = self.selector.select_application()

            if not selection_result.get("success"):
                if selection_result.get("cancelled"):
                    return {"success": False, "cancelled": True, "message": "Selection cancelled by user"}
                else:
                    error_msg = selection_result.get('error', 'Unknown error')
                    return {"success": False, "cancelled": False, "message": f"App selection failed: {error_msg}"}

            return {"success": True, "selection": selection_result["selection"]}

        except Exception as e:
            return {"success": False, "cancelled": False, "message": f"App selection error: {e}"}

    def save_selection_variables(self, selection_data: dict) -> bool:
        """Save selection variables for cross-process compatibility"""
        try:
            print("[INFO] Caching variables for cross-process exchange...")

            # Save core selection variables with KEY_ prefix to match PowerShell
            unified_vars.set_file_variable(unified_vars.KEY_SELECTED_APP, selection_data["app"])
            unified_vars.set_file_variable(unified_vars.KEY_SELECTED_ACTION, selection_data["action"])
            unified_vars.set_file_variable(unified_vars.KEY_SELECTED_PLATFORM, selection_data["platform"])
            unified_vars.set_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, selection_data["entry_file"])
            unified_vars.set_file_variable(unified_vars.KEY_APP_INDEX, str(selection_data["index"]))
            unified_vars.set_file_variable(unified_vars.KEY_DEBUG_PORT, str(selection_data["port"]))

            return True

        except Exception as e:
            print(f"[ERROR] Failed to save variables: {e}")
            return False

    def route_and_save_script(self, selection_data: dict) -> dict:
        """Route to appropriate script and save script path"""
        try:
            action = selection_data["action"]
            platform = selection_data["platform"]

            # Direct routing logic (hardcoded)
            routing_result = {
                "success": False,
                "script_path": "",
                "action": action,
                "platform": platform,
                "mode": ""
            }

            if action.lower() == "debug":
                # Use debug script generator to set variables
                from shared.debug_script_generator import debug_script_generator

                debug_script_generator.prepare_debug_script()

                # Script path is set in variables, PowerShell will read it
                routing_result.update({
                    "success": True,
                    "script_path": "",  # PowerShell reads from variables
                    "mode": "debug"
                })
                print(f"[INFO] Debug variables set, PowerShell will execute script")

            elif action.lower() in ["build", "release"]:
                routing_result.update({
                    "success": True,
                    "script_path": "",  # No script for build mode
                    "mode": "build"
                })

                # Clear script path for build mode
                unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, "")
                unified_vars.set_file_variable(unified_vars.KEY_DEBUG_SCRIPT_PATH, "")
                print("[INFO] Build mode selected - will be handled by main.py")

            elif action.lower() == "design_tool":
                routing_result.update({
                    "success": True,
                    "script_path": "",  # No script for design tool mode
                    "mode": "design_tool"
                })

                # Clear script path for design tool mode
                unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, "")
                unified_vars.set_file_variable(unified_vars.KEY_DEBUG_SCRIPT_PATH, "")
                print("[INFO] Design tool mode selected - will be handled by PowerShell")

            else:
                routing_result["error"] = f"Unknown action: {action}"

            return routing_result

        except Exception as e:
            return {
                "success": False,
                "error": f"Routing failed: {e}",
                "script_path": "",
                "action": selection_data.get("action", ""),
                "platform": selection_data.get("platform", ""),
                "mode": ""
            }

    def run(self):
        """Main execution method - returns dict with result info"""
        try:
            print("[INFO] Flutter Bloom Launcher")
            print("==============================")

            # Print directory information at startup
            self.dir_manager.print_status()

            print("[INFO] Starting app selection...")

            # Initialize environment
            if not self.initialize_environment():
                print("[ERROR] Environment initialization failed")
                return {"exit_code": 1, "mode": None, "selection_data": None}

            # App selection
            selection_result = self.select_app()

            if not selection_result["success"]:
                if selection_result["cancelled"]:
                    print("[INFO] Selection cancelled by user")
                    return {"exit_code": 0, "mode": None, "selection_data": None}
                else:
                    print(f"[ERROR] {selection_result['message']}")
                    return {"exit_code": 1, "mode": None, "selection_data": None}

            selection_data = selection_result["selection"]

            # Save variables
            if not self.save_selection_variables(selection_data):
                print("[ERROR] Failed to save selection variables")
                return {"exit_code": 1, "mode": None, "selection_data": None}

            print(f"[SUCCESS] App selected - {selection_data['app']} [{selection_data['action']}/{selection_data['platform']}]")
            print("[INFO] Variables saved for cross-process exchange")

            # Route and save script path
            routing_result = self.route_and_save_script(selection_data)

            if not routing_result["success"]:
                error_msg = routing_result.get("error", "Unknown routing error")
                print(f"[ERROR] {error_msg}")
                return {"exit_code": 1, "mode": None, "selection_data": None}

            # Print completion message based on mode
            if routing_result["mode"] == "debug":
                print("[SUCCESS] Debug mode configured - script path saved")
                print("[INFO] Python launcher completed - passing control to PowerShell")
                return {"exit_code": 0, "mode": "debug", "selection_data": selection_data}
            elif routing_result["mode"] == "build":
                print("[SUCCESS] Build mode configured")
                print("[INFO] Python launcher will continue with build system")
                return {"exit_code": 0, "mode": "build", "selection_data": selection_data}
            elif routing_result["mode"] == "design_tool":
                print("[SUCCESS] Design tool mode configured")
                print("[INFO] Python launcher completed - passing control to PowerShell")
                return {"exit_code": 0, "mode": "design_tool", "selection_data": selection_data}

            return {"exit_code": 0, "mode": routing_result["mode"], "selection_data": selection_data}

        except KeyboardInterrupt:
            print("\n[INFO] Operation cancelled by user")
            return {"exit_code": 1, "mode": None, "selection_data": None}
        except Exception as e:
            print(f"[ERROR] Unexpected error: {e}")
            traceback.print_exc()
            return {"exit_code": 1, "mode": None, "selection_data": None}