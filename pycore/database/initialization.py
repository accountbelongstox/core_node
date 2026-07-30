#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Storage Initialization Manager

Provides centralized storage initialization for legacy application entry points.
Prevents duplicate registration and ensures consistent initialization order.

Usage:
    from pycore.database.initialization import DatabaseInitializer

    # Initialize all storage for speech app
    DatabaseInitializer.initialize_all(app_type='speech')

    # Or initialize specific storage
    DatabaseInitializer.init_common()
    DatabaseInitializer.init_speech()
    DatabaseInitializer.init_clipboard()
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.clipboard.clipboard_history import get_clipboard_history
from pycore.pyutils.tts.sentence_audio_cache import cache_dir

class DatabaseInitializer:
    """
    Unified Storage Initialization Manager

    Features:
    - Prevents duplicate registration (idempotent)
    - Tracks initialized storage
    - Provides app-specific initialization
    - Consistent initialization order
    """

    _initialized_databases = set()

    @classmethod
    def initialize_all(cls, app_type: str = 'speech'):
        """
        Initialize all storage required for an application

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
        """Mark common initialization complete; settings now use unified JSON."""
        if 'common' in cls._initialized_databases:
            return  # Already initialized
        cls._initialized_databases.add('common')

    @classmethod
    def init_speech(cls):
        """Initialize the file-backed speech cache."""
        if 'speech' in cls._initialized_databases:
            return  # Already initialized

        cache_dir()
        cls._initialized_databases.add('speech')
        ColorPrint.blue("[DatabaseInitializer] Initialized file cache: speech")

    @classmethod
    def init_clipboard(cls):
        """Initialize file-backed clipboard history."""
        if 'clipboard' in cls._initialized_databases:
            return  # Already initialized

        get_clipboard_history()
        cls._initialized_databases.add('clipboard')
        ColorPrint.blue("[DatabaseInitializer] Initialized file history: clipboard")

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
