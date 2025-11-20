#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Configuration

Configuration for Azure Speech Services.
Uses wwwroot namespace for caching (shared with edge_tts).
"""

from pathlib import Path

from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyfoundations.secret_manager import get_secret_key


class AzureSpeechConfig:
    """
    Azure Speech Global Configuration
    
    Uses wwwroot namespace for caching.
    """
    
    # Base directories (using wwwroot namespace, shared with edge_tts)
    AZURE_SPEECH_BASE_DIR = map_web_path('wwwroot', 'azure_speech')
    AZURE_SPEECH_DB_DIR = AZURE_SPEECH_BASE_DIR / "db"
    AZURE_SPEECH_CACHE_DIR = AZURE_SPEECH_BASE_DIR / "cache"
    AZURE_SPEECH_VOICE_DIR = AZURE_SPEECH_BASE_DIR / "voices"
    
    # Subdirectories by language namespace
    AZURE_SPEECH_VOICE_SENTENCE_DIR = AZURE_SPEECH_VOICE_DIR / "sentences"
    AZURE_SPEECH_VOICE_WORD_DIR = AZURE_SPEECH_VOICE_DIR / "words"
    AZURE_SPEECH_VOICE_DOCUMENT_DIR = AZURE_SPEECH_VOICE_DIR / "documents"
    
    # Configuration defaults. Credentials MUST be retrieved via secret_manager.
    # Do not change this mechanism to environment variables or other sources.
    AZURE_SPEECH_KEY1 = get_secret_key("AZURE_SPEECH_KEYA_1") or ''
    AZURE_SPEECH_KEY2 = get_secret_key("AZURE_SPEECH_KEYB_1") or ''
    AZURE_SPEECH_REGION = get_secret_key("AZURE_SPEECH_REGION_1") or 'eastus'
    AZURE_SPEECH_ENDPOINT = "https://{region}.api.cognitive.microsoft.com/".format(
        region=AZURE_SPEECH_REGION or 'eastus'
    )
    
    @staticmethod
    def get_key() -> str:
        """Get Azure Speech key (KEY1 or KEY2)"""
        key1 = AzureSpeechConfig.AZURE_SPEECH_KEY1.strip() if AzureSpeechConfig.AZURE_SPEECH_KEY1 else ''
        key2 = AzureSpeechConfig.AZURE_SPEECH_KEY2.strip() if AzureSpeechConfig.AZURE_SPEECH_KEY2 else ''
        return key1 if key1 else key2
    
    @staticmethod
    def initialize():
        """Initialize all Azure Speech directories"""
        dirs = [
            AzureSpeechConfig.AZURE_SPEECH_BASE_DIR,
            AzureSpeechConfig.AZURE_SPEECH_DB_DIR,
            AzureSpeechConfig.AZURE_SPEECH_CACHE_DIR,
            AzureSpeechConfig.AZURE_SPEECH_VOICE_DIR,
            AzureSpeechConfig.AZURE_SPEECH_VOICE_SENTENCE_DIR,
            AzureSpeechConfig.AZURE_SPEECH_VOICE_WORD_DIR,
            AzureSpeechConfig.AZURE_SPEECH_VOICE_DOCUMENT_DIR,
        ]
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)


# Initialize directories on import
AzureSpeechConfig.initialize()

