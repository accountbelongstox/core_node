#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Cache Manager

Provides caching for TTS (Text-to-Speech) audio files to avoid redundant synthesis.
"""

from pycore.pyutils.tts_cache.tts_cache_manager import TTSCacheManager, tts_cache_manager

__all__ = ['TTSCacheManager', 'tts_cache_manager']
