#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

from core.config import global_config, global_keys

class FileVariableManager:
    """Manages file-based variable storage for cross-process communication"""

    def __init__(self, gvar_dir: Path = None):
        self.gvar_dir = gvar_dir or global_config.gvar_exchange_dir
        self.gvar_dir.mkdir(parents=True, exist_ok=True)

    def set_file_variable(self, name: str, value: str):
        """Set a variable using file-based storage"""
        file_path = self.gvar_dir / name
        try:
            file_path.write_text(value, encoding='utf-8')
            if global_config.debug_mode:
                print(f"[DEBUG] Set File Variable: {name} = {value}", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] Failed to set file variable {name}: {e}", file=sys.stderr)

    def get_file_variable(self, name: str, default_value: str = "") -> str:
        """Get a variable from file-based storage"""
        file_path = self.gvar_dir / name

        if file_path.exists():
            try:
                content = file_path.read_text(encoding='utf-8').strip()
                # Remove UTF-8 BOM if present
                if content.startswith('\ufeff'):
                    content = content[1:]

                if global_config.debug_mode:
                    print(f"[DEBUG] Get File Variable: {name} = {content}", file=sys.stderr)

                return content
            except Exception as e:
                print(f"[ERROR] Failed to read file variable {name}: {e}", file=sys.stderr)
                return default_value

        return default_value

    def delete_file_variable(self, name: str):
        """Delete a file variable"""
        file_path = self.gvar_dir / name
        if file_path.exists():
            try:
                file_path.unlink()
                if global_config.debug_mode:
                    print(f"[DEBUG] Deleted File Variable: {name}", file=sys.stderr)
            except Exception as e:
                print(f"[ERROR] Failed to delete file variable {name}: {e}", file=sys.stderr)

    def list_file_variables(self) -> List[str]:
        """List all available file variables"""
        try:
            return [f.name for f in self.gvar_dir.iterdir() if f.is_file()]
        except Exception as e:
            print(f"[ERROR] Failed to list file variables: {e}", file=sys.stderr)
            return []

    def clear_all_variables(self):
        """Clear all file variables (use with caution)"""
        try:
            for file_path in self.gvar_dir.iterdir():
                if file_path.is_file():
                    file_path.unlink()
            print("[DEBUG] Cleared all file variables", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] Failed to clear file variables: {e}", file=sys.stderr)

class DebugSessionManager:
    """Manages debug session state and variables"""

    def __init__(self, file_manager: FileVariableManager = None):
        self.file_manager = file_manager or FileVariableManager()

    def get_current_selection(self) -> Dict[str, str]:
        """Get current app selection from file variables"""
        return {
            "app": self.file_manager.get_file_variable(global_keys.KEY_SELECTED_APP, ""),
            "action": self.file_manager.get_file_variable(global_keys.KEY_SELECTED_ACTION, "Debug"),
            "platform": self.file_manager.get_file_variable(global_keys.KEY_SELECTED_PLATFORM, "Web"),
            "entry_file": self.file_manager.get_file_variable(global_keys.KEY_SELECTED_ENTRY_FILE, ""),
            "debug_port": self.file_manager.get_file_variable(global_keys.KEY_DEBUG_PORT, "10000"),
            "app_index": self.file_manager.get_file_variable(global_keys.KEY_APP_INDEX, "0")
        }

    def set_current_selection(self, app_name: str, action: str, platform: str,
                            entry_file: str = "", debug_port: str = "", app_index: str = ""):
        """Set current app selection in file variables"""
        self.file_manager.set_file_variable(global_keys.KEY_SELECTED_APP, app_name)
        self.file_manager.set_file_variable(global_keys.KEY_SELECTED_ACTION, action)
        self.file_manager.set_file_variable(global_keys.KEY_SELECTED_PLATFORM, platform)

        if entry_file:
            self.file_manager.set_file_variable(global_keys.KEY_SELECTED_ENTRY_FILE, entry_file)
        if debug_port:
            self.file_manager.set_file_variable(global_keys.KEY_DEBUG_PORT, debug_port)
        if app_index:
            self.file_manager.set_file_variable(global_keys.KEY_APP_INDEX, app_index)

    def validate_selection(self) -> bool:
        """Validate that current selection has required values"""
        selection = self.get_current_selection()
        return bool(selection["app"] and selection["action"] and selection["platform"])

    def print_selection_summary(self):
        """Print current selection summary to stderr"""
        selection = self.get_current_selection()
        print("", file=sys.stderr)
        print("=" * 43, file=sys.stderr)
        print("Flutter Bloom Dev Debug - Current Selection", file=sys.stderr)
        print("=" * 43, file=sys.stderr)
        print("", file=sys.stderr)
        print(f"[MAIN-INFO] App:      {selection['app']}", file=sys.stderr)
        print(f"[MAIN-INFO] Action:   {selection['action']}", file=sys.stderr)
        print(f"[MAIN-INFO] Platform: {selection['platform']}", file=sys.stderr)
        if selection['entry_file']:
            print(f"[MAIN-INFO] Entry:    {selection['entry_file']}", file=sys.stderr)
        if selection['debug_port']:
            print(f"[MAIN-INFO] Port:     {selection['debug_port']}", file=sys.stderr)
        print("", file=sys.stderr)