#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Configuration - Centralized app settings
"""

import copy
import json
from pathlib import Path
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import LOCAL_CORE_NODE_DIR, PROJECT_ROOT
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.user_data_store import user_data_store

USER_DATA_SECTION = "flutter_dev_tools"
LEGACY_CONFIG_FILE = Path(LOCAL_CORE_NODE_DIR) / "flutter_dev_tools" / "config.json"


def _default_config() -> Dict[str, Any]:
    return {
        "server": {
            "host": "127.0.0.1",
            "port": 5757,
            "auto_kill_old_instances": True,
            "startup_wait_timeout": 3
        },
        "paths": {
            "flutter_root": str(Path(PROJECT_ROOT) / "poly_apps" / "flutter_bloom"),
            "apps_base_dir": "lib/apps",
            "design_docs_dirname": "design_docs_and_progress"
        },
        "features": {
            "auto_expand_structure": True,
            "auto_initialize_apps": True,
            "image_analysis_enabled": True,
            "comparison_system_enabled": True
        },
        "image_analysis": {
            "color_palette_top_n": 10,
            "ocr_model_type": "scene",
            "auto_analyze_on_upload": True
        },
        "comparison": {
            "external_storage_enabled": True,
            "label_expected": "Expected Design",
            "label_actual": "Actual Implementation",
            "label_height": 80,
            "separator_color": "#d1d5db",
            "label_color_expected": "#2563eb",
            "label_color_actual": "#dc2626"
        },
        "ui": {
            "theme": "light",
            "show_file_tree": True,
            "show_prompts_panel": True,
            "default_expand_all": True
        }
    }


def _deep_merge(base: Dict, override: Dict) -> Dict:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _read_legacy_config() -> Dict[str, Any]:
    if not LEGACY_CONFIG_FILE.exists():
        return {}
    try:
        with open(LEGACY_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        ColorPrint.red(f"[Config] Legacy config migration read failed: path={LEGACY_CONFIG_FILE} error={e}")
        return {}
    return data if isinstance(data, dict) else {}


class AppConfig:
    """Flutter dev tools settings backed by the unified user data store."""

    def __init__(self) -> None:
        self._config: Dict[str, Any] = {}
        init_serialized_owner(
            self,
            'flutter_dev_tools.app_config.state',
            'FlutterDevToolsAppConfigStateThread',
        )

    def _load(self) -> None:
        if not user_data_store.get_personalized_section(USER_DATA_SECTION):
            legacy = _read_legacy_config()
            if legacy:
                user_data_store.set_section(USER_DATA_SECTION, legacy)
        self._config = _deep_merge(_default_config(), user_data_store.get_section(USER_DATA_SECTION))
        ColorPrint.green(f"[Config] Loaded from {user_data_store.path}")

    def _ensure_loaded(self) -> None:
        if not self._config:
            self._load()

    @serialized_method
    def get(self, key_path: str, default: Any = None) -> Any:
        self._ensure_loaded()
        value = self._config
        for key in key_path.split('.'):
            if not (isinstance(value, dict) and key in value):
                return default
            value = value[key]
        return copy.deepcopy(value)

    @serialized_method
    def set(self, key_path: str, value: Any, save: bool = True) -> None:
        self._ensure_loaded()
        keys = key_path.split('.')
        config = self._config
        for key in keys[:-1]:
            config = config.setdefault(key, {})
        config[keys[-1]] = value
        if save:
            user_data_store.set_section(USER_DATA_SECTION, self._config)

    @serialized_method
    def reload(self) -> None:
        self._load()

    @serialized_method
    def reset(self) -> None:
        user_data_store.set_section(USER_DATA_SECTION, {})
        self._load()

    @serialized_method
    def get_all(self) -> Dict[str, Any]:
        self._ensure_loaded()
        return copy.deepcopy(self._config)


app_config = AppConfig()
