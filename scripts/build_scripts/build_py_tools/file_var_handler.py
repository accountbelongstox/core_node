#!/usr/bin/env python3

import os
import platform
from pathlib import Path

class FileVarHandler:
    def __init__(self):
        self.var_dir = self._get_var_dir()
        self._ensure_var_dir()

    def _get_var_dir(self):
        system = platform.system()
        if system == "Linux":
            return Path("/var/_core_node/global_var")
        elif system == "Windows":
            user_profile = os.environ.get("USERPROFILE")
            if not user_profile:
                raise Exception("USERPROFILE environment variable not found")
            return Path(user_profile) / ".core_node" / ".global_vars"
        else:
            raise Exception(f"Unsupported operating system: {system}")

    def _ensure_var_dir(self):
        self.var_dir.mkdir(parents=True, exist_ok=True)

    def _normalize_key(self, key):
        return key.upper().replace(" ", "_").replace("-", "_")

    def _get_file_path(self, key):
        normalized_key = self._normalize_key(key)
        return self.var_dir / normalized_key

    def set_var(self, key, value):
        file_path = self._get_file_path(key)
        try:
            file_path.write_text(str(value), encoding="utf-8")
            return True
        except Exception as e:
            print(f"Error writing variable {key}: {e}")
            return False

    def get_var(self, key, default_value=""):
        file_path = self._get_file_path(key)
        try:
            if file_path.exists():
                return file_path.read_text(encoding="utf-8").strip()
            return default_value
        except Exception as e:
            print(f"Error reading variable {key}: {e}")
            return default_value

    def remove_var(self, key):
        file_path = self._get_file_path(key)
        try:
            if file_path.exists():
                file_path.unlink()
            return True
        except Exception as e:
            print(f"Error removing variable {key}: {e}")
            return False

    def clear_all_vars(self):
        try:
            for file in self.var_dir.glob("*"):
                if file.is_file():
                    file.unlink()
            return True
        except Exception as e:
            print(f"Error clearing all variables: {e}")
            return False

    def list_all_vars(self):
        try:
            vars_dict = {}
            for file in self.var_dir.glob("*"):
                if file.is_file():
                    key = file.name
                    value = file.read_text(encoding="utf-8").strip()
                    vars_dict[key] = value
            return vars_dict
        except Exception as e:
            print(f"Error listing variables: {e}")
            return {}
