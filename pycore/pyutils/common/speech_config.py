#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Configuration Manager (SQLite Backend)

Unified speech configuration management using util_speech.config table.
Replaces speech_* keys in GlobalConfig with dedicated speech database.

Architecture:
- Dedicated util_speech.config table
- Backward compatible with GlobalConfig API
- Auto-migration from GlobalConfig
- Category-based organization (tts, stt, ui, general)
"""

from typing import Optional, Dict, Any
from pycore.pyfoundations import ColorPrint
from pycore.database import get_database_manager


class SpeechConfig:
    """
    Speech Configuration Manager (SQLite Backend)

    Provides unified configuration for all speech features:
    - TTS (Text-to-Speech)
    - STT (Speech-to-Text)
    - UI (User Interface settings)
    - General speech settings

    Features:
    - Persistent SQLite storage in util_speech.config
    - Thread-safe operations
    - Automatic default initialization
    - Auto-migration from GlobalConfig
    - Category-based organization
    """

    def __init__(self, database_name: str = 'speech', auto_migrate: bool = True):
        """
        Initialize Speech Config Manager

        Args:
            database_name: Database name (default: 'speech')
            auto_migrate: Auto-migrate from GlobalConfig on first init
        """
        self.database_name = database_name
        self._db_manager = None
        self._config_model = None
        self._initialized = False
        self._auto_migrate = auto_migrate

        # Auto-initialize
        self._initialize()

    def _initialize(self):
        """Initialize database connection and table (lazy)"""
        if self._initialized:
            return

        try:
            # Get database manager
            self._db_manager = get_database_manager()

            # Get config model
            from pycore.database.models.util_speech import SpeechConfigModel
            self._config_model = SpeechConfigModel

            # Register speech database if not already registered
            if 'speech' not in self._db_manager.connection_strings:
                self._db_manager.register_database(database_name='speech')

            # Load config table if not already loaded
            if not self._db_manager.is_table_loaded('util_speech.config'):
                from pycore.database.models import TableKeys
                self._db_manager.load_tables(
                    table_keys=[TableKeys.SPEECH_CONFIG],
                    models=[SpeechConfigModel],
                    database_name='speech'
                )

            # Initialize defaults
            with self._db_manager.get_connection(self.database_name) as conn:
                self._config_model.initialize_defaults(conn)

            # Auto-migrate from GlobalConfig if enabled
            if self._auto_migrate:
                self._migrate_from_global_config()

            self._initialized = True
            ColorPrint.blue(f"[SpeechConfig] Initialized with SQLite database: {self.database_name}")

        except Exception as e:
            ColorPrint.yellow(f"[SpeechConfig] Initialization deferred: {e}")
            self._initialized = False

    def _migrate_from_global_config(self):
        """Migrate speech_* configs from GlobalConfig to SpeechConfig"""
        try:
            from pycore.pyutils.common import global_config

            # Get all global configs
            all_global_configs = global_config.get_all()

            # Migrate
            with self._db_manager.get_connection(self.database_name) as conn:
                migrated = self._config_model.migrate_from_global_config(conn, all_global_configs)

                if migrated > 0:
                    ColorPrint.green(f"[SpeechConfig] Auto-migrated {migrated} configs from GlobalConfig")

        except Exception as e:
            ColorPrint.yellow(f"[SpeechConfig] Auto-migration skipped: {e}")

    # ===== Public API (Backward Compatible with GlobalConfig) =====

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value

        Args:
            key: Configuration key (without 'speech_' prefix)
            default: Default value if key doesn't exist

        Returns:
            Configuration value
        """
        # Ensure initialized
        if not self._initialized:
            self._initialize()

        if not self._initialized:
            return default

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                return self._config_model.get_config(conn, key, default)
        except Exception as e:
            ColorPrint.yellow(f"[SpeechConfig] Failed to get {key}: {e}")
            return default

    def set(self, key: str, value: Any, description: Optional[str] = None) -> bool:
        """
        Set configuration value

        Args:
            key: Configuration key (without 'speech_' prefix)
            value: Configuration value
            description: Optional description

        Returns:
            True if saved successfully
        """
        # Ensure initialized
        if not self._initialized:
            self._initialize()

        if not self._initialized:
            return False

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                self._config_model.set_config(conn, key, value, description)
            ColorPrint.green(f"[SpeechConfig] Set {key} = {value}")
            return True
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to set {key}: {e}")
            return False

    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration

        Returns:
            Complete configuration dictionary
        """
        # Ensure initialized
        if not self._initialized:
            self._initialize()

        if not self._initialized:
            return {}

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                return self._config_model.get_all_configs(conn)
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to get all configs: {e}")
            return {}

    def get_by_category(self, category: str) -> Dict[str, Any]:
        """
        Get all configs in a specific category

        Args:
            category: Category name (tts, stt, ui, general)

        Returns:
            Dictionary of configs in that category
        """
        # Ensure initialized
        if not self._initialized:
            self._initialize()

        if not self._initialized:
            return {}

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                return self._config_model.get_configs_by_category(conn, category)
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to get category {category}: {e}")
            return {}

    def update(self, config_dict: Dict[str, Any]) -> bool:
        """
        Update multiple configuration values

        Args:
            config_dict: Dictionary of key-value pairs to update

        Returns:
            True if saved successfully
        """
        # Ensure initialized
        if not self._initialized:
            self._initialize()

        if not self._initialized:
            return False

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                for key, value in config_dict.items():
                    self._config_model.set_config(conn, key, value)
            ColorPrint.green(f"[SpeechConfig] Updated {len(config_dict)} settings")
            return True
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to update: {e}")
            return False

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
            ColorPrint.yellow(f"[SpeechConfig] Failed to check key {key}: {e}")
            return False

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
                deleted = self._config_model.delete_config(conn, key)
                return deleted > 0
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to delete {key}: {e}")
            return False

    def reset_to_defaults(self):
        """Reset all speech configuration to defaults"""
        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                # Clear all existing configs
                self._config_model.clear_all(conn)

                # Re-initialize defaults
                self._config_model.initialize_defaults(conn)

            ColorPrint.yellow("[SpeechConfig] Reset to defaults")
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to reset: {e}")

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get configuration statistics

        Returns:
            Statistics dict with total, by_category, by_type
        """
        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                return self._config_model.get_statistics(conn)
        except Exception as e:
            ColorPrint.red(f"[SpeechConfig] Failed to get statistics: {e}")
            return {}

    # ===== Convenience Methods =====

    def get_tts_provider(self) -> str:
        """Get TTS provider"""
        return self.get('tts_provider', 'edge')

    def set_tts_provider(self, provider: str):
        """Set TTS provider"""
        self.set('tts_provider', provider)

    def get_stt_provider(self) -> str:
        """Get STT provider"""
        return self.get('stt_provider', 'azure')

    def set_stt_provider(self, provider: str):
        """Set STT provider"""
        self.set('stt_provider', provider)

    def get_default_language(self) -> str:
        """Get default language"""
        return self.get('default_language', 'zh-CN')

    def set_default_language(self, language: str):
        """Set default language"""
        self.set('default_language', language)

    def is_auto_use_cached(self) -> bool:
        """Check if auto-use cached config is enabled"""
        return self.get('auto_use_cached', True)

    def print_config(self):
        """Print current configuration"""
        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[Speech Configuration - SQLite Backend]")
        ColorPrint.blue("=" * 70)

        all_config = self.get_all()

        # Group by category
        categories = {}
        for key, value in all_config.items():
            # Infer category from key
            if key.startswith('tts_'):
                cat = 'TTS'
            elif key.startswith('stt_'):
                cat = 'STT'
            elif key.startswith('ui_'):
                cat = 'UI'
            else:
                cat = 'General'

            if cat not in categories:
                categories[cat] = {}
            categories[cat][key] = value

        # Print by category
        for category in sorted(categories.keys()):
            ColorPrint.green(f"\n[{category}]")
            for key, value in sorted(categories[category].items()):
                print(f"  {key}: {value}")

        ColorPrint.blue("=" * 70 + "\n")


# ===== Global Singleton =====
speech_config = SpeechConfig()


__all__ = ['SpeechConfig', 'speech_config']
