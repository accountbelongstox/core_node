#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Configuration Manager (SQLite Backend)

Unified configuration management for all applications.
Replaces JSON-based configs with database-backed configuration.

Architecture:
- Common directory (not util-specific)
- SQLite backend (common.config table)
- Thread-safe operations
- Automatic initialization
- Backward compatible API
"""

import json
from typing import Optional, Dict, Any
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.database.exports import get_database_manager

from pycore.database.models.table_keys import TableKeys

from pycore.database.models.common.config_model import CommonConfigModel




class GlobalConfig:
    """
    Global Configuration Manager (SQLite Backend)

    Unified configuration for all apps and utilities.
    Stored in common.config database table.

    Features:
    - Persistent SQLite storage
    - Thread-safe operations
    - Automatic DEFAULT_CONFIG initialization
    - JSON value serialization
    - Same API as old GlobalConfigCache (backward compatible)
    """

    # ===== Default Configuration (Unified) =====
    DEFAULT_CONFIG = {
        # --- Global App Settings ---
        'default_language': 'zh-CN',
        'supported_languages': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'],
        'web_interface_enabled': True,

        # --- TTS/STT Settings ---
        'default_tts_provider': 'edge',
        'default_stt_provider': 'azure',

        # --- Clipboard Settings ---
        'clipboard_sync_enabled': True,
        'clipboard_sync_interval': 5,  # seconds
        'max_clipboard_history': 1000,

        # --- Speech Application Settings ---
        'speech_default_language': 'zh-CN',
        'speech_default_device': None,
        'speech_default_mode': 'microphone',
        'speech_auto_use_cached': True,  # Skip interactive prompts
        'speech_tts_voice': 'zh-CN-XiaoxiaoNeural',
        'speech_tts_rate': '+0%',
        'speech_tts_volume': '+0%',
        'speech_stt_continuous': True,
        'speech_cache_audio': True,
        'speech_cache_text': True,
    }

    def __init__(self, database_name: str = 'common'):
        """
        Initialize Global Config Manager

        Args:
            database_name: Database name (default: 'common')
        """
        self.database_name = database_name
        self._db_manager = None
        self._config_model = None
        self._initialized = False

        # Auto-initialize
        self._initialize()
        init_serialized_owner(
            self,
            'pyutils.global_config.state',
            'GlobalConfigStateThread',
            timeout=300.0,
        )

    def _initialize(self):
        """Initialize database connection and table (lazy)"""
        if self._initialized:
            return

        try:
            # Get database manager
            self._db_manager = get_database_manager()

            # Get config model
            self._config_model = CommonConfigModel

            # Register common database if not already registered
            if not self._db_manager.is_database_registered('common'):
                self._db_manager.register_database(database_name='common')

            # Load config table if not already loaded
            if not self._db_manager.is_table_loaded('common.config'):
                self._db_manager.load_tables(
                    table_keys=[TableKeys.COMMON_CONFIG],
                    models=[CommonConfigModel],
                    database_name='common'
                )

            # Initialize default config if not exists
            self._ensure_defaults()

            self._initialized = True
            ColorPrint.blue(f"[GlobalConfig] Initialized with SQLite database: {self.database_name}")

        except Exception as e:
            ColorPrint.yellow(f"[GlobalConfig] Initialization deferred: {e}")
            # Don't raise - allow lazy initialization
            self._initialized = False

    def _ensure_defaults(self):
        """Ensure all DEFAULT_CONFIG keys exist in database"""
        with self._db_manager.get_connection(self.database_name) as conn:
            initialized_count = 0
            for key, default_value in self.DEFAULT_CONFIG.items():
                if not self._config_model.key_exists(conn, key):
                    # Serialize value to JSON
                    value_str = self._serialize_value(default_value)
                    self._config_model.set_value(
                        conn,
                        key=key,
                        value=value_str,
                        description=f"Default configuration for {key}"
                    )
                    initialized_count += 1

            if initialized_count > 0:
                ColorPrint.green(f"[GlobalConfig] Initialized {initialized_count} default config keys")

    def _serialize_value(self, value: Any) -> str:
        """Serialize value to JSON string"""
        return json.dumps(value, ensure_ascii=False)

    def _deserialize_value(self, value_str: str) -> Any:
        """Deserialize value from JSON string"""
        try:
            return json.loads(value_str)
        except (json.JSONDecodeError, TypeError):
            return value_str

    # ===== Public API (Backward Compatible) =====

    @serialized_method
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value

        Args:
            key: Configuration key
            default: Default value if key doesn't exist

        Returns:
            Configuration value
        """
        # Ensure initialized before use
        if not self._initialized:
            self._initialize()

        # If still not initialized, return default
        if not self._initialized:
            return default

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                value_str = self._config_model.get_value(conn, key)
                if value_str is not None:
                    return self._deserialize_value(value_str)
                return default
        except Exception as e:
            ColorPrint.yellow(f"[GlobalConfig] Failed to get {key}: {e}")
            return default

    @serialized_method
    def set(self, key: str, value: Any) -> bool:
        """
        Set configuration value

        Args:
            key: Configuration key
            value: Configuration value

        Returns:
            True if saved successfully
        """
        # Ensure initialized before use
        if not self._initialized:
            self._initialize()

        # If still not initialized, return False
        if not self._initialized:
            return False

        try:
            value_str = self._serialize_value(value)
            with self._db_manager.get_connection(self.database_name) as conn:
                self._config_model.set_value(conn, key, value_str)
            ColorPrint.green(f"[GlobalConfig] Set {key} = {value}")
            return True
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to set {key}: {e}")
            return False

    @serialized_method
    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration

        Returns:
            Complete configuration dictionary
        """
        # Ensure initialized before use
        if not self._initialized:
            self._initialize()

        # If still not initialized, return empty dict
        if not self._initialized:
            return {}

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                all_configs = self._config_model.get_all_configs(conn)
                # Deserialize all values
                result = {}
                for key, config_data in all_configs.items():
                    result[key] = self._deserialize_value(config_data['value'])
                return result
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to get all configs: {e}")
            return {}

    @serialized_method
    def update(self, config_dict: Dict[str, Any]) -> bool:
        """
        Update multiple configuration values

        Args:
            config_dict: Dictionary of key-value pairs to update

        Returns:
            True if saved successfully
        """
        # Ensure initialized before use
        if not self._initialized:
            self._initialize()

        # If still not initialized, return False
        if not self._initialized:
            return False

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                for key, value in config_dict.items():
                    value_str = self._serialize_value(value)
                    self._config_model.set_value(conn, key, value_str)
            ColorPrint.green(f"[GlobalConfig] Updated {len(config_dict)} settings")
            return True
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to update: {e}")
            return False

    @serialized_method
    def reset_to_defaults(self):
        """Reset configuration to defaults"""
        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                for key, default_value in self.DEFAULT_CONFIG.items():
                    value_str = self._serialize_value(default_value)
                    self._config_model.set_value(conn, key, value_str)
            ColorPrint.yellow("[GlobalConfig] Reset to defaults")
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to reset: {e}")

    @serialized_method
    def has_key(self, key: str) -> bool:
        """
        Check if configuration key exists

        Args:
            key: Configuration key

        Returns:
            True if key exists
        """
        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                return self._config_model.key_exists(conn, key)
        except Exception as e:
            ColorPrint.yellow(f"[GlobalConfig] Failed to check key {key}: {e}")
            return False

    @serialized_method
    def delete(self, key: str) -> bool:
        """
        Delete configuration key

        Args:
            key: Configuration key

        Returns:
            True if deleted successfully
        """
        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                deleted = self._config_model.delete_key(conn, key)
                if deleted > 0:
                    ColorPrint.yellow(f"[GlobalConfig] Deleted key: {key}")
                    return True
                return False
        except Exception as e:
            ColorPrint.red(f"[GlobalConfig] Failed to delete {key}: {e}")
            return False

    # ===== Convenience Methods =====

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
        ColorPrint.blue("[Global Configuration - SQLite Backend]")
        ColorPrint.blue("=" * 70)

        all_config = self.get_all()
        for key, value in sorted(all_config.items()):
            print(f"{key}: {value}")

        ColorPrint.blue("=" * 70 + "\n")


# ===== Global Singleton =====
global_config = GlobalConfig()


__all__ = ['GlobalConfig', 'global_config']
