#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Cache & Configuration Management

Provides:
- TTS audio file caching (TTSCacheManager)
- TTS configuration storage (TTSConfigManager)
"""

from pycore.pyutils.tts_cache.tts_cache_manager import TTSCacheManager, tts_cache_manager
from pycore.pyutils.tts_cache.tts_config_manager import TTSConfigManager, tts_config_manager, get_tts_config_manager

__all__ = [
    'TTSCacheManager',
    'tts_cache_manager',
    'TTSConfigManager',
    'tts_config_manager',
    'get_tts_config_manager'
]
