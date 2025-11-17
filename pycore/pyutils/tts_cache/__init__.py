#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Cache & Configuration Management (Database-backed)

Provides:
- TTS audio file caching (TTSCacheManager) - Database + File storage
- TTS configuration storage (TTSConfigManager) - Database-backed

This is the new interface that uses the database system.
For backward compatibility, we re-export the OLD_JSON implementations
which already have database support built-in.
"""

# Import from OLD_JSON implementations (they already support database!)
from pycore.pyutils.tts_cache_OLD_JSON.tts_cache_manager import TTSCacheManager, tts_cache_manager
from pycore.pyutils.tts_cache_OLD_JSON.tts_config_manager import TTSConfigManager, tts_config_manager, get_tts_config_manager

__all__ = [
    'TTSCacheManager',
    'tts_cache_manager',
    'TTSConfigManager',
    'tts_config_manager',
    'get_tts_config_manager'
]
