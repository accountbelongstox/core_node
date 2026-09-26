#!/usr/bin/env python3

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from pycore.pyfoundations.core_node_dirs import (
    get_global_var_dir,
    global_var_read_names,
    global_var_write_name,
    iter_global_var_dirs,
)

class FileVarHandler:
    def __init__(self):
        self.var_dir = self._get_var_dir()
        self._ensure_var_dir()

    def _get_var_dir(self):
        return get_global_var_dir()

    def _ensure_var_dir(self):
        self.var_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, key):
        return self.var_dir / global_var_write_name(key)

    def set_var(self, key, value):
        file_path = self._get_file_path(key)
        try:
            file_path.write_text(str(value), encoding="utf-8")
            return True
        except Exception as e:
            print(f"Error writing variable {key}: {e}")
            return False

    def get_var(self, key, default_value=""):
        try:
            for legacy_dir in iter_global_var_dirs():
                for candidate_name in global_var_read_names(key):
                    legacy_path = legacy_dir / candidate_name
                    if legacy_path.is_file():
                        return legacy_path.read_text(encoding="utf-8").strip()
            return default_value
        except Exception as e:
            print(f"Error reading variable {key}: {e}")
            return default_value

    def remove_var(self, key):
        file_path = self._get_file_path(key)
        try:
            if file_path.is_file():
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
