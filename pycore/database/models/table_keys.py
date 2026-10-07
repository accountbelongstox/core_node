#!/usr/bin/env python3
"""
Table key constants: {namespace}.{table_name}. All table keys MUST be defined here.
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
    # Key/value table read (and dropped) only by the terminal state migration.
    TERMINAL_STATE = f"{TableNamespaces.COMMON}.terminal_state"
    TERMINAL_STATE_TERMINALS = f"{TableNamespaces.COMMON}.terminal_state_terminals"
    TERMINAL_STATE_LOGS = f"{TableNamespaces.COMMON}.terminal_state_logs"
    # Finished task units (pyctl/task_history/store.py).
    TASK_HISTORY = f"{TableNamespaces.COMMON}.task_history"
    TASK_HISTORY_META = f"{TableNamespaces.COMMON}.task_history_meta"

    # ===== Util Speech Tables =====
    # Ledger of every local word/sentence clip (pyutils/tts/audio_resource_ledger.py).
    SPEECH_AUDIO_RESOURCES = f"{TableNamespaces.UTIL_SPEECH}.audio_resources"

    # ===== Util Laravel Delivery Tables (pyutils/laravel/delivery/store.py) =====
    LARAVEL_DELIVERIES = f"{TableNamespaces.UTIL_LARAVEL}.deliveries"
    # Schema v1 receipts table; only read (and dropped) by the v2 migration.
    LARAVEL_DELIVERY_RECEIPTS = f"{TableNamespaces.UTIL_LARAVEL}.delivery_receipts"
    LARAVEL_DELIVERY_STATE = f"{TableNamespaces.UTIL_LARAVEL}.delivery_state"
    LARAVEL_DELIVERY_METRICS = f"{TableNamespaces.UTIL_LARAVEL}.delivery_metrics"
    LARAVEL_DELIVERY_META = f"{TableNamespaces.UTIL_LARAVEL}.delivery_meta"

    # ===== Util Laravel Queue Diff Tables (pyutils/common/diff_task_segments.py) =====
    QUEUE_DIFF_TASKS = f"{TableNamespaces.UTIL_LARAVEL}.queue_diff_tasks"
    QUEUE_DIFF_CURSORS = f"{TableNamespaces.UTIL_LARAVEL}.queue_diff_cursors"

    # ===== Util Agent History Tables (pyctl/agent_history/prompt_records.py) =====
    AGENT_HISTORY_PROMPT_FEED = f"{TableNamespaces.UTIL_AGENT_HISTORY}.prompt_feed"
    AGENT_HISTORY_PROMPT_ARCHIVE = f"{TableNamespaces.UTIL_AGENT_HISTORY}.prompt_archive"
    AGENT_HISTORY_PROMPT_META = f"{TableNamespaces.UTIL_AGENT_HISTORY}.prompt_meta"

    # ===== Util Agent History Store Tables (pyctl/agent_history/agent_history_index.py) =====
    AGENT_HISTORY_SESSIONS = f"{TableNamespaces.UTIL_AGENT_HISTORY}.sessions"
    AGENT_HISTORY_PROMPTS = f"{TableNamespaces.UTIL_AGENT_HISTORY}.prompts"
    AGENT_HISTORY_SOURCES = f"{TableNamespaces.UTIL_AGENT_HISTORY}.sources"
    AGENT_HISTORY_STORE_META = f"{TableNamespaces.UTIL_AGENT_HISTORY}.store_meta"

    # ===== Util Agent History Article Tables (pyutils/agent_history/article_records.py) =====
    AGENT_HISTORY_ARTICLE_RECORDS = f"{TableNamespaces.UTIL_AGENT_HISTORY}.article_records"
    AGENT_HISTORY_ARTICLE_META = f"{TableNamespaces.UTIL_AGENT_HISTORY}.article_meta"

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
