"""
Command Center - Unified Command Logic Sharing
Python does: File operations (copy, scan, parse)
Shell does: Command execution (emulator, gradle, metro, adb, pnpm)
NO subprocess in Python - all commands via file variable system
"""

from global_var_manager import GlobalVarManager
from typing import Optional


class CommandCenter:
    """
    Central hub for preparing shell commands via file variables
    Python only prepares paths and flags - Shell executes all commands
    """

    def __init__(self):
        self.gvm = GlobalVarManager(namespace=None)

    def prepare_junction_command(self, source: str, target: str):
        """
        Prepare junction/symlink creation command
        Shell will execute: mklink /J (Windows) or ln -s (Linux)
        """
        self.gvm.set("JUNCTION_SOURCE", source)
        self.gvm.set("JUNCTION_TARGET", target)
        self.gvm.set("JUNCTION_REQUIRED", "true")

    def prepare_emulator_list_command(self, emulator_path: str):
        """
        Prepare emulator AVD list command
        Shell will execute: emulator -list-avds
        """
        self.gvm.set("EMULATOR_PATH", emulator_path)
        self.gvm.set("EMULATOR_SCAN_REQUIRED", "true")

    def clear_command(self, command_type: str):
        """Clear specific command requirement flag"""
        self.gvm.set(f"{command_type}_REQUIRED", "false")

    def get_command_result(self, command_type: str) -> Optional[str]:
        """Get result from shell command execution"""
        return self.gvm.get(f"{command_type}_RESULT")


def get_command_center() -> CommandCenter:
    """Get singleton CommandCenter instance"""
    return CommandCenter()
