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
            base = os.environ.get("CORE_NODE_DATA_DIR")
            if base:
                return Path(base) / "global_var"
            www_base = "/www/www" if self._www_data_root_mounted() else "/www"
            return Path(www_base) / "core_node" / "global_var"
        elif system == "Windows":
            return Path("D:/www/core_node/global_var")
        else:
            raise Exception(f"Unsupported operating system: {system}")

    @staticmethod
    def _www_data_root_mounted():
        try:
            return (
                os.path.isdir("/www/www")
                and os.path.ismount("/www")
                and os.stat("/www").st_dev != os.stat("/").st_dev
            )
        except OSError:
            return False

    def _legacy_var_dirs(self):
        if platform.system() == "Linux":
            return [Path("/var/_core_node/global_var")]
        user_profile = os.environ.get("USERPROFILE", "")
        username = os.environ.get("USERNAME", os.environ.get("USER", "default"))
        return [
            Path("D:/programing/Users") / username / ".core_node" / ".global_vars",
            Path(user_profile) / ".core_node" / ".global_vars",
        ] if user_profile else [
            Path("D:/programing/Users") / username / ".core_node" / ".global_vars",
        ]

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
            for legacy_dir in self._legacy_var_dirs():
                legacy_path = legacy_dir / self._normalize_key(key)
                if legacy_path.exists():
                    return legacy_path.read_text(encoding="utf-8").strip()
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
