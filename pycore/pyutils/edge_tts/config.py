#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Configuration Module

Provides global constants and configuration for TTS operations.
"""

import os
from pathlib import Path
from typing import Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path

class TTSConfig:
    """
    TTS Global Configuration
    
    Provides directories, constants, and configuration for TTS operations.
    Uses wwwroot namespace for caching.
    """
    
    # Base directories (using wwwroot namespace)
    TTS_BASE_DIR = map_web_path('wwwroot', 'tts')
    TTS_DB_DIR = TTS_BASE_DIR / "db"
    TTS_CACHE_DIR = TTS_BASE_DIR / "cache"
    TTS_VOICE_DIR = TTS_BASE_DIR / "voices"
    TTS_TRANSLATION_DIR = TTS_BASE_DIR / "translations"
    
    # Subdirectories by language namespace
    TTS_VOICE_SENTENCE_DIR = TTS_VOICE_DIR / "sentences"
    TTS_VOICE_WORD_DIR = TTS_VOICE_DIR / "words"
    TTS_VOICE_DOCUMENT_DIR = TTS_VOICE_DIR / "documents"
    
    # Database files
    TTS_MAIN_DB = TTS_DB_DIR / "tts_main.db"
    TTS_CACHE_TRANSLATE_DB = TTS_DB_DIR / "cache_translate.db"
    
    # Initialize directories
    @staticmethod
    def initialize():
        """Initialize all TTS directories"""
        dirs = [
            TTSConfig.TTS_BASE_DIR,
            TTSConfig.TTS_DB_DIR,
            TTSConfig.TTS_CACHE_DIR,
            TTSConfig.TTS_VOICE_DIR,
            TTSConfig.TTS_TRANSLATION_DIR,
            TTSConfig.TTS_VOICE_SENTENCE_DIR,
            TTSConfig.TTS_VOICE_WORD_DIR,
            TTSConfig.TTS_VOICE_DOCUMENT_DIR,
        ]
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    # Language voice mapping (from soundQuality.js)
    VOICE_MAP: Dict[str, List[str]] = {
        # English voices
        'en-GB': ['en-GB-SoniaNeural', 'en-GB-RyanNeural'],
        'en-US': ['en-US-JennyNeural', 'en-US-GuyNeural'],
        'en-AU': ['en-AU-NatashaNeural', 'en-AU-WilliamNeural'],
        'en-CA': ['en-CA-ClaraNeural', 'en-CA-LiamNeural'],
        'en-HK': ['en-HK-YanNeural', 'en-HK-SamNeural'],
        'en-IN': ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
        'en-IE': ['en-IE-EmilyNeural', 'en-IE-ConnorNeural'],
        'en-NZ': ['en-NZ-MollyNeural', 'en-NZ-MitchellNeural'],
        'en-PH': ['en-PH-RosaNeural', 'en-PH-JamesNeural'],
        'en-SG': ['en-SG-LunaNeural', 'en-SG-WayneNeural'],
        'en-ZA': ['en-ZA-LeahNeural', 'en-ZA-LukeNeural'],
        
        # Chinese voices
        'zh-CN': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
        'zh-TW': ['zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural'],
        'zh-HK': ['zh-HK-HiuGaaiNeural', 'zh-HK-WanLungNeural'],
        
        # Arabic voices
        'ar-EG': ['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural'],
        'ar-SA': ['ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'],
        'ar-AE': ['ar-AE-FatimaNeural', 'ar-AE-HamdanNeural'],
        
        # European languages
        'fr-FR': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
        'de-DE': ['de-DE-KatjaNeural', 'de-DE-ConradNeural'],
        'it-IT': ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],
        'es-ES': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
        'pt-PT': ['pt-PT-RaquelNeural', 'pt-PT-DuarteNeural'],
        'ru-RU': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
        
        # Asian languages
        'ja-JP': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
        'ko-KR': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
        'hi-IN': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
        'th-TH': ['th-TH-PremwadeeNeural', 'th-TH-NiwatNeural'],
        'vi-VN': ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'],
    }
    
    @staticmethod
    def get_voice(locale: str, gender: str = 'female') -> str:
        """
        Get voice by locale and gender
        
        Args:
            locale: Language locale (e.g., 'en-US', 'zh-CN')
            gender: 'female' or 'male'
        
        Returns:
            str: Voice name or empty string if not found
        """
        if locale not in TTSConfig.VOICE_MAP:
            return ''
        voices = TTSConfig.VOICE_MAP[locale]
        index = 0 if gender.lower() == 'female' else 1
        if index < len(voices):
            return voices[index]
        return voices[0] if voices else ''
    
    @staticmethod
    def get_voice_dir(locale: str, item_type: str) -> Path:
        """
        Get voice directory for locale and item type
        
        Args:
            locale: Language locale
            item_type: 'sentence', 'word', or 'document'
        
        Returns:
            Path: Directory path
        """
        base_dir = {
            'sentence': TTSConfig.TTS_VOICE_SENTENCE_DIR,
            'word': TTSConfig.TTS_VOICE_WORD_DIR,
            'document': TTSConfig.TTS_VOICE_DOCUMENT_DIR,
        }.get(item_type, TTSConfig.TTS_VOICE_DIR)
        
        return base_dir / locale


# Initialize directories on import
TTSConfig.initialize()

