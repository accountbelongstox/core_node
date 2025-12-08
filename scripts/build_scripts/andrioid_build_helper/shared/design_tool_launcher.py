#!/usr/bin/env python3
"""
Design Tool Launcher - Cross-platform design documentation tool launcher
Handles launching the Flutter design documentation tool web server
"""

import os
import time
import webbrowser
from pathlib import Path
from typing import Optional
from shared.data_exchange.unified_variable_system import unified_vars
from shared.shell_executor import shell_executor


class DesignToolLauncher:
    """
    Launches Flutter design documentation tool
    Generates platform-specific launcher scripts
    """

    def __init__(self):
        self.project_root = unified_vars.flutter_bloom_root
        self.script_dir = self.project_root / "scripts"
        self.design_tool_dir = self.script_dir / "flutter_dev_tools"
        self.design_tool_py = self.design_tool_dir / "design_doc_tool.py"
        self.port = 5757
        self.url = f"http://127.0.0.1:{self.port}"

    def validate_design_tool(self) -> bool:
        """Validate that design tool exists"""
        if not self.design_tool_py.exists():
            print(f"[ERROR] Design tool not found: {self.design_tool_py}")
            return False
        return True

    def get_design_tool_action(self) -> str:
        """Get design tool action from variable system"""
        action = unified_vars.get_file_variable("DESIGN_TOOL_STATE_ACTION", "Launch")
        return action

    def generate_launcher_script(self) -> Optional[str]:
        """
        Generate platform-specific launcher script
        Returns: path to launcher script
        """
        action = self.get_design_tool_action()

        if shell_executor.is_windows:
            return self._generate_windows_launcher(action)
        else:
            return self._generate_linux_launcher(action)

    def _generate_windows_launcher(self, action: str) -> str:
        """Generate Windows BAT launcher"""
        bat_commands = [
            f"echo Starting web server on {self.url}",
            "echo.",
            "echo Press Ctrl+C to stop the server",
            "echo ========================================",
            "echo.",
            f'cd /d "{self.design_tool_dir}"',
            f'python "{self.design_tool_py}"'
        ]

        bat_file = shell_executor.generate_bat_file(
            commands=bat_commands,
            title=f"Flutter Design Documentation Tool [{action}]",
            pause_on_exit=True
        )

        print(f"[INFO] Generated launcher: {bat_file}")
        return bat_file

    def _generate_linux_launcher(self, action: str) -> str:
        """Generate Linux bash launcher"""
        bash_commands = [
            f"echo 'Starting web server on {self.url}'",
            "echo ''",
            "echo 'Press Ctrl+C to stop the server'",
            "echo '========================================'",
            "echo ''",
            f'cd "{self.design_tool_dir}"',
            f'python3 "{self.design_tool_py}"'
        ]

        bash_file = shell_executor.generate_bash_script(
            commands=bash_commands,
            title=f"Flutter Design Documentation Tool [{action}]",
            pause_on_exit=False
        )

        print(f"[INFO] Generated launcher: {bash_file}")
        return bash_file

    def prepare_launch_script(self) -> dict:
        """
        Prepare launch script and save to variable system
        Returns dict with script_path and url
        """
        try:
            print("")
            print("[INFO] Launching Design Documentation Tool...")

            if not self.validate_design_tool():
                return {"success": False, "error": "Design tool not found"}

            action = self.get_design_tool_action()
            print(f"[INFO] Action: {action}")

            # Generate launcher script
            launcher_script = self.generate_launcher_script()

            # Save launcher information to variable system
            unified_vars.set_file_variable("DESIGN_TOOL_LAUNCHER_SCRIPT", launcher_script)
            unified_vars.set_file_variable("DESIGN_TOOL_URL", self.url)
            unified_vars.set_file_variable("DESIGN_TOOL_PORT", str(self.port))

            print(f"[INFO] Design tool launcher prepared: {launcher_script}")
            print(f"[INFO] Server URL: {self.url}")

            return {
                "success": True,
                "script_path": launcher_script,
                "url": self.url,
                "port": self.port
            }

        except Exception as e:
            print(f"[ERROR] Failed to prepare design tool launcher: {e}")
            return {"success": False, "error": str(e)}

    def launch_in_background(self) -> bool:
        """
        Launch design tool in background (for direct Python execution)
        This is used when shell can't launch processes in background
        """
        try:
            import subprocess

            if not self.validate_design_tool():
                return False

            # Start design tool server in background
            if shell_executor.is_windows:
                subprocess.Popen(
                    ["python", str(self.design_tool_py)],
                    cwd=str(self.design_tool_dir),
                    creationflags=subprocess.CREATE_NEW_CONSOLE
                )
            else:
                subprocess.Popen(
                    ["python3", str(self.design_tool_py)],
                    cwd=str(self.design_tool_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            # Wait for server to start
            time.sleep(2)

            # Open browser
            webbrowser.open(self.url)

            print(f"[SUCCESS] Design tool launched successfully")
            print(f"[INFO] Server URL: {self.url}")
            print(f"[INFO] The design tool is running in the background")

            return True

        except Exception as e:
            print(f"[ERROR] Failed to launch design tool: {e}")
            return False


# Global instance
design_tool_launcher = DesignToolLauncher()
