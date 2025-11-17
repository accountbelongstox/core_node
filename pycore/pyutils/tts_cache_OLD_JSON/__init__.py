#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Cache & Configuration Management (OLD JSON-based, now with Database support)

DEPRECATED: This is the OLD implementation kept for reference.
Use pycore.pyutils.tts_cache instead (which imports from here for compatibility).

Provides:
- TTS audio file caching (TTSCacheManager) - with optional database integration
- TTS configuration storage (TTSConfigManager) - with optional database integration
"""

from pycore.pyutils.tts_cache_OLD_JSON.tts_cache_manager import TTSCacheManager, tts_cache_manager
from pycore.pyutils.tts_cache_OLD_JSON.tts_config_manager import TTSConfigManager, tts_config_manager, get_tts_config_manager

__all__ = [
    'TTSCacheManager',
    'tts_cache_manager',
    'TTSConfigManager',
    'tts_config_manager',
    'get_tts_config_manager'
]
