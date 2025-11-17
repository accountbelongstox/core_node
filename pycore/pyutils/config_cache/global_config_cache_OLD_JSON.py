#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Configuration Cache Manager

Stores global application settings shared between web interface and command-line:
- Default language
- Default TTS provider
- UI preferences
- Service settings
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import CACHE_DIR


class GlobalConfigCache:
    """
    Global Configuration Cache Manager

    Features:
    - Persistent storage for global settings
    - Shared between web interface and CLI
    - JSON-based storage
    - Auto-save on changes
    """

    # Default configuration
    DEFAULT_CONFIG = {
        'default_language': 'zh-CN',
        'default_tts_provider': 'edge',
        'default_stt_provider': 'azure',
        'supported_languages': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'],
        'web_interface_enabled': True,
        'clipboard_sync_enabled': True,
        'clipboard_sync_interval': 5,  # seconds
        'max_clipboard_history': 1000
    }

    def __init__(self, cache_file: Optional[Path] = None):
        """
        Initialize global config cache

        Args:
            cache_file: Path to cache file (default: CACHE_DIR/global_config.json)
        """
        if cache_file is None:
            cache_dir = Path(CACHE_DIR)
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file = cache_dir / "global_config.json"

        self.cache_file = Path(cache_file)
        self._config: Dict[str, Any] = self.DEFAULT_CONFIG.copy()
        self._load()

    def _load(self):
        """Load configuration from cache file"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                # Merge with defaults to ensure new keys are present
                self._config.update(loaded_config)
                ColorPrint.blue(f"[GlobalConfig] Loaded from: {self.cache_file}")
            except Exception as e:
                ColorPrint.yellow(f"[GlobalConfig] Failed to load: {e}, using defaults")
                self._config = self.DEFAULT_CONFIG.copy()
        else:
            ColorPrint.blue("[GlobalConfig] No cached config found, using defaults")
            self._save()  # Create file with defaults

    def _save(self):
        """Save configuration to cache file"""
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)
            ColorPrint.green(f"[GlobalConfig] Saved to: {self.cache_file}")
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to save: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value

        Args:
            key: Configuration key
            default: Default value if key doesn't exist

        Returns:
            Configuration value
        """
        return self._config.get(key, default)

    def set(self, key: str, value: Any) -> bool:
        """
        Set configuration value

        Args:
            key: Configuration key
            value: Configuration value

        Returns:
            True if saved successfully
        """
        try:
            self._config[key] = value
            self._save()
            ColorPrint.green(f"[GlobalConfig] Set {key} = {value}")
            return True
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to set {key}: {e}")
            return False

    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration

        Returns:
            Complete configuration dictionary
        """
        return self._config.copy()

    def update(self, config_dict: Dict[str, Any]) -> bool:
        """
        Update multiple configuration values

        Args:
            config_dict: Dictionary of key-value pairs to update

        Returns:
            True if saved successfully
        """
        try:
            self._config.update(config_dict)
            self._save()
            ColorPrint.green(f"[GlobalConfig] Updated {len(config_dict)} settings")
            return True
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to update: {e}")
            return False

    def reset_to_defaults(self):
        """Reset configuration to defaults"""
        self._config = self.DEFAULT_CONFIG.copy()
        self._save()
        ColorPrint.yellow("[GlobalConfig] Reset to defaults")

    def has_key(self, key: str) -> bool:
        """
        Check if configuration key exists

        Args:
            key: Configuration key

        Returns:
            True if key exists
        """
        return key in self._config

    def delete(self, key: str) -> bool:
        """
        Delete configuration key

        Args:
            key: Configuration key

        Returns:
            True if deleted successfully
        """
        if key in self._config:
            del self._config[key]
            self._save()
            ColorPrint.yellow(f"[GlobalConfig] Deleted key: {key}")
            return True
        return False

    # Convenience methods for common settings
    def get_default_language(self) -> str:
        """Get default language"""
        return self.get('default_language', 'zh-CN')

    def set_default_language(self, language: str):
        """Set default language"""
        self.set('default_language', language)

    def get_default_tts_provider(self) -> str:
        """Get default TTS provider"""
        return self.get('default_tts_provider', 'edge')

    def set_default_tts_provider(self, provider: str):
        """Set default TTS provider"""
        self.set('default_tts_provider', provider)

    def get_supported_languages(self) -> list:
        """Get supported languages"""
        return self.get('supported_languages', ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'])

    def is_clipboard_sync_enabled(self) -> bool:
        """Check if clipboard sync is enabled"""
        return self.get('clipboard_sync_enabled', True)

    def get_clipboard_sync_interval(self) -> int:
        """Get clipboard sync interval in seconds"""
        return self.get('clipboard_sync_interval', 5)

    def print_config(self):
        """Print current configuration"""
        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[Global Configuration]")
        ColorPrint.blue("=" * 70)

        for key, value in sorted(self._config.items()):
            print(f"{key}: {value}")

        ColorPrint.blue("=" * 70 + "\n")


# Global singleton instance
global_config_cache = GlobalConfigCache()
