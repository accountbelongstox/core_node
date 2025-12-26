#!/usr/bin/env python3
r"""
Unified Global Variable Manager
Centralized variable storage system for cross-platform compatibility
Stores variables in: C:\Users\用户名\.core_node\.build_global_vars / /var/_core_node/_build_global_vars/
Format: filename=key, file_content=value
"""

# Import statements - all at top
import os
import platform
from pathlib import Path
from typing import Optional, Dict, Any
import json

# Import after Path is available
from variable_keys import VariableKeys, StatusValues


class GlobalVariableManager:
    """Unified variable manager for centralized storage"""

    def __init__(self):
        self.vars_dir = self._get_global_vars_directory()
        self._ensure_directory_exists()

    def _get_global_vars_directory(self) -> Path:
        """Get the global variables directory based on platform"""
        system = platform.system()

        if system == "Windows":
            # C:\Users\用户名\.core_node\.build_global_vars
            user_home = Path.home()
            vars_dir = user_home / ".core_node" / ".build_global_vars"
        else:
            # Linux: Always use /var/_core_node/_build_global_vars/
            vars_dir = Path("/var/_core_node/_build_global_vars")

        return vars_dir

    def _has_write_permission(self, directory: Path) -> bool:
        """Check if we have write permission to directory"""
        try:
            # For system directories like /var/_core_node, we need to check parent write permission
            # and ability to create the full path
            test_path = directory

            # Find the closest existing parent directory
            while test_path and not test_path.exists():
                test_path = test_path.parent
                if test_path == test_path.parent:  # Reached root
                    return False

            if not test_path:
                return False

            # Try to create the directory structure
            directory.mkdir(parents=True, exist_ok=True)

            # Test write permission with a temporary file
            test_file = directory / ".write_test"
            test_file.touch()
            test_file.unlink()
            return True
        except (OSError, PermissionError):
            return False

    def _ensure_directory_exists(self) -> None:
        """Ensure the variables directory exists"""
        try:
            self.vars_dir.mkdir(parents=True, exist_ok=True)
            # Set appropriate permissions on Unix-like systems
            if platform.system() in ['Linux', 'Darwin']:
                os.chmod(self.vars_dir, 0o755)
        except (OSError, PermissionError) as e:
            raise RuntimeError(f"Cannot create variables directory {self.vars_dir}: {e}")

    def write_var(self, key: str, value: Any) -> None:
        """Write a variable to the global storage"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key

        # Convert value to string
        if isinstance(value, (dict, list)):
            content = json.dumps(value, ensure_ascii=False, indent=None)
        elif isinstance(value, bool):
            content = str(value).lower()
        else:
            content = str(value)

        try:
            var_file.write_text(content, encoding='utf-8')
        except (OSError, PermissionError) as e:
            raise RuntimeError(f"Cannot write variable {key}: {e}")

    def read_var(self, key: str, default: Any = "") -> str:
        """Read a variable from global storage"""
        if not key:
            return str(default)

        var_file = self.vars_dir / key

        if var_file.exists():
            try:
                content = var_file.read_text(encoding='utf-8').strip()
                return content if content else str(default)
            except (OSError, PermissionError):
                pass

        return str(default)

    def read_json(self, key: str, default: Dict = None) -> Dict:
        """Read a JSON variable from global storage"""
        content = self.read_var(key, "")
        if content:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
        return default or {}

    def read_bool(self, key: str, default: bool = False) -> bool:
        """Read a boolean variable from global storage"""
        value = self.read_var(key, str(default).lower()).lower()
        return value in ('true', '1', 'yes', 'on')

    def read_int(self, key: str, default: int = 0) -> int:
        """Read an integer variable from global storage"""
        value = self.read_var(key, str(default))
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def delete_var(self, key: str) -> bool:
        """Delete a variable from global storage"""
        if not key:
            return False

        var_file = self.vars_dir / key
        if var_file.exists():
            try:
                var_file.unlink()
                return True
            except (OSError, PermissionError):
                pass
        return False

    def clear_all(self) -> int:
        """Clear all variables from global storage"""
        deleted_count = 0
        try:
            for var_file in self.vars_dir.iterdir():
                if var_file.is_file():
                    try:
                        var_file.unlink()
                        deleted_count += 1
                    except (OSError, PermissionError):
                        pass
        except (OSError, PermissionError):
            pass
        return deleted_count

    def list_vars(self) -> list:
        """List all variable keys in global storage"""
        try:
            return [f.name for f in self.vars_dir.iterdir() if f.is_file()]
        except (OSError, PermissionError):
            return []

    def get_vars_directory(self) -> str:
        """Get the variables directory path"""
        return str(self.vars_dir)

    def exists(self, key: str) -> bool:
        """Check if a variable exists in global storage"""
        if not key:
            return False
        var_file = self.vars_dir / key
        return var_file.exists()

    # Convenience methods using VariableKeys
    def write_status(self, status: str) -> None:
        """Write status using standard key"""
        self.write_var(VariableKeys.STATUS, status)

    def read_status(self) -> str:
        """Read status using standard key"""
        return self.read_var(VariableKeys.STATUS, "")

    def write_app_count(self, count: int) -> None:
        """Write app count using standard key"""
        self.write_var(VariableKeys.APP_COUNT, count)

    def read_app_count(self) -> int:
        """Read app count using standard key"""
        return self.read_int(VariableKeys.APP_COUNT, 0)

    def write_platform_info(self, platform_name: str, is_windows: bool, is_linux: bool) -> None:
        """Write platform information using standard keys"""
        self.write_var(VariableKeys.PLATFORM, platform_name)
        self.write_var(VariableKeys.IS_WINDOWS, is_windows)
        self.write_var(VariableKeys.IS_LINUX, is_linux)

    def write_app_data(self, index: int, name: str, path: str, app_type: str,
                      framework: str, port: int, command: str, debug: bool) -> None:
        """Write application data using standard keys"""
        self.write_var(VariableKeys.app_name(index), name)
        self.write_var(VariableKeys.app_path(index), path)
        self.write_var(VariableKeys.app_type(index), app_type)
        self.write_var(VariableKeys.app_framework(index), framework)
        self.write_var(VariableKeys.app_port(index), port)
        self.write_var(VariableKeys.app_command(index), command)
        self.write_var(VariableKeys.app_debug(index), debug)


# Global instance for easy import
global_vars = GlobalVariableManager()

# Export for easy import
__all__ = ['GlobalVariableManager', 'global_vars', 'VariableKeys', 'StatusValues']