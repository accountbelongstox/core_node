#!/usr/bin/env python3
"""
Voice app database models
Models for vocabulary dictionary and cache tracking
"""

from pycore.database.models.app_voice.dictionaries_model import VoiceDictionariesModel
from pycore.database.models.app_voice.cache_db_done_model import VoiceCacheDbDoneModel

__all__ = [
    'VoiceDictionariesModel',
    'VoiceCacheDbDoneModel',
]
