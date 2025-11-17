#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Configuration Manager

Manages TTS-related configurations using database storage.
Integrates with SpeechTTSConfigModel and TTSCacheManager.

Features:
- Database-backed configuration storage
- Default configuration initialization
- Easy get/set API
- Integration with TTS cache system
"""

import threading
from typing import Optional, Any, Dict
from pycore.pyfoundations.color_print import ColorPrint


class TTSConfigManager:
    """
    TTS Configuration Manager

    Manages TTS settings using database storage.
    Provides simple API for configuration management.
    """

    # Default TTS configurations
    DEFAULT_CONFIG = {
        # Provider settings
        'default_provider': 'edge',                    # edge, azure, auto
        'edge_tts_enabled': True,
        'azure_tts_enabled': False,

        # Language settings
        'default_language': 'zh-CN',
        'supported_languages': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'],

        # Voice settings
        'default_voice_zh_CN': 'zh-CN-XiaoxiaoNeural',
        'default_voice_en_US': 'en-US-JennyNeural',
        'default_voice_ja_JP': 'ja-JP-NanamiNeural',
        'default_voice_ko_KR': 'ko-KR-SunHiNeural',

        # Cache settings
        'cache_enabled': True,
        'cache_max_size_mb': 1000,
        'cache_ttl_days': 30,

        # Performance settings
        'max_queue_size': 50,
        'synthesis_timeout': 30,
        'retry_attempts': 3,

        # Audio settings
        'audio_format': 'mp3',
        'audio_quality': 'high',              # high, medium, low
        'sample_rate': 24000,

        # Advanced settings
        'enable_ssml': False,
        'enable_preprocessing': True,
        'enable_postprocessing': False,
    }

    def __init__(self, database_enabled: bool = True, database_name: str = "speech"):
        """
        Initialize TTS Config Manager

        Args:
            database_enabled: Enable database integration
            database_name: Database name for config storage
        """
        self.database_enabled = database_enabled
        self.database_name = database_name
        self._db_manager = None
        self._db_model = None
        self._config_cache: Dict[str, Any] = self.DEFAULT_CONFIG.copy()
        self._initialized = False

        if database_enabled:
            self._initialize_database()

    def _initialize_database(self):
        """Initialize database connection and load config"""
        try:
            from pycore.database import database_manager, DATABASE_AVAILABLE
            from pycore.database.models import SpeechTTSConfigModel, TableKeys

            if not DATABASE_AVAILABLE:
                ColorPrint.yellow("[TTSConfig] Database not available, using in-memory config")
                self.database_enabled = False
                return

            # Register database
            database_manager.register_database(self.database_name)

            # Load table
            database_manager.load_tables(
                database_name=self.database_name,
                table_keys=[TableKeys.SPEECH_TTS_CONFIG],
                models=[SpeechTTSConfigModel]
            )

            self._db_manager = database_manager
            self._db_model = SpeechTTSConfigModel

            # Initialize defaults if needed
            with self._db_manager.get_connection(self.database_name) as conn:
                self._db_model.initialize_defaults(conn, self.DEFAULT_CONFIG)

            # Load all configs from database to cache
            self._load_from_database()

            self._initialized = True
            ColorPrint.green(f"[TTSConfig] Database initialized ({self.database_name})")

        except Exception as e:
            ColorPrint.yellow(f"[TTSConfig] Database init failed: {e}, using in-memory config")
            self.database_enabled = False

    def _load_from_database(self):
        """Load all configurations from database to cache"""
        if not self.database_enabled:
            return

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                db_configs = self._db_model.get_all_configs(conn)
                self._config_cache.update(db_configs)
                ColorPrint.blue(f"[TTSConfig] Loaded {len(db_configs)} configs from database")
        except Exception as e:
            ColorPrint.yellow(f"[TTSConfig] Failed to load from database: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value

        Args:
            key: Configuration key
            default: Default value if key not found

        Returns:
            Configuration value or default
        """
        # Try cache first
        if key in self._config_cache:
            return self._config_cache[key]

        # Try database if enabled
        if self.database_enabled:
            try:
                with self._db_manager.get_connection(self.database_name) as conn:
                    value = self._db_model.get_config(conn, key)
                    if value is not None:
                        self._config_cache[key] = value
                        return value
            except Exception as e:
                ColorPrint.yellow(f"[TTSConfig] Failed to get {key} from database: {e}")

        # Return default
        return default

    def set(self, key: str, value: Any, description: Optional[str] = None) -> bool:
        """
        Set configuration value

        Args:
            key: Configuration key
            value: Configuration value
            description: Optional description

        Returns:
            True if successful, False otherwise
        """
        try:
            # Update database if enabled
            if self.database_enabled:
                with self._db_manager.get_connection(self.database_name) as conn:
                    self._db_model.set_config(conn, key, value, description)

            # Update cache
            self._config_cache[key] = value

            ColorPrint.green(f"[TTSConfig] Set {key} = {value}")
            return True

        except Exception as e:
            ColorPrint.red(f"[TTSConfig] Failed to set {key}: {e}")
            return False

    def get_all(self) -> Dict[str, Any]:
        """
        Get all configurations

        Returns:
            Dictionary of all configurations
        """
        if self.database_enabled:
            # Reload from database to ensure fresh data
            self._load_from_database()

        return self._config_cache.copy()

    def delete(self, key: str) -> bool:
        """
        Delete configuration

        Args:
            key: Configuration key

        Returns:
            True if deleted, False otherwise
        """
        try:
            # Delete from database if enabled
            if self.database_enabled:
                with self._db_manager.get_connection(self.database_name) as conn:
                    self._db_model.delete_config(conn, key)

            # Delete from cache
            if key in self._config_cache:
                del self._config_cache[key]

            ColorPrint.yellow(f"[TTSConfig] Deleted {key}")
            return True

        except Exception as e:
            ColorPrint.red(f"[TTSConfig] Failed to delete {key}: {e}")
            return False

    def reset_to_defaults(self) -> bool:
        """
        Reset all configurations to defaults

        Returns:
            True if successful, False otherwise
        """
        try:
            if self.database_enabled:
                with self._db_manager.get_connection(self.database_name) as conn:
                    # Clear existing
                    self._db_model.clear_all(conn)

                    # Initialize defaults
                    self._db_model.initialize_defaults(conn, self.DEFAULT_CONFIG)

            # Reset cache
            self._config_cache = self.DEFAULT_CONFIG.copy()

            ColorPrint.green("[TTSConfig] Reset to default configuration")
            return True

        except Exception as e:
            ColorPrint.red(f"[TTSConfig] Failed to reset: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get configuration statistics

        Returns:
            Statistics dict
        """
        stats = {
            'total_configs': len(self._config_cache),
            'database_enabled': self.database_enabled,
            'initialized': self._initialized
        }

        if self.database_enabled:
            try:
                with self._db_manager.get_connection(self.database_name) as conn:
                    db_stats = self._db_model.get_statistics(conn)
                    stats.update(db_stats)
            except Exception as e:
                ColorPrint.yellow(f"[TTSConfig] Failed to get database stats: {e}")

        return stats

    def print_all(self):
        """Print all configurations"""
        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[TTS Configuration]")
        ColorPrint.blue("=" * 70)

        all_configs = self.get_all()

        for key, value in sorted(all_configs.items()):
            print(f"{key:30} = {value}")

        ColorPrint.blue("=" * 70 + "\n")


# Global singleton instance
_global_tts_config_manager: Optional[TTSConfigManager] = None
_config_lock = threading.Lock()


def get_tts_config_manager(database_enabled: bool = True, database_name: str = "speech") -> TTSConfigManager:
    """
    Get global TTS config manager singleton

    Args:
        database_enabled: Enable database integration (default: True)
        database_name: Database name (default: "speech")

    Returns:
        TTSConfigManager instance
    """
    global _global_tts_config_manager

    if _global_tts_config_manager is None:
        with _config_lock:
            if _global_tts_config_manager is None:
                _global_tts_config_manager = TTSConfigManager(
                    database_enabled=database_enabled,
                    database_name=database_name
                )

    return _global_tts_config_manager


# Convenience singleton instance (auto-initialized with database)
tts_config_manager = get_tts_config_manager()


__all__ = [
    'TTSConfigManager',
    'get_tts_config_manager',
    'tts_config_manager'
]
