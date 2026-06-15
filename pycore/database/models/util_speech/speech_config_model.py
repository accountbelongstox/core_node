#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SpeechConfigModel - Unified Speech Configuration Storage

Stores ALL speech-related settings (TTS, STT, UI, etc.) in one place.
This is the single source of truth for all speech module configuration.

Design:
- Replaces speech_* keys in common.config (global_config)
- Dedicated table for speech configuration
- Same simple key-value pattern as GlobalConfig
- Supports TTS, STT, UI, and future speech features
"""

from typing import Optional, Dict, Any
from datetime import datetime
import json

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces


class SpeechConfigModel(BaseModel):
    """
    Speech Configuration Model (Unified)

    Database table for ALL speech configuration storage.
    Consolidates TTS, STT, UI, and other speech-related settings.

    Schema:
        - id: Integer primary key (auto-increment)
        - key: String(255) - Config key (unique)
        - value: Text - Config value (JSON string for complex data)
        - value_type: String(50) - Type hint (string, int, bool, float, list, dict)
        - category: String(50) - Config category (tts, stt, ui, general)
        - description: String(500) - Config description
        - created_at: DateTime - Creation timestamp
        - updated_at: DateTime - Last update timestamp

    Indexes:
        - Unique constraint on key
        - Index on key
        - Index on category

    Design Principles:
        - Single source of truth for all speech configs
        - Simple key-value storage with categories
        - Auto-serialization for complex types
        - Backward compatible with GlobalConfig API
        - Extensible for future speech features
    """

    __table_key__ = TableKeys.SPEECH_CONFIG
    __namespace__ = TableNamespaces.UTIL_SPEECH
    __table_name__ = "config"
    __full_table_name__ = "util_speech_config"
    __schema_version__ = 1

    # ===== Default Configuration =====
    DEFAULT_CONFIG = {
        # --- General Speech Settings ---
        'default_language': 'zh-CN',
        'auto_use_cached': True,  # Skip interactive prompts
        'default_mode': 'microphone',  # microphone, system, dual

        # --- TTS Settings ---
        'tts_provider': 'edge',  # edge, azure, local
        'tts_voice': 'zh-CN-XiaoxiaoNeural',
        'tts_rate': '+0%',
        'tts_volume': '+0%',
        'tts_cache_enabled': True,
        'tts_cache_dir': '',  # Auto-determined if empty

        # --- STT Settings ---
        'stt_provider': 'azure',  # azure, local, vosk
        'stt_continuous': True,
        'stt_language': 'zh-CN',
        'stt_cache_enabled': True,

        # --- UI Settings (for transcription_app.py) ---
        'ui_transcription_mode': '',  # empty, 'microphone', 'system', 'dual'
        'ui_languages_microphone': None,  # cached language selection
        'ui_languages_system': None,
        'ui_audio_device_microphone': None,  # cached device index
        'ui_audio_device_system': None,
        'ui_duration_mode': '',  # 'continuous' or 'limited'
        'ui_duration_seconds': 60,

        # --- Advanced Settings ---
        'cache_audio': True,
        'cache_text': True,
        'max_cache_size_mb': 1000,
        'enable_hotkeys': True,
        'hotkey_toggle': 'ctrl+shift+s',
    }

    @classmethod
    def define_table_structure(cls, metadata):
        """
        Define table structure

        Args:
            metadata: SQLAlchemy metadata

        Returns:
            SQLAlchemy Table object
        """
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True, autoincrement=True),

            # Config identification
            sqlalchemy.Column('key', sqlalchemy.String(255), nullable=False, unique=True, index=True),
            sqlalchemy.Column('value', sqlalchemy.Text, nullable=False),
            sqlalchemy.Column('value_type', sqlalchemy.String(50), nullable=False, default='string'),
            sqlalchemy.Column('category', sqlalchemy.String(50), nullable=True, index=True),
            sqlalchemy.Column('description', sqlalchemy.String(500), nullable=True),

            # Metadata (using String to avoid JSON serialization issues)
            sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.String(32), nullable=False),
        )

    # ===== Helper Methods =====

    @classmethod
    def _infer_category(cls, key: str) -> str:
        """
        Infer category from key prefix

        Args:
            key: Config key

        Returns:
            Category string (tts, stt, ui, general)
        """
        if key.startswith('tts_'):
            return 'tts'
        elif key.startswith('stt_'):
            return 'stt'
        elif key.startswith('ui_'):
            return 'ui'
        else:
            return 'general'

    # ===== Custom Methods =====

    @classmethod
    def get_config(cls, conn, key: str, default: Any = None) -> Any:
        """
        Get config value (auto-deserializes JSON)

        Args:
            conn: Database connection
            key: Config key
            default: Default value if key not found

        Returns:
            Config value or default
        """
        result = cls.select_one(conn, where={'key': key})

        if not result:
            return default

        value_str = result['value']
        value_type = result.get('value_type', 'string')

        # Deserialize based on type
        if value_type == 'null':
            return None
        elif value_type == 'string':
            return value_str  # Already a string, no JSON decode needed
        elif value_type in ('bool', 'int', 'float', 'list', 'dict'):
            try:
                return json.loads(value_str)
            except json.JSONDecodeError:
                ColorPrint.yellow(f"[SpeechConfig] Failed to deserialize {key}, returning raw value")
                return value_str
        else:
            # Unknown type, return as-is
            return value_str

    @classmethod
    def set_config(cls, conn, key: str, value: Any, description: Optional[str] = None, category: Optional[str] = None):
        """
        Set config value (auto-serializes to JSON)

        Args:
            conn: Database connection
            key: Config key
            value: Config value
            description: Optional description
            category: Optional category (auto-inferred if not provided)
        """
        # Detect value type and serialize
        if value is None:
            value_type = 'null'
            value_str = json.dumps(None)  # "null"
        elif isinstance(value, bool):  # Must check bool BEFORE int (bool is subclass of int)
            value_type = 'bool'
            value_str = json.dumps(value)
        elif isinstance(value, int):
            value_type = 'int'
            value_str = json.dumps(value)
        elif isinstance(value, float):
            value_type = 'float'
            value_str = json.dumps(value)
        elif isinstance(value, str):
            value_type = 'string'
            value_str = value  # Don't JSON encode strings
        elif isinstance(value, (list, dict)):
            value_type = 'list' if isinstance(value, list) else 'dict'
            value_str = json.dumps(value, ensure_ascii=False)
        else:
            value_type = 'string'
            value_str = str(value)

        # Infer category if not provided
        if category is None:
            category = cls._infer_category(key)

        # Check if exists
        existing = cls.select_one(conn, where={'key': key})

        if existing:
            # Update existing
            update_data = {
                'value': value_str,
                'value_type': value_type,
                'category': category,
                'updated_at': datetime.utcnow()
            }
            if description is not None:
                update_data['description'] = description

            cls.update(conn, update_data, where={'key': key})
            # ColorPrint.blue(f"[SpeechConfig] Updated: {key} = {value}")
        else:
            # Insert new
            insert_data = {
                'key': key,
                'value': value_str,
                'value_type': value_type,
                'category': category,
                'description': description or f"Config: {key}",
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            cls.insert(conn, insert_data)
            ColorPrint.green(f"[SpeechConfig] Created: {key} = {value}")

    @classmethod
    def delete_config(cls, conn, key: str) -> int:
        """
        Delete config by key

        Args:
            conn: Database connection
            key: Config key

        Returns:
            Number of rows deleted
        """
        count = cls.delete(conn, where={'key': key})
        if count > 0:
            ColorPrint.yellow(f"[SpeechConfig] Deleted: {key}")
        return count

    @classmethod
    def get_all_configs(cls, conn) -> Dict[str, Any]:
        """
        Get all configurations as dictionary

        Args:
            conn: Database connection

        Returns:
            Dictionary mapping keys to their values (deserialized)
        """
        all_results = cls.select(conn)
        configs = {}

        for result in all_results:
            key = result['key']
            value = result['value']
            value_type = result.get('value_type', 'string')

            # Deserialize based on type
            if value_type == 'string':
                configs[key] = value
            else:
                try:
                    configs[key] = json.loads(value)
                except json.JSONDecodeError:
                    configs[key] = value

        return configs

    @classmethod
    def get_configs_by_category(cls, conn, category: str) -> Dict[str, Any]:
        """
        Get all configs in a specific category

        Args:
            conn: Database connection
            category: Category name (tts, stt, ui, general)

        Returns:
            Dictionary of configs in that category
        """
        results = cls.select(conn, where={'category': category})
        configs = {}

        for result in results:
            key = result['key']
            value = result['value']
            value_type = result.get('value_type', 'string')

            # Deserialize
            if value_type == 'string':
                configs[key] = value
            else:
                try:
                    configs[key] = json.loads(value)
                except json.JSONDecodeError:
                    configs[key] = value

        return configs

    @classmethod
    def key_exists(cls, conn, key: str) -> bool:
        """
        Check if config key exists

        Args:
            conn: Database connection
            key: Config key

        Returns:
            True if key exists, False otherwise
        """
        return cls.exists(conn, where={'key': key})

    @classmethod
    def initialize_defaults(cls, conn):
        """
        Initialize default configurations (only if not exists)

        Args:
            conn: Database connection

        Returns:
            Number of initialized configs
        """
        initialized_count = 0

        for key, value in cls.DEFAULT_CONFIG.items():
            if not cls.key_exists(conn, key):
                category = cls._infer_category(key)
                cls.set_config(
                    conn,
                    key=key,
                    value=value,
                    description=f"Default: {key}",
                    category=category
                )
                initialized_count += 1

        if initialized_count > 0:
            ColorPrint.green(f"[SpeechConfig] Initialized {initialized_count} default configs")

        return initialized_count

    @classmethod
    def migrate_from_global_config(cls, conn, global_config_dict: Dict[str, Any]):
        """
        Migrate speech configs from GlobalConfig to SpeechConfig

        Looks for keys starting with 'speech_' and migrates them.

        Args:
            conn: Database connection
            global_config_dict: Dictionary from global_config.get_all()

        Returns:
            Number of migrated configs
        """
        migrated_count = 0

        for key, value in global_config_dict.items():
            # Only migrate speech-related configs
            if key.startswith('speech_'):
                # Remove 'speech_' prefix for new key
                new_key = key[7:]  # Remove 'speech_' prefix

                # Skip if already exists
                if cls.key_exists(conn, new_key):
                    continue

                # Migrate
                category = cls._infer_category(new_key)
                cls.set_config(
                    conn,
                    key=new_key,
                    value=value,
                    description=f"Migrated from global_config: {key}",
                    category=category
                )
                migrated_count += 1

        if migrated_count > 0:
            ColorPrint.green(f"[SpeechConfig] Migrated {migrated_count} configs from GlobalConfig")

        return migrated_count

    @classmethod
    def get_statistics(cls, conn) -> Dict[str, Any]:
        """
        Get configuration statistics

        Returns:
            Statistics dict with:
                - total_configs: Total config entries
                - by_category: Count by category
                - by_type: Count by value type
        """
        all_results = cls.select(conn)

        if not all_results:
            return {
                'total_configs': 0,
                'by_category': {},
                'by_type': {}
            }

        # Count by category
        by_category = {}
        for result in all_results:
            category = result.get('category', 'unknown')
            by_category[category] = by_category.get(category, 0) + 1

        # Count by type
        by_type = {}
        for result in all_results:
            value_type = result.get('value_type', 'string')
            by_type[value_type] = by_type.get(value_type, 0) + 1

        return {
            'total_configs': len(all_results),
            'by_category': by_category,
            'by_type': by_type
        }

    @classmethod
    def clear_all(cls, conn) -> int:
        """
        Clear all configurations (use with caution)

        Args:
            conn: Database connection

        Returns:
            Number of deleted configs
        """
        count = cls.count(conn)
        if count > 0:
            delete_stmt = cls.__table__.delete()
            result = conn.execute(delete_stmt)
            conn.commit()
            ColorPrint.yellow(f"[SpeechConfig] Cleared all {count} configurations")
            return result.rowcount
        return 0


__all__ = ['SpeechConfigModel']
