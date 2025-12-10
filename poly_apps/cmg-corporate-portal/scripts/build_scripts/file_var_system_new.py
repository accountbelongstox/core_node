#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Variable System (Refactored)
Uses single file per variable instead of JSON
Format: filename = KEY, content = VALUE
Stores in global directory:
  - Windows: C:\\Users\\USERNAME\\.core_node\\.build_global_vars
  - Linux: /var/_core_node/_build_global_vars/
"""

import os
import sys
import platform
from pathlib import Path
from typing import Any, List, Optional

# Import key definitions
from key_center import *


class FileVarSystem:
    """
    File-based variable system
    Each variable stored as a separate file
    Filename = KEY, Content = VALUE
    Uses global directory instead of project-local
    """

    def __init__(self, app_prefix: str, project_root: str):
        """
        Initialize file variable system

        Args:
            app_prefix: Prefix for variables (e.g., 'CMG_PORTAL')
            project_root: Root directory of the project (kept for compatibility)
        """
        self.app_prefix = app_prefix.upper()
        self.project_root = Path(project_root)

        # Determine global variable directory based on OS
        self.var_dir = self._get_global_var_dir()
        self.var_dir.mkdir(parents=True, exist_ok=True)

        # Print global variable directory info
        print(f"[FileVarSystem] Global variable directory: {self.var_dir}")
        print(f"[FileVarSystem] App prefix: {self.app_prefix}")

    def _get_global_var_dir(self) -> Path:
        """
        Get global variable directory based on operating system

        Returns:
            Path to global variable directory
        """
        system = platform.system()

        if system == "Windows":
            # Windows: C:\Users\USERNAME\.core_node\.build_global_vars
            user_home = Path.home()
            return user_home / ".core_node" / ".build_global_vars"
        elif system == "Linux":
            # Linux: /var/_core_node/_build_global_vars/
            linux_path = Path("/var/_core_node/_build_global_vars")

            # Check if we have write permission
            if os.access("/var/_core_node", os.W_OK) or os.access("/var", os.W_OK):
                return linux_path
            else:
                # Fallback to user home if no permission
                print(f"[WARNING] No write permission to /var, using fallback: ~/.core_node/.build_global_vars")
                return Path.home() / ".core_node" / ".build_global_vars"
        elif system == "Darwin":
            # macOS: Similar to Linux, use user home
            return Path.home() / ".core_node" / ".build_global_vars"
        else:
            # Unknown OS: fallback to user home
            print(f"[WARNING] Unknown OS: {system}, using fallback: ~/.core_node/.build_global_vars")
            return Path.home() / ".core_node" / ".build_global_vars"

    def _get_var_path(self, key: str) -> Path:
        """
        Get file path for a variable

        Args:
            key: Variable key

        Returns:
            Path to variable file
        """
        prefixed_key = f"{self.app_prefix}_{key}"
        return self.var_dir / prefixed_key

    def _get_cmd_path(self, index: int, field: str = None) -> Path:
        """
        Get file path for a command

        Args:
            index: Command index
            field: Optional field name

        Returns:
            Path to command file
        """
        if field:
            filename = f"{self.app_prefix}_COMMAND_{index}_{field}"
        else:
            filename = f"{self.app_prefix}_COMMAND_{index}"

        return self.var_dir / filename

    def set_var(self, key: str, value: Any) -> None:
        """
        Set a variable

        Args:
            key: Variable key
            value: Variable value
        """
        var_path = self._get_var_path(key)

        # Convert value to string
        if isinstance(value, (list, tuple)):
            # Store lists as newline-separated values
            content = '\n'.join(str(v) for v in value)
        else:
            content = str(value)

        # Write to file
        var_path.write_text(content, encoding='utf-8')

    def get_var(self, key: str, default: Any = None) -> Any:
        """
        Get a variable

        Args:
            key: Variable key
            default: Default value if not found

        Returns:
            Variable value or default
        """
        var_path = self._get_var_path(key)

        if not var_path.exists():
            return default

        try:
            content = var_path.read_text(encoding='utf-8')
            return content.strip()
        except:
            return default

    def get_var_as_list(self, key: str) -> List[str]:
        """
        Get a variable as a list (newline-separated)

        Args:
            key: Variable key

        Returns:
            List of values
        """
        content = self.get_var(key, '')
        if not content:
            return []

        lines = content.split('\n')
        return [line.strip() for line in lines if line.strip()]

    def set_vars(self, vars_dict: dict) -> None:
        """
        Set multiple variables at once

        Args:
            vars_dict: Dictionary of variables
        """
        for key, value in vars_dict.items():
            self.set_var(key, value)

    def get_all_vars(self) -> dict:
        """
        Get all variables for this app

        Returns:
            Dictionary of all variables
        """
        result = {}

        # List all files in var directory
        for var_file in self.var_dir.glob(f"{self.app_prefix}_*"):
            if var_file.is_file():
                # Remove prefix from key
                key = var_file.name[len(self.app_prefix) + 1:]
                result[key] = var_file.read_text(encoding='utf-8').strip()

        return result

    def clear_vars(self) -> None:
        """Clear all variables for this app"""
        for var_file in self.var_dir.glob(f"{self.app_prefix}_*"):
            if var_file.is_file():
                var_file.unlink()

    def add_command(self, command_type: str, description: str = "", working_dir: str = None) -> None:
        """
        Add a command to the execution queue

        Args:
            command_type: Command type/identifier
            description: Human-readable description
            working_dir: Working directory for command (optional)
        """
        # Get current command count
        count = self.get_command_count()

        # Write command fields
        self._write_command_field(count, FIELD_CMD_TYPE, command_type)
        self._write_command_field(count, FIELD_CMD_DESC, description)

        if working_dir:
            self._write_command_field(count, FIELD_CMD_WORKDIR, working_dir)

        # Increment count
        self.set_var(KEY_COMMAND_COUNT, count + 1)

    def _write_command_field(self, index: int, field: str, value: str) -> None:
        """Write a command field"""
        cmd_path = self._get_cmd_path(index, field)
        cmd_path.write_text(value, encoding='utf-8')

    def get_command_count(self) -> int:
        """Get the number of queued commands"""
        count_str = self.get_var(KEY_COMMAND_COUNT, '0')
        try:
            return int(count_str)
        except:
            return 0

    def get_command(self, index: int) -> dict:
        """
        Get a command by index

        Args:
            index: Command index

        Returns:
            Command dictionary with type, desc, and workdir
        """
        cmd_type_path = self._get_cmd_path(index, FIELD_CMD_TYPE)
        cmd_desc_path = self._get_cmd_path(index, FIELD_CMD_DESC)
        cmd_workdir_path = self._get_cmd_path(index, FIELD_CMD_WORKDIR)

        if not cmd_type_path.exists():
            return None

        command = {
            'type': cmd_type_path.read_text(encoding='utf-8').strip(),
            'desc': cmd_desc_path.read_text(encoding='utf-8').strip() if cmd_desc_path.exists() else '',
            'workdir': cmd_workdir_path.read_text(encoding='utf-8').strip() if cmd_workdir_path.exists() else ''
        }

        return command

    def get_commands(self) -> list:
        """
        Get all queued commands

        Returns:
            List of command dictionaries
        """
        count = self.get_command_count()
        commands = []

        for i in range(count):
            cmd = self.get_command(i)
            if cmd:
                commands.append(cmd)

        return commands

    def clear_commands(self) -> None:
        """Clear all queued commands"""
        # Clear command count
        self.set_var(KEY_COMMAND_COUNT, 0)

        # Remove all command files from main directory
        for cmd_file in self.var_dir.glob(f"{self.app_prefix}_COMMAND_*"):
            if cmd_file.is_file():
                cmd_file.unlink()

    def print_summary(self) -> None:
        """Print summary of stored variables and commands"""
        print("\n" + "=" * 60)
        print(f"File Variable System - {self.app_prefix}")
        print("=" * 60)

        # Variables
        vars_dict = self.get_all_vars()
        print(f"\nVariables ({len(vars_dict)}):")
        for key, value in sorted(vars_dict.items()):
            # Truncate long values
            display_value = value if len(value) < 60 else value[:57] + "..."
            print(f"  {key} = {display_value}")

        # Commands
        commands = self.get_commands()
        print(f"\nCommands ({len(commands)}):")
        for i, cmd in enumerate(commands):
            print(f"  [{i}] {cmd['type']}")
            if cmd['desc']:
                print(f"      {cmd['desc']}")
            if cmd['workdir']:
                print(f"      Working dir: {cmd['workdir']}")

        print("=" * 60)


def test_file_var_system(project_root: str):
    """Test the file variable system"""
    print("Testing File Variable System")
    print("=" * 60)

    # Initialize system
    var_system = FileVarSystem("TEST_APP", project_root)

    # Set some variables
    print("\nSetting variables...")
    var_system.set_var(KEY_APP_NAME, "TestApp")
    var_system.set_var(KEY_PACKAGE_ID, "com.test.app")
    var_system.set_var(KEY_CAPACITOR_CORE_PACKAGES, ["@capacitor/core", "@capacitor/cli"])

    # Get variables
    print("\nReading variables...")
    print(f"  APP_NAME: {var_system.get_var(KEY_APP_NAME)}")
    print(f"  PACKAGE_ID: {var_system.get_var(KEY_PACKAGE_ID)}")
    print(f"  CORE_PACKAGES: {var_system.get_var_as_list(KEY_CAPACITOR_CORE_PACKAGES)}")

    # Add commands
    print("\nAdding commands...")
    var_system.clear_commands()
    var_system.add_command("install_packages", "Install Capacitor packages", project_root)
    var_system.add_command("init_capacitor", "Initialize Capacitor", project_root)

    # Print summary
    var_system.print_summary()

    # Verify files were created
    print("\nVerifying files...")
    var_dir = Path(project_root) / ".build_vars"
    print(f"  Variable directory: {var_dir}")
    print(f"  Files created: {len(list(var_dir.glob('TEST_APP_*')))}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python file_var_system.py <project_root>")
        sys.exit(1)

    test_file_var_system(sys.argv[1])
