#!/usr/bin/env python3
"""
Variable Manager - Python version
Unified variable management library for reading/writing file variables
"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional, Dict


class VarManager:
    """Variable manager"""

    def __init__(self):
        """Initialize variable manager"""
        self.platform = self._detect_platform()
        self.vars_dir = self._get_vars_dir()
        self._ensure_vars_dir()

    @staticmethod
    def _detect_platform() -> str:
        """Detect current platform"""
        system = platform.system().lower()
        if system == "windows":
            return "windows"
        elif system == "darwin":
            return "darwin"
        else:
            return "linux"

    def _get_vars_dir(self) -> Path:
        """Get variable storage directory"""
        if self.platform == "windows":
            # Windows: C:\Users\username\.core_node\.build_global_vars
            home = Path.home()
            return home / ".core_node" / ".build_global_vars"
        else:
            # Linux/macOS: /var/_core_node/_build_global_vars/
            # If no permission to write to /var, use user directory
            var_dir = Path("/var/_core_node/_build_global_vars")
            if not var_dir.exists():
                try:
                    var_dir.mkdir(parents=True, exist_ok=True)
                    return var_dir
                except PermissionError:
                    # Fallback to user directory
                    home = Path.home()
                    return home / ".core_node" / ".build_global_vars"
            return var_dir

    def _ensure_vars_dir(self):
        """Ensure variable directory exists"""
        try:
            self.vars_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"ERROR: Failed to create vars directory: {self.vars_dir}", file=sys.stderr)
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)

    def set(self, key: str, value: str):
        """Set variable (write to file)"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        try:
            with open(var_file, "w", encoding="utf-8") as f:
                f.write(value)
        except Exception as e:
            print(f"ERROR: Failed to write variable '{key}': {e}", file=sys.stderr)
            raise

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get variable (read from file)"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        if not var_file.exists():
            return default

        try:
            with open(var_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"WARNING: Failed to read variable '{key}': {e}", file=sys.stderr)
            return default

    def delete(self, key: str):
        """Delete variable (delete file)"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        if var_file.exists():
            try:
                var_file.unlink()
            except Exception as e:
                print(f"WARNING: Failed to delete variable '{key}': {e}", file=sys.stderr)

    def clear_all(self):
        """Clear all variables"""
        if not self.vars_dir.exists():
            return

        for var_file in self.vars_dir.iterdir():
            if var_file.is_file():
                try:
                    var_file.unlink()
                except Exception as e:
                    print(f"WARNING: Failed to delete {var_file.name}: {e}", file=sys.stderr)

    def list_all(self) -> Dict[str, str]:
        """List all variables"""
        if not self.vars_dir.exists():
            return {}

        result = {}
        for var_file in self.vars_dir.iterdir():
            if var_file.is_file():
                try:
                    with open(var_file, "r", encoding="utf-8") as f:
                        result[var_file.name] = f.read()
                except Exception as e:
                    print(f"WARNING: Failed to read {var_file.name}: {e}", file=sys.stderr)

        return result

    def exists(self, key: str) -> bool:
        """Check if variable exists"""
        if not key:
            return False
        var_file = self.vars_dir / key
        return var_file.exists()

    def get_vars_dir_path(self) -> str:
        """Get variable directory path (string)"""
        return str(self.vars_dir)


# Global singleton
_instance = None


def get_instance() -> VarManager:
    """Get global VarManager instance"""
    global _instance
    if _instance is None:
        _instance = VarManager()
    return _instance
