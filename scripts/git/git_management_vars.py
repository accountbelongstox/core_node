#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git Management Global Variables Manager
Uses file-based variables instead of exit codes/return values
All variables stored in flat directory structure: key=filename, value=content
"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional, Dict, Any


class GitManagementVars:
    """
    Manages global variables for Git Management operations
    Stores all variables as files in a flat directory structure
    """

    def __init__(self):
        """Initialize the variables manager"""
        self.vars_dir = self._get_vars_directory()
        self._ensure_vars_directory()

    def _get_vars_directory(self) -> Path:
        """
        Get the global variables directory based on OS
        Windows: C:/Users/username/.core_node/.build_global_vars/
        Linux: /var/_core_node/_build_global_vars/
        """
        if platform.system() == "Windows":
            # Windows path (use forward slashes to avoid escape issues)
            username = os.environ.get("USERNAME", "user")
            base_dir = Path(f"C:/Users/{username}/.core_node/.build_global_vars")
        else:
            # Linux/Unix path
            base_dir = Path("/var/_core_node/_build_global_vars")

        return base_dir

    def _ensure_vars_directory(self):
        """Ensure the variables directory exists"""
        try:
            self.vars_dir.mkdir(parents=True, exist_ok=True)
            # Ensure proper permissions on Linux
            if platform.system() != "Windows":
                os.chmod(self.vars_dir, 0o755)
        except Exception as e:
            print(f"Warning: Could not create vars directory: {e}", file=sys.stderr)

    def set_var(self, key: str, value: str) -> bool:
        """
        Set a variable by writing to a file
        Args:
            key: Variable name (will be used as filename)
            value: Variable value (will be file content)
        Returns:
            True if successful, False otherwise
        """
        try:
            # Sanitize key to be a valid filename
            safe_key = self._sanitize_key(key)
            var_file = self.vars_dir / safe_key

            # Write value to file
            with open(var_file, 'w', encoding='utf-8') as f:
                f.write(str(value))

            return True
        except Exception as e:
            print(f"Error setting variable {key}: {e}", file=sys.stderr)
            return False

    def get_var(self, key: str, default: str = "") -> str:
        """
        Get a variable by reading from a file
        Args:
            key: Variable name (filename)
            default: Default value if variable doesn't exist
        Returns:
            Variable value or default
        """
        try:
            safe_key = self._sanitize_key(key)
            var_file = self.vars_dir / safe_key

            if var_file.exists():
                with open(var_file, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            else:
                return default
        except Exception as e:
            print(f"Error getting variable {key}: {e}", file=sys.stderr)
            return default

    def delete_var(self, key: str) -> bool:
        """
        Delete a variable by removing its file
        Args:
            key: Variable name (filename)
        Returns:
            True if successful, False otherwise
        """
        try:
            safe_key = self._sanitize_key(key)
            var_file = self.vars_dir / safe_key

            if var_file.exists():
                var_file.unlink()
            return True
        except Exception as e:
            print(f"Error deleting variable {key}: {e}", file=sys.stderr)
            return False

    def var_exists(self, key: str) -> bool:
        """
        Check if a variable exists
        Args:
            key: Variable name (filename)
        Returns:
            True if variable exists, False otherwise
        """
        safe_key = self._sanitize_key(key)
        var_file = self.vars_dir / safe_key
        return var_file.exists()

    def list_vars(self) -> Dict[str, str]:
        """
        List all variables
        Returns:
            Dictionary of key-value pairs
        """
        vars_dict = {}
        try:
            if self.vars_dir.exists():
                for var_file in self.vars_dir.iterdir():
                    if var_file.is_file():
                        key = var_file.name
                        try:
                            with open(var_file, 'r', encoding='utf-8') as f:
                                value = f.read().strip()
                            vars_dict[key] = value
                        except Exception:
                            pass
        except Exception as e:
            print(f"Error listing variables: {e}", file=sys.stderr)

        return vars_dict

    def clear_all_vars(self) -> bool:
        """
        Clear all variables (delete all files)
        Returns:
            True if successful, False otherwise
        """
        try:
            if self.vars_dir.exists():
                for var_file in self.vars_dir.iterdir():
                    if var_file.is_file():
                        var_file.unlink()
            return True
        except Exception as e:
            print(f"Error clearing variables: {e}", file=sys.stderr)
            return False

    def _sanitize_key(self, key: str) -> str:
        """
        Sanitize key to be a valid filename
        Args:
            key: Original key
        Returns:
            Sanitized key safe for use as filename
        """
        # Replace invalid characters with underscores
        invalid_chars = '<>:"/\\|?*'
        safe_key = key
        for char in invalid_chars:
            safe_key = safe_key.replace(char, '_')

        # Remove any remaining problematic characters
        safe_key = ''.join(c for c in safe_key if c.isprintable())

        return safe_key

    def get_vars_dir_path(self) -> str:
        """
        Get the variables directory path as a string
        Returns:
            Path to variables directory
        """
        return str(self.vars_dir)


# Git Management specific variable keys
class GitVarKeys:
    """Standard variable keys used in Git Management"""

    # Operation status
    OPERATION_STATUS = "git_operation_status"
    OPERATION_MESSAGE = "git_operation_message"
    OPERATION_TYPE = "git_operation_type"

    # Menu navigation
    MENU_CHOICE = "git_menu_choice"
    MENU_BACK = "git_menu_back"

    # Git operation parameters
    GIT_REMOTE = "git_remote"
    GIT_BRANCH = "git_branch"
    GIT_FORCE_MODE = "git_force_mode"

    # Confirmation flags
    CONFIRM_FIRST = "git_confirm_first"
    CONFIRM_SECOND = "git_confirm_second"

    # Shell command to execute
    SHELL_COMMAND = "git_shell_command"
    SHELL_SCRIPT = "git_shell_script"

    # Backup information
    BACKUP_BRANCH = "git_backup_branch"

    # Status codes (using strings instead of integers)
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_PENDING = "pending"


# Convenience functions
def get_git_vars() -> GitManagementVars:
    """Get a GitManagementVars instance"""
    return GitManagementVars()


def set_git_var(key: str, value: str) -> bool:
    """Convenience function to set a git variable"""
    return get_git_vars().set_var(key, value)


def get_git_var(key: str, default: str = "") -> str:
    """Convenience function to get a git variable"""
    return get_git_vars().get_var(key, default)


if __name__ == "__main__":
    # Test the module
    vars_mgr = GitManagementVars()
    print(f"Variables directory: {vars_mgr.get_vars_dir_path()}")

    # Test setting and getting variables
    vars_mgr.set_var(GitVarKeys.OPERATION_STATUS, GitVarKeys.STATUS_SUCCESS)
    vars_mgr.set_var(GitVarKeys.OPERATION_MESSAGE, "Test operation completed")

    print(f"Status: {vars_mgr.get_var(GitVarKeys.OPERATION_STATUS)}")
    print(f"Message: {vars_mgr.get_var(GitVarKeys.OPERATION_MESSAGE)}")

    # List all variables
    print("\nAll variables:")
    for key, value in vars_mgr.list_vars().items():
        print(f"  {key} = {value}")
