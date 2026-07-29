#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Configuration - Centralized app settings
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional

# Import from pycore following PYTHON_PYCORE.md standards
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pygvar.constants import IS_WINDOWS, PROJECT_ROOT, CACHE_DIR, LOCAL_CORE_NODE_DIR

# Configuration cache key prefix
CONFIG_CACHE_PREFIX = "flutter_dev_tool_config"


class AppConfig:
    """
    Application configuration manager

    Features:
    - Loads configuration from JSON file
    - Caches config in Encyclopedia for fast access
    - Provides default values
    - Supports runtime config updates
    """

    def __init__(self, config_file: Optional[Path] = None):
        """
        Initialize configuration

        Args:
            config_file: Path to config JSON file (optional)
        """
        self.encyclopedia = ENCYCLOPEDIA

        # Default config file location
        if config_file is None:
            config_dir = Path(LOCAL_CORE_NODE_DIR) / "flutter_dev_tools"
            config_dir.mkdir(parents=True, exist_ok=True)
            config_file = config_dir / "config.json"

        self.config_file = Path(config_file)
        self._config: Dict[str, Any] = {}

        # Load config
        self._load_config()

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
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

    def _load_config(self) -> None:
        """Load configuration from file or use defaults"""
        cache_key = f"{CONFIG_CACHE_PREFIX}_main"

        # Try to load from cache first
        cached_config = self.encyclopedia.get(cache_key)
        if cached_config:
            self._config = cached_config
            ColorPrint.green("[Config] Loaded from cache")
            return

        # Load from file
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)

                # Merge with defaults (file config overwrites defaults)
                self._config = self._deep_merge(self._get_default_config(), file_config)

                # Cache the config
                self.encyclopedia.add(cache_key, self._config)

                ColorPrint.green(f"[Config] Loaded from {self.config_file}")
            except Exception as e:
                ColorPrint.red(f"[Config] Failed to load config file: {e}")
                self._config = self._get_default_config()
        else:
            # Use defaults and save to file
            self._config = self._get_default_config()
            self._save_config()

            # Cache the config
            self.encyclopedia.add(cache_key, self._config)

            ColorPrint.yellow(f"[Config] Created default config at {self.config_file}")

    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """
        Deep merge two dictionaries

        Args:
            base: Base dictionary
            override: Override dictionary

        Returns:
            Merged dictionary
        """
        result = base.copy()

        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value

        return result

    def _save_config(self) -> None:
        """Save configuration to file"""
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)

            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)

            ColorPrint.green(f"[Config] Saved to {self.config_file}")
        except Exception as e:
            ColorPrint.red(f"[Config] Failed to save config: {e}")

    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value by dot-separated path

        Args:
            key_path: Dot-separated key path (e.g., "server.port")
            default: Default value if key not found

        Returns:
            Configuration value
        """
        keys = key_path.split('.')
        value = self._config

        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default

        return value

    def set(self, key_path: str, value: Any, save: bool = True) -> None:
        """
        Set configuration value by dot-separated path

        Args:
            key_path: Dot-separated key path (e.g., "server.port")
            value: Value to set
            save: Whether to save to file immediately
        """
        keys = key_path.split('.')
        config = self._config

        # Navigate to the parent dictionary
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]

        # Set the value
        config[keys[-1]] = value

        # Update cache
        cache_key = f"{CONFIG_CACHE_PREFIX}_main"
        self.encyclopedia.add(cache_key, self._config)

        # Save to file if requested
        if save:
            self._save_config()

    def reload(self) -> None:
        """Reload configuration from file"""
        # Clear cache
        cache_key = f"{CONFIG_CACHE_PREFIX}_main"
        self.encyclopedia.remove(cache_key)

        # Reload
        self._load_config()

    def get_all(self) -> Dict[str, Any]:
        """Get entire configuration dictionary"""
        return self._config.copy()


# Singleton instance
_app_config_instance: Optional[AppConfig] = None


def get_app_config() -> AppConfig:
    """
    Get singleton AppConfig instance

    Returns:
        AppConfig instance
    """
    global _app_config_instance

    if _app_config_instance is None:
        _app_config_instance = AppConfig()

    return _app_config_instance
