#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Configuration Cache Manager (SQLite Backend)

Caches user preferences for speech transcription using global_config (SQLite).
Migrated from JSON to database-backed storage.

Features:
- Language selections (multi-select support)
- Audio device selections
- Duration mode
- Transcription mode (single/dual)
- All stored in common.config table with 'speech_ui_' prefix
"""

from typing import Optional, List
from pycore.pyfoundations import ColorPrint


class SpeechConfigCache:
    """
    Speech Configuration Cache Manager (SQLite Backend)

    Stores user UI preferences in global config database.
    All keys use 'speech_ui_' prefix for namespace isolation.

    Key Naming Convention:
    - speech_ui_transcription_mode: 'single' or 'dual'
    - speech_ui_languages_{source}: List of language codes
    - speech_ui_audio_device_{type}: Device index
    - speech_ui_duration_mode: 'continuous' or 'limited'
    - speech_ui_duration_seconds: Recording duration
    """

    def __init__(self):
        """Initialize speech config cache"""
        from pycore.pyutils.common import global_config
        self._config = global_config

    def get_transcription_mode(self) -> Optional[str]:
        """
        Get cached transcription mode

        Returns:
            'single' or 'dual', or None if not cached
        """
        return self._config.get("speech_ui_transcription_mode")

    def set_transcription_mode(self, mode: str):
        """
        Cache transcription mode

        Args:
            mode: 'single' or 'dual'
        """
        self._config.set("speech_ui_transcription_mode", mode)
        ColorPrint.green(f"[SpeechConfigCache] Cached transcription mode: {mode}")

    def get_languages(self, source: str = "default") -> Optional[List[str]]:
        """
        Get cached language selections

        Args:
            source: Language source ('default', 'microphone', 'system')

        Returns:
            List of language codes or None if not cached
        """
        key = f"speech_ui_languages_{source}"
        return self._config.get(key)

    def set_languages(self, language_codes: List[str], source: str = "default"):
        """
        Cache language selections

        Args:
            language_codes: List of language codes (e.g., ['zh-CN', 'en-US'])
            source: Language source ('default', 'microphone', 'system')
        """
        key = f"speech_ui_languages_{source}"
        self._config.set(key, language_codes)
        ColorPrint.green(f"[SpeechConfigCache] Cached {source} languages: {language_codes}")

    def get_audio_device(self, device_type: str = "default") -> Optional[int]:
        """
        Get cached audio device index

        Args:
            device_type: Device type ('default', 'microphone', 'system')

        Returns:
            Device index or None if not cached
        """
        key = f"speech_ui_audio_device_{device_type}"
        return self._config.get(key)

    def set_audio_device(self, device_index: int, device_type: str = "default"):
        """
        Cache audio device selection

        Args:
            device_index: Audio device index
            device_type: Device type ('default', 'microphone', 'system')
        """
        key = f"speech_ui_audio_device_{device_type}"
        self._config.set(key, device_index)
        ColorPrint.green(f"[SpeechConfigCache] Cached {device_type} device: {device_index}")

    def get_duration_mode(self) -> Optional[str]:
        """
        Get cached duration mode

        Returns:
            'continuous' or 'limited', or None if not cached
        """
        return self._config.get("speech_ui_duration_mode")

    def set_duration_mode(self, mode: str):
        """
        Cache duration mode

        Args:
            mode: 'continuous' or 'limited'
        """
        self._config.set("speech_ui_duration_mode", mode)
        ColorPrint.green(f"[SpeechConfigCache] Cached duration mode: {mode}")

    def get_duration_seconds(self) -> Optional[int]:
        """
        Get cached duration in seconds (for limited mode)

        Returns:
            Duration in seconds or None if not cached
        """
        return self._config.get("speech_ui_duration_seconds")

    def set_duration_seconds(self, seconds: int):
        """
        Cache duration in seconds

        Args:
            seconds: Duration in seconds
        """
        self._config.set("speech_ui_duration_seconds", seconds)
        ColorPrint.green(f"[SpeechConfigCache] Cached duration: {seconds}s")

    def has_cache(self) -> bool:
        """
        Check if any configuration has been cached

        Returns:
            True if at least one config exists
        """
        # Check if transcription mode is set as a proxy
        return self._config.has_key("speech_ui_transcription_mode")

    def clear_cache(self):
        """Clear all cached speech UI settings"""
        # List of all speech UI keys
        ui_keys = [
            "speech_ui_transcription_mode",
            "speech_ui_languages_default",
            "speech_ui_languages_microphone",
            "speech_ui_languages_system",
            "speech_ui_audio_device_default",
            "speech_ui_audio_device_microphone",
            "speech_ui_audio_device_system",
            "speech_ui_duration_mode",
            "speech_ui_duration_seconds",
        ]

        for key in ui_keys:
            if self._config.has_key(key):
                self._config.delete(key)

        ColorPrint.yellow("[SpeechConfigCache] Cleared all cached settings")


# Global singleton instance
speech_config_cache = SpeechConfigCache()


__all__ = ['SpeechConfigCache', 'speech_config_cache']
