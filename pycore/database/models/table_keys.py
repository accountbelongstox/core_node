#!/usr/bin/env python3
"""
Table key constants with namespace
All table keys MUST be defined here

Table Key Format: {namespace}.{table_name}

Example:
- common.config -> Common config table
- app_myapp.users -> MyApp user table
- util_cache.items -> Cache utility items table

Usage:
    from pycore.database.models.table_keys import TableKeys
    table = database_manager.get_table(TableKeys.COMMON_CONFIG)
"""

from pycore.database.models.namespaces import TableNamespaces


class TableKeys:
    """
    Centralized table key definitions

    Format: {namespace}.{table_name}

    All table keys MUST be defined here
    NO hardcoded table name strings allowed elsewhere!
    """

    # ===== Common Tables =====
    COMMON_CONFIG = f"{TableNamespaces.COMMON}.config"
    COMMON_LOGS = f"{TableNamespaces.COMMON}.logs"

    # ===== Example App Tables =====
    EXAMPLE_USERS = f"{TableNamespaces.APP_EXAMPLE}.users"
    EXAMPLE_TASKS = f"{TableNamespaces.APP_EXAMPLE}.tasks"

    # ===== Util Cache Tables =====
    CACHE_ITEMS = f"{TableNamespaces.UTIL_CACHE}.items"

    # ===== Util Speech Tables =====
    SPEECH_TTS_CACHE = f"{TableNamespaces.UTIL_SPEECH}.tts_cache"
    SPEECH_TTS_CONFIG = f"{TableNamespaces.UTIL_SPEECH}.tts_config"
    SPEECH_STT_CACHE = f"{TableNamespaces.UTIL_SPEECH}.stt_cache"
    SPEECH_STT_CONFIG = f"{TableNamespaces.UTIL_SPEECH}.stt_config"
    SPEECH_CONFIG = f"{TableNamespaces.UTIL_SPEECH}.config"  # Unified speech config

    # ===== Util Clipboard Tables =====
    CLIPBOARD_HISTORY = f"{TableNamespaces.UTIL_CLIPBOARD}.history"

    # ===== Voice App Tables =====
    VOICE_DICTIONARIES = f"{TableNamespaces.APP_VOICE}.dictionaries"
    VOICE_CACHE_DB_DONE = f"{TableNamespaces.APP_VOICE}.cache_db_done"

    # Add more table keys as needed...
    # YOUR_APP_TABLE = f"{TableNamespaces.APP_YOUR_APP}.your_table"

    @classmethod
    def get_all_table_keys(cls):
        """
        Get all defined table keys

        Returns:
            List of table key strings
        """
        return [
            value for name, value in cls.__dict__.items()
            if not name.startswith('_') and isinstance(value, str)
        ]

    @classmethod
    def get_namespace_from_key(cls, table_key: str) -> str:
        """
        Extract namespace from table key

        Args:
            table_key: Table key (e.g., "app_myapp.users")

        Returns:
            Namespace (e.g., "app_myapp")
        """
        return table_key.split('.')[0] if '.' in table_key else None

    @classmethod
    def get_table_name_from_key(cls, table_key: str) -> str:
        """
        Extract table name from table key

        Args:
            table_key: Table key (e.g., "app_myapp.users")

        Returns:
            Table name (e.g., "users")
        """
        return table_key.split('.')[1] if '.' in table_key else table_key

    @classmethod
    def validate_table_key(cls, table_key: str) -> bool:
        """
        Validate if table key exists

        Args:
            table_key: Table key to validate

        Returns:
            True if table key is defined, False otherwise
        """
        return table_key in cls.get_all_table_keys()

    @classmethod
    def get_full_table_name(cls, table_key: str) -> str:
        """
        Convert table key to full table name (used in database)

        Args:
            table_key: Table key (e.g., "app_myapp.users")

        Returns:
            Full table name (e.g., "app_myapp_users")
        """
        return table_key.replace('.', '_')
