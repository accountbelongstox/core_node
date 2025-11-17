#!/usr/bin/env python3
"""
SpeechTTSConfigModel - TTS configuration storage
Stores TTS-related settings and preferences
"""

from typing import Optional, Dict, Any
from datetime import datetime
import json

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.pyfoundations.color_print import ColorPrint
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces


class SpeechTTSConfigModel(BaseModel):
    """
    Speech TTS Config Model

    Database table for TTS configuration storage
    Stores provider preferences, voice settings, and TTS options

    Schema:
        - id: Integer primary key (auto-increment)
        - key: String(255) - Config key (unique)
        - value: Text - Config value (JSON string for complex data)
        - value_type: String(50) - Type hint (string, int, bool, list, dict)
        - description: String(500) - Config description
        - created_at: DateTime - Creation timestamp
        - updated_at: DateTime - Last update timestamp

    Indexes:
        - Unique constraint on key
        - Index on key

    Design Principles:
        - Simple key-value storage for TTS settings
        - Auto-serialization for complex types
        - Easy integration with tts_cache_model
    """

    __table_key__ = TableKeys.SPEECH_TTS_CONFIG
    __namespace__ = TableNamespaces.UTIL_SPEECH
    __table_name__ = "tts_config"
    __full_table_name__ = "util_speech_tts_config"
    __schema_version__ = 1

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
            sqlalchemy.Column('description', sqlalchemy.String(500), nullable=True),

            # Metadata
            sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False),
        )

    # ===== Custom Methods =====

    @classmethod
    def get_config(cls, conn, key: str) -> Optional[Any]:
        """
        Get config value (auto-deserializes JSON)

        Args:
            conn: Database connection
            key: Config key

        Returns:
            Config value or None if not found
        """
        result = cls.select_one(conn, where={'key': key})

        if not result:
            return None

        value = result['value']
        value_type = result.get('value_type', 'string')

        # Deserialize based on type
        if value_type == 'string':
            return value
        elif value_type in ('bool', 'int', 'list', 'dict'):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                ColorPrint.yellow(f"[TTSConfig] Failed to deserialize {key}, returning raw value")
                return value
        else:
            return value

    @classmethod
    def set_config(cls, conn, key: str, value: Any, description: Optional[str] = None):
        """
        Set config value (auto-serializes to JSON)

        Args:
            conn: Database connection
            key: Config key
            value: Config value
            description: Optional description
        """
        # Detect value type and serialize
        if isinstance(value, str):
            value_type = 'string'
            value_str = value
        elif isinstance(value, bool):
            value_type = 'bool'
            value_str = json.dumps(value)
        elif isinstance(value, int):
            value_type = 'int'
            value_str = json.dumps(value)
        elif isinstance(value, (list, dict)):
            value_type = 'list' if isinstance(value, list) else 'dict'
            value_str = json.dumps(value)
        else:
            value_type = 'string'
            value_str = str(value)

        # Check if exists
        existing = cls.select_one(conn, where={'key': key})

        if existing:
            # Update existing
            update_data = {
                'value': value_str,
                'value_type': value_type,
                'updated_at': datetime.utcnow()
            }
            if description is not None:
                update_data['description'] = description

            cls.update(conn, update_data, where={'key': key})
            ColorPrint.blue(f"[TTSConfig] Updated: {key} = {value}")
        else:
            # Insert new
            insert_data = {
                'key': key,
                'value': value_str,
                'value_type': value_type,
                'description': description,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            cls.insert(conn, insert_data)
            ColorPrint.green(f"[TTSConfig] Created: {key} = {value}")

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
            ColorPrint.yellow(f"[TTSConfig] Deleted: {key}")
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
    def get_config_with_default(cls, conn, key: str, default: Any) -> Any:
        """
        Get config value with default fallback

        Args:
            conn: Database connection
            key: Config key
            default: Default value if key not found

        Returns:
            Config value or default
        """
        value = cls.get_config(conn, key)
        return value if value is not None else default

    @classmethod
    def initialize_defaults(cls, conn, defaults: Dict[str, Any]):
        """
        Initialize default configurations (only if not exists)

        Args:
            conn: Database connection
            defaults: Dictionary of key:value pairs
        """
        for key, value in defaults.items():
            if not cls.key_exists(conn, key):
                cls.set_config(conn, key, value, description=f"Default: {key}")
                ColorPrint.green(f"[TTSConfig] Initialized default: {key} = {value}")

    @classmethod
    def get_statistics(cls, conn) -> Dict[str, Any]:
        """
        Get configuration statistics

        Returns:
            Statistics dict with:
                - total_configs: Total config entries
                - by_type: Count by value type
        """
        all_results = cls.select(conn)

        if not all_results:
            return {
                'total_configs': 0,
                'by_type': {}
            }

        # Count by type
        by_type = {}
        for result in all_results:
            value_type = result.get('value_type', 'string')
            by_type[value_type] = by_type.get(value_type, 0) + 1

        return {
            'total_configs': len(all_results),
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
            ColorPrint.yellow(f"[TTSConfig] Cleared all {count} configurations")
            return result.rowcount
        return 0
