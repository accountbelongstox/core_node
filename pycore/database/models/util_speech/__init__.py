#!/usr/bin/env python3
"""
Speech utility database models
TTS cache and speech-related table models
"""

from pycore.database.models.util_speech.tts_cache_model import SpeechTTSCacheModel
from pycore.database.models.util_speech.tts_config_model import SpeechTTSConfigModel

__all__ = [
    'SpeechTTSCacheModel',
    'SpeechTTSConfigModel',
]
