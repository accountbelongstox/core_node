#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Variable System
Cross-platform variable exchange between Python and Shell scripts
Uses file-based variable storage with app-specific prefixes
"""

import os
import json
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional


class FileVarSystem:
    """
    File-based variable exchange system
    Variables are stored with app-specific prefix to avoid conflicts
    """

    def __init__(self, app_prefix: str, project_root: str):
        """
        Initialize file variable system

        Args:
            app_prefix: Prefix for variables (e.g., 'CMG_PORTAL')
            project_root: Root directory of the project
        """
        self.app_prefix = app_prefix.upper()
        self.project_root = Path(project_root)

        # Variable storage directory
        self.var_dir = self.project_root / ".build_vars"
        self.var_dir.mkdir(exist_ok=True)

        # Main variable file
        self.var_file = self.var_dir / f"{self.app_prefix}_vars.json"

        # Command queue file
        self.cmd_file = self.var_dir / f"{self.app_prefix}_commands.json"

    def set_var(self, key: str, value: Any) -> None:
        """
        Set a variable

        Args:
            key: Variable name (will be prefixed)
            value: Variable value
        """
        vars_data = self._load_vars()
        prefixed_key = f"{self.app_prefix}_{key}"
        vars_data[prefixed_key] = value
        self._save_vars(vars_data)

    def get_var(self, key: str, default: Any = None) -> Any:
        """
        Get a variable

        Args:
            key: Variable name (will be prefixed)
            default: Default value if not found

        Returns:
            Variable value or default
        """
        vars_data = self._load_vars()
        prefixed_key = f"{self.app_prefix}_{key}"
        return vars_data.get(prefixed_key, default)

    def set_vars(self, vars_dict: Dict[str, Any]) -> None:
        """
        Set multiple variables at once

        Args:
            vars_dict: Dictionary of variables
        """
        vars_data = self._load_vars()
        for key, value in vars_dict.items():
            prefixed_key = f"{self.app_prefix}_{key}"
            vars_data[prefixed_key] = value
        self._save_vars(vars_data)

    def get_all_vars(self) -> Dict[str, Any]:
        """
        Get all variables for this app

        Returns:
            Dictionary of all variables (without prefix in keys)
        """
        vars_data = self._load_vars()
        prefix_len = len(self.app_prefix) + 1

        result = {}
        for key, value in vars_data.items():
            if key.startswith(f"{self.app_prefix}_"):
                clean_key = key[prefix_len:]
                result[clean_key] = value

        return result

    def clear_vars(self) -> None:
        """Clear all variables for this app"""
        vars_data = self._load_vars()
        keys_to_remove = [k for k in vars_data.keys() if k.startswith(f"{self.app_prefix}_")]
        for key in keys_to_remove:
            del vars_data[key]
        self._save_vars(vars_data)

    def add_command(self, command: str, description: str = "", working_dir: str = None) -> None:
        """
        Add a command to the execution queue

        Args:
            command: Shell command to execute
            description: Human-readable description
            working_dir: Working directory for command (optional)
        """
        commands = self._load_commands()
        commands.append({
            "command": command,
            "description": description,
            "working_dir": working_dir or str(self.project_root)
        })
        self._save_commands(commands)

    def get_commands(self) -> list:
        """
        Get all queued commands

        Returns:
            List of command dictionaries
        """
        return self._load_commands()

    def clear_commands(self) -> None:
        """Clear all queued commands"""
        self._save_commands([])

    def _load_vars(self) -> Dict[str, Any]:
        """Load variables from file"""
        if not self.var_file.exists():
            return {}

        try:
            with open(self.var_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _save_vars(self, vars_data: Dict[str, Any]) -> None:
        """Save variables to file"""
        with open(self.var_file, 'w', encoding='utf-8') as f:
            json.dump(vars_data, f, ensure_ascii=False, indent=2)

    def _load_commands(self) -> list:
        """Load commands from file"""
        if not self.cmd_file.exists():
            return []

        try:
            with open(self.cmd_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []

    def _save_commands(self, commands: list) -> None:
        """Save commands to file"""
        with open(self.cmd_file, 'w', encoding='utf-8') as f:
            json.dump(commands, f, ensure_ascii=False, indent=2)

    def export_env_format(self, filepath: str) -> None:
        """
        Export variables in shell environment format
        For use with 'source' or '. ' in shell scripts

        Args:
            filepath: Output file path
        """
        vars_data = self.get_all_vars()

        with open(filepath, 'w', encoding='utf-8') as f:
            for key, value in vars_data.items():
                # Escape special characters for shell
                if isinstance(value, (list, dict)):
                    value_str = json.dumps(value)
                else:
                    value_str = str(value)

                # Write in format: VAR_NAME="value"
                prefixed_key = f"{self.app_prefix}_{key}"
                f.write(f'{prefixed_key}="{value_str}"\n')
