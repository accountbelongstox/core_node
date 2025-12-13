#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Database Initialization Manager

Provides centralized database initialization for all applications.
Prevents duplicate registration and ensures consistent initialization order.

Usage:
    from pycore.database.initialization import DatabaseInitializer

    # Initialize all databases for speech app
    DatabaseInitializer.initialize_all(app_type='speech')

    # Or initialize specific databases
    DatabaseInitializer.init_common()
    DatabaseInitializer.init_speech()
    DatabaseInitializer.init_clipboard()
"""

from pycore.pyfoundations.color_print import ColorPrint as _OriginalColorPrint
from pycore.database import get_database_manager
from pycore.database.models import TableKeys
from pycore.database.models.common import CommonConfigModel
from pycore.database.models.util_speech import (
    SpeechConfigModel,
    SpeechTTSCacheModel,
    SpeechSTTCacheModel,
)
from pycore.database.models.util_clipboard import ClipboardHistoryModel

# Suppress ColorPrint output in MCP mode
class ColorPrint:
    _is_mcp = _OriginalColorPrint.is_mcp_mode()
    @staticmethod
    def blue(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.blue(msg)
    @staticmethod
    def red(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.red(msg)
    @staticmethod
    def green(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.green(msg)
    @staticmethod
    def yellow(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.yellow(msg)


class DatabaseInitializer:
    """
    Unified Database Initialization Manager

    Features:
    - Prevents duplicate registration (idempotent)
    - Tracks initialized databases
    - Provides app-specific initialization
    - Consistent initialization order
    """

    _initialized_databases = set()

    @classmethod
    def initialize_all(cls, app_type: str = 'speech'):
        """
        Initialize all databases required for an application

        Args:
            app_type: Application type ('speech', 'clipboard', 'all')
        """
        if app_type == 'speech':
            cls.init_common()
            cls.init_speech()
            cls.init_clipboard()  # Speech app needs clipboard for RPC routes
        elif app_type == 'clipboard':
            cls.init_common()
            cls.init_clipboard()
        elif app_type == 'all':
            cls.init_common()
            cls.init_speech()
            cls.init_clipboard()
        else:
            ColorPrint.yellow(f"[DatabaseInitializer] Unknown app type: {app_type}")

    @classmethod
    def init_common(cls):
        """Initialize common database (shared configs)"""
        if 'common' in cls._initialized_databases:
            return  # Already initialized

        db_manager = get_database_manager()

        # Register database
        if 'common' not in db_manager.connection_strings:
            db_manager.register_database('common')
            ColorPrint.blue("[DatabaseInitializer] Registered: common")

        # Load tables
        if not db_manager.is_table_loaded(TableKeys.COMMON_CONFIG):
            db_manager.load_tables(
                table_keys=[TableKeys.COMMON_CONFIG],
                models=[CommonConfigModel],
                database_name='common'
            )
            ColorPrint.blue("[DatabaseInitializer] Loaded tables: common.config")

        cls._initialized_databases.add('common')

    @classmethod
    def init_speech(cls):
        """Initialize speech database (TTS/STT cache, speech config)"""
        if 'speech' in cls._initialized_databases:
            return  # Already initialized

        db_manager = get_database_manager()

        # Register database
        if 'speech' not in db_manager.connection_strings:
            db_manager.register_database('speech')
            ColorPrint.blue("[DatabaseInitializer] Registered: speech")

        # Collect tables to load
        tables_to_load = []
        models_to_load = []

        if not db_manager.is_table_loaded(TableKeys.SPEECH_CONFIG):
            tables_to_load.append(TableKeys.SPEECH_CONFIG)
            models_to_load.append(SpeechConfigModel)

        if not db_manager.is_table_loaded(TableKeys.SPEECH_TTS_CACHE):
            tables_to_load.append(TableKeys.SPEECH_TTS_CACHE)
            models_to_load.append(SpeechTTSCacheModel)

        if not db_manager.is_table_loaded(TableKeys.SPEECH_STT_CACHE):
            tables_to_load.append(TableKeys.SPEECH_STT_CACHE)
            models_to_load.append(SpeechSTTCacheModel)

        # Load tables
        if tables_to_load:
            db_manager.load_tables(
                table_keys=tables_to_load,
                models=models_to_load,
                database_name='speech'
            )
            ColorPrint.blue(f"[DatabaseInitializer] Loaded {len(tables_to_load)} speech tables")

        cls._initialized_databases.add('speech')

    @classmethod
    def init_clipboard(cls):
        """Initialize clipboard database (clipboard history)"""
        if 'clipboard' in cls._initialized_databases:
            return  # Already initialized

        db_manager = get_database_manager()

        # Register database
        if 'clipboard' not in db_manager.connection_strings:
            db_manager.register_database('clipboard')
            ColorPrint.blue("[DatabaseInitializer] Registered: clipboard")

        # Load tables
        if not db_manager.is_table_loaded(TableKeys.CLIPBOARD_HISTORY):
            db_manager.load_tables(
                table_keys=[TableKeys.CLIPBOARD_HISTORY],
                models=[ClipboardHistoryModel],
                database_name='clipboard'
            )
            ColorPrint.blue("[DatabaseInitializer] Loaded tables: clipboard.history")

        cls._initialized_databases.add('clipboard')

    @classmethod
    def is_initialized(cls, database_name: str) -> bool:
        """
        Check if database is initialized

        Args:
            database_name: Database name to check

        Returns:
            True if initialized
        """
        return database_name in cls._initialized_databases

    @classmethod
    def reset(cls):
        """Reset initialization tracking (for testing)"""
        cls._initialized_databases.clear()
        ColorPrint.yellow("[DatabaseInitializer] Reset initialization tracking")


__all__ = ['DatabaseInitializer']
