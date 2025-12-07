"""
File Variable System for React Native Build Scripts
Uses local GlobalVarManager for inter-process communication
All communication must go through files, no direct variable passing
"""

import sys
import os
from pathlib import Path

# Import local GlobalVarManager (no external dependencies)
from global_var_manager import GlobalVarManager
from key_center import (
    KEY_MENU_SELECTION, KEY_BUILD_STATE, KEY_ERROR,
    get_command_key, get_app_config_key, get_result_key
)


class FileVarSystem:
    """
    File-based variable system for React Native build scripts
    All communication between Python and PowerShell/Shell scripts goes through files
    """

    def __init__(self, namespace: str = "RN_BUILD"):
        """
        Initialize file variable system

        Args:
            namespace: Namespace for variable isolation
        """
        self.gvm = GlobalVarManager(namespace=namespace)
        self.namespace = namespace

    # ============ Command File Operations ============

    def write_command(self, command_type: str, command_data: dict) -> Path:
        """
        Write command to file for PowerShell/Shell to execute

        Args:
            command_type: Type of command (e.g., "BUILD_ANDROID", "BUILD_IOS", "RUN_TEST")
            command_data: Command parameters as dictionary

        Returns:
            Path to command file
        """
        command_file = {
            "type": command_type,
            "data": command_data,
            "status": "PENDING"
        }
        return self.gvm.set_json(get_command_key(command_type), command_file)

    def read_command_status(self, command_type: str) -> dict:
        """
        Read command execution status from file

        Args:
            command_type: Type of command

        Returns:
            Command status dictionary or None
        """
        return self.gvm.get_json(get_command_key(command_type), default=None)

    def clear_command(self, command_type: str) -> None:
        """
        Clear command file after execution

        Args:
            command_type: Type of command
        """
        self.gvm.clear(get_command_key(command_type))

    # ============ Build State Operations ============

    def set_build_state(self, state: dict) -> Path:
        """
        Set build state information

        Args:
            state: Build state dictionary

        Returns:
            Path to state file
        """
        return self.gvm.set_json(KEY_BUILD_STATE, state)

    def get_build_state(self) -> dict:
        """
        Get current build state

        Returns:
            Build state dictionary or empty dict
        """
        return self.gvm.get_json(KEY_BUILD_STATE, default={})

    def clear_build_state(self) -> None:
        """
        Clear build state
        """
        self.gvm.clear(KEY_BUILD_STATE)

    # ============ App Configuration Operations ============

    def set_app_config(self, app_name: str, config: dict) -> Path:
        """
        Set app configuration

        Args:
            app_name: App namespace
            config: Configuration dictionary

        Returns:
            Path to config file
        """
        return self.gvm.set_json(get_app_config_key(app_name), config)

    def get_app_config(self, app_name: str) -> dict:
        """
        Get app configuration

        Args:
            app_name: App namespace

        Returns:
            Configuration dictionary or empty dict
        """
        return self.gvm.get_json(get_app_config_key(app_name), default={})

    # ============ Menu State Operations ============

    def set_menu_selection(self, selection: dict) -> Path:
        """
        Set menu selection result

        Args:
            selection: Selection dictionary with app, mode, platform

        Returns:
            Path to selection file
        """
        return self.gvm.set_json(KEY_MENU_SELECTION, selection)

    def get_menu_selection(self) -> dict:
        """
        Get menu selection

        Returns:
            Selection dictionary or None
        """
        return self.gvm.get_json(KEY_MENU_SELECTION, default=None)

    def clear_menu_selection(self) -> None:
        """
        Clear menu selection
        """
        self.gvm.clear(KEY_MENU_SELECTION)

    # ============ Status Operations ============

    def set_status(self, status_key: str, status_value: str) -> Path:
        """
        Set status value

        Args:
            status_key: Status key
            status_value: Status value

        Returns:
            Path to status file
        """
        return self.gvm.set(status_key, status_value)

    def get_status(self, status_key: str, default: str = None) -> str:
        """
        Get status value

        Args:
            status_key: Status key
            default: Default value if not found

        Returns:
            Status value or default
        """
        return self.gvm.get(status_key, default=default)

    def set_status_json(self, status_key: str, status_data: dict) -> Path:
        """
        Set status as JSON

        Args:
            status_key: Status key
            status_data: Status data dictionary

        Returns:
            Path to status file
        """
        return self.gvm.set_json(status_key, status_data)

    def get_status_json(self, status_key: str, default: dict = None) -> dict:
        """
        Get status as JSON

        Args:
            status_key: Status key
            default: Default value if not found

        Returns:
            Status data dictionary or default
        """
        return self.gvm.get_json(status_key, default=default)

    # ============ Error Operations ============

    def set_error(self, error_message: str) -> Path:
        """
        Set error message

        Args:
            error_message: Error message

        Returns:
            Path to error file
        """
        return self.gvm.set(KEY_ERROR, error_message)

    def get_error(self) -> str:
        """
        Get error message

        Returns:
            Error message or None
        """
        return self.gvm.get(KEY_ERROR, default=None)

    def clear_error(self) -> None:
        """
        Clear error message
        """
        self.gvm.clear(KEY_ERROR)

    # ============ Result Operations ============

    def set_result(self, result_key: str, result_data: dict) -> Path:
        """
        Set command result

        Args:
            result_key: Result key
            result_data: Result data dictionary

        Returns:
            Path to result file
        """
        return self.gvm.set_json(get_result_key(result_key), result_data)

    def get_result(self, result_key: str) -> dict:
        """
        Get command result

        Args:
            result_key: Result key

        Returns:
            Result data dictionary or None
        """
        return self.gvm.get_json(get_result_key(result_key), default=None)

    def clear_result(self, result_key: str) -> None:
        """
        Clear command result

        Args:
            result_key: Result key
        """
        self.gvm.clear(get_result_key(result_key))
