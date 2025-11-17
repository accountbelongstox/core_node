#!/usr/bin/env python3
"""
Database Models - Total Export
Centralized export of all database models, namespaces, and table keys

This module provides easy access to all database models and constants,
but does NOT auto-load tables. Tables must be explicitly loaded via
database_manager.load_tables()

Usage:
    from pycore.database.models import TableKeys, TableNamespaces
    from pycore.database.models import CommonConfigModel, CommonLogModel

    # Or import specific namespaces
    from pycore.database.models.common import CommonConfigModel
    from pycore.database.models.app_example import ExampleUserModel
    from pycore.database.models.util_cache import UtilCacheModel
"""

# ===== Core Definitions =====
from pycore.database.models.namespaces import TableNamespaces
from pycore.database.models.table_keys import TableKeys

# ===== Common Models =====
from pycore.database.models.common import (
    CommonConfigModel,
    CommonLogModel,
)

# ===== App Example Models =====
from pycore.database.models.app_example import (
    ExampleUserModel,
    ExampleTaskModel,
)

# ===== Util Cache Models =====
from pycore.database.models.util_cache import (
    UtilCacheModel,
)

# ===== Util Speech Models =====
from pycore.database.models.util_speech import (
    SpeechTTSCacheModel,
    SpeechTTSConfigModel,
)

# ===== Util Clipboard Models =====
from pycore.database.models.util_clipboard import (
    ClipboardHistoryModel,
)

# ===== Voice App Models =====
from pycore.database.models.app_voice import (
    VoiceDictionariesModel,
    VoiceCacheDbDoneModel,
)

# ===== Total Export =====
__all__ = [
    # Core definitions
    'TableNamespaces',
    'TableKeys',

    # Common models
    'CommonConfigModel',
    'CommonLogModel',

    # App example models
    'ExampleUserModel',
    'ExampleTaskModel',

    # Util cache models
    'UtilCacheModel',

    # Util speech models
    'SpeechTTSCacheModel',
    'SpeechTTSConfigModel',

    # Util clipboard models
    'ClipboardHistoryModel',

    # Voice app models
    'VoiceDictionariesModel',
    'VoiceCacheDbDoneModel',
]
