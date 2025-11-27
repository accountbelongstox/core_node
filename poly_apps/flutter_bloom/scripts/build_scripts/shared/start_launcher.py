#!/usr/bin/env python3
"""
Start Launcher - Unified launcher for Flutter Bloom
Replicates start.ps1 logic in Python for cross-platform compatibility
"""

import sys
from pathlib import Path
from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager
from shared.design_tool_launcher import design_tool_launcher
from shared.shell_executor import shell_executor


class StartLauncher:
    """
    Unified start launcher that replicates start.ps1 functionality
    Handles routing between debug, build, and design_tool modes
    """

    def __init__(self):
        self.dir_manager = DirectoryManager()
        self.project_root = unified_vars.flutter_bloom_root
        self.script_dir = self.project_root / "scripts"

    def get_selected_action(self) -> str:
        """Get selected action from variable system"""
        action = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ACTION, "")
        return action

    def launch_design_tool(self) -> dict:
        """
        Launch design documentation tool
        Returns dict with success status and launcher info
        """
        print("")
        print("[INFO] Launching Design Documentation Tool...")

        result = design_tool_launcher.prepare_launch_script()

        if not result["success"]:
            return result

        # Save URL and port to variables for shell to use
        unified_vars.set_file_variable("DESIGN_TOOL_READY", "true")

        return result

    def prepare_debug_mode(self) -> dict:
        """
        Prepare debug mode execution
        Debug script path is already saved by flutter_launcher.py
        """
        try:
            # Get debug script path saved by flutter_launcher.py
            script_path = unified_vars.get_file_variable(unified_vars.KEY_SCRIPT_PATH, "")

            if not script_path:
                return {
                    "success": False,
                    "error": "No debug script path found from launcher"
                }

            if not Path(script_path).exists():
                return {
                    "success": False,
                    "error": f"Debug script not found: {script_path}"
                }

            print(f"[DEBUG] Debug script prepared: {script_path}")

            return {
                "success": True,
                "script_path": script_path,
                "mode": "debug"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to prepare debug mode: {e}"
            }

    def prepare_build_mode(self) -> dict:
        """
        Prepare build mode execution
        Build system is handled by main.py
        """
        print("[INFO] Build mode preparation - handled by main.py")

        return {
            "success": True,
            "mode": "build"
        }

    def route_to_mode(self, action: str) -> dict:
        """
        Route to appropriate mode based on action
        Returns dict with routing information
        """
        action_lower = action.lower()

        if action_lower == "debug":
            print("[DEBUG] Routing to debug mode")
            return self.prepare_debug_mode()

        elif action_lower in ["build", "release"]:
            print("[DEBUG] Routing to build mode")
            return self.prepare_build_mode()

        elif action_lower == "design_tool":
            print("[DEBUG] Routing to design tool mode")
            return self.launch_design_tool()

        else:
            return {
                "success": False,
                "error": f"Unknown action: {action}"
            }

    def generate_shell_execution_script(self, routing_result: dict) -> str:
        """
        Generate shell script to execute the routed action
        Returns: path to shell script
        """
        mode = routing_result.get("mode", "")

        if mode == "debug":
            # Debug mode: execute the debug script
            script_path = routing_result["script_path"]

            if shell_executor.is_windows:
                # PowerShell execution
                commands = [
                    f'Write-Host "[DEBUG] Executing debug script: {script_path}" -ForegroundColor Cyan',
                    f'. "{script_path}"'
                ]
                exec_script = shell_executor.generate_powershell_script(
                    commands=commands,
                    title="Flutter Bloom Debug Launcher"
                )
            else:
                # Bash execution
                commands = [
                    f'echo "[DEBUG] Executing debug script: {script_path}"',
                    f'bash "{script_path}"'
                ]
                exec_script = shell_executor.generate_bash_script(
                    commands=commands,
                    title="Flutter Bloom Debug Launcher"
                )

            return exec_script

        elif mode == "design_tool":
            # Design tool mode: launch the design tool
            launcher_script = routing_result["script_path"]
            url = routing_result["url"]

            if shell_executor.is_windows:
                commands = [
                    f'Write-Host "[INFO] Opening design tool..." -ForegroundColor Yellow',
                    f'Start-Process -FilePath "{launcher_script}"',
                    'Start-Sleep -Seconds 2',
                    f'Start-Process "{url}"',
                    f'Write-Host "[SUCCESS] Design tool launched" -ForegroundColor Green',
                    f'Write-Host "[INFO] Server URL: {url}" -ForegroundColor Cyan'
                ]
                exec_script = shell_executor.generate_powershell_script(
                    commands=commands,
                    title="Flutter Design Tool Launcher"
                )
            else:
                commands = [
                    'echo "[INFO] Opening design tool..."',
                    f'bash "{launcher_script}" &',
                    'sleep 2',
                    shell_executor.get_open_browser_command(url),
                    'echo "[SUCCESS] Design tool launched"',
                    f'echo "[INFO] Server URL: {url}"'
                ]
                exec_script = shell_executor.generate_bash_script(
                    commands=commands,
                    title="Flutter Design Tool Launcher"
                )

            return exec_script

        return ""

    def run(self) -> int:
        """
        Main execution method
        Returns: exit code
        """
        try:
            print("Flutter Bloom Start Launcher")
            print("============================")

            # Print directory status
            self.dir_manager.print_status()

            # Get selected action
            action = self.get_selected_action()

            if not action:
                print("[ERROR] No action selected")
                print("[ERROR] Please run main.py first to select an action")
                return 1

            print(f"[INFO] Selected action: {action}")

            # Route to appropriate mode
            routing_result = self.route_to_mode(action)

            if not routing_result["success"]:
                error = routing_result.get("error", "Unknown error")
                print(f"[ERROR] Routing failed: {error}")
                return 1

            # For design_tool and debug modes, generate execution script
            mode = routing_result.get("mode", "")

            if mode in ["debug", "design_tool"]:
                exec_script = self.generate_shell_execution_script(routing_result)

                # Save execution script path
                unified_vars.set_file_variable("EXECUTION_SCRIPT_PATH", exec_script)

                print(f"[SUCCESS] Execution script generated: {exec_script}")
                print(f"[INFO] Shell should execute: {exec_script}")

            elif mode == "build":
                # Build mode is handled by main.py, not here
                print("[INFO] Build mode - no execution script needed")

            print("[SUCCESS] Start launcher completed")
            return 0

        except Exception as e:
            print(f"[ERROR] Start launcher failed: {e}")
            import traceback
            traceback.print_exc()
            return 1


def main():
    """Entry point for start_launcher"""
    launcher = StartLauncher()
    exit_code = launcher.run()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
