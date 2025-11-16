#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Configuration Cache Manager

Caches user preferences for speech transcription:
- Language selections (multi-select support)
- Audio device selections
- Duration mode
- Transcription mode (single/dual)
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import CACHE_DIR


class SpeechConfigCache:
    """
    Speech Configuration Cache Manager

    Features:
    - Cache language selections (supports multiple languages)
    - Cache audio device selections
    - Cache mode preferences
    - JSON-based storage
    - Auto-create cache directory
    """

    def __init__(self, cache_file: Optional[Path] = None):
        """
        Initialize speech config cache

        Args:
            cache_file: Path to cache file (default: CACHE_DIR/speech_config.json)
        """
        if cache_file is None:
            cache_dir = Path(CACHE_DIR) / "speech"
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file = cache_dir / "config.json"

        self.cache_file = Path(cache_file)
        self._config: Dict[str, Any] = {}
        self._load()

    def _load(self):
        """Load configuration from cache file"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                ColorPrint.blue(f"[ConfigCache] Loaded from: {self.cache_file}")
            except Exception as e:
                ColorPrint.yellow(f"[ConfigCache] Failed to load: {e}")
                self._config = {}
        else:
            ColorPrint.blue("[ConfigCache] No cached config found, using defaults")
            self._config = {}

    def _save(self):
        """Save configuration to cache file"""
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)
            ColorPrint.green(f"[ConfigCache] Saved to: {self.cache_file}")
        except Exception as e:
            ColorPrint.red(f"[ConfigCache] Failed to save: {e}")

    def get_transcription_mode(self) -> Optional[str]:
        """
        Get cached transcription mode

        Returns:
            'single' or 'dual', or None if not cached
        """
        return self._config.get("transcription_mode")

    def set_transcription_mode(self, mode: str):
        """
        Cache transcription mode

        Args:
            mode: 'single' or 'dual'
        """
        self._config["transcription_mode"] = mode
        self._save()
        ColorPrint.green(f"[ConfigCache] Cached transcription mode: {mode}")

    def get_languages(self, source: str = "default") -> Optional[List[str]]:
        """
        Get cached language selections

        Args:
            source: Language source ('default', 'microphone', 'system')

        Returns:
            List of language codes or None if not cached
        """
        languages = self._config.get("languages", {})
        return languages.get(source)

    def set_languages(self, language_codes: List[str], source: str = "default"):
        """
        Cache language selections

        Args:
            language_codes: List of language codes (e.g., ['zh-CN', 'en-US'])
            source: Language source ('default', 'microphone', 'system')
        """
        if "languages" not in self._config:
            self._config["languages"] = {}

        self._config["languages"][source] = language_codes
        self._save()
        ColorPrint.green(f"[ConfigCache] Cached {source} languages: {language_codes}")

    def get_audio_device(self, device_type: str = "default") -> Optional[int]:
        """
        Get cached audio device index

        Args:
            device_type: Device type ('default', 'microphone', 'system')

        Returns:
            Device index or None if not cached
        """
        devices = self._config.get("audio_devices", {})
        return devices.get(device_type)

    def set_audio_device(self, device_index: int, device_type: str = "default"):
        """
        Cache audio device selection

        Args:
            device_index: Audio device index
            device_type: Device type ('default', 'microphone', 'system')
        """
        if "audio_devices" not in self._config:
            self._config["audio_devices"] = {}

        self._config["audio_devices"][device_type] = device_index
        self._save()
        ColorPrint.green(f"[ConfigCache] Cached {device_type} device: {device_index}")

    def get_duration_mode(self) -> Optional[str]:
        """
        Get cached duration mode

        Returns:
            'continuous' or 'limited', or None if not cached
        """
        return self._config.get("duration_mode")

    def set_duration_mode(self, mode: str):
        """
        Cache duration mode

        Args:
            mode: 'continuous' or 'limited'
        """
        self._config["duration_mode"] = mode
        self._save()
        ColorPrint.green(f"[ConfigCache] Cached duration mode: {mode}")

    def get_duration_seconds(self) -> Optional[int]:
        """
        Get cached duration in seconds (for limited mode)

        Returns:
            Duration in seconds or None if not cached
        """
        return self._config.get("duration_seconds")

    def set_duration_seconds(self, seconds: int):
        """
        Cache duration in seconds

        Args:
            seconds: Duration in seconds
        """
        self._config["duration_seconds"] = seconds
        self._save()
        ColorPrint.green(f"[ConfigCache] Cached duration: {seconds}s")

    def has_cache(self) -> bool:
        """
        Check if any configuration is cached

        Returns:
            True if cache exists and has data
        """
        return bool(self._config)

    def clear(self):
        """Clear all cached configuration"""
        self._config = {}
        if self.cache_file.exists():
            self.cache_file.unlink()
        ColorPrint.yellow("[ConfigCache] Cleared all cached configuration")

    def get_all(self) -> Dict[str, Any]:
        """
        Get all cached configuration

        Returns:
            Complete configuration dictionary
        """
        return self._config.copy()

    def print_cached_config(self):
        """Print current cached configuration"""
        if not self.has_cache():
            ColorPrint.yellow("[ConfigCache] No cached configuration")
            return

        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[Cached Configuration]")
        ColorPrint.blue("=" * 70)

        if "transcription_mode" in self._config:
            print(f"Transcription Mode: {self._config['transcription_mode']}")

        if "languages" in self._config:
            print(f"\nLanguages:")
            for source, langs in self._config["languages"].items():
                print(f"  {source}: {langs}")

        if "audio_devices" in self._config:
            print(f"\nAudio Devices:")
            for device_type, index in self._config["audio_devices"].items():
                print(f"  {device_type}: {index}")

        if "duration_mode" in self._config:
            print(f"\nDuration Mode: {self._config['duration_mode']}")
            if "duration_seconds" in self._config:
                print(f"Duration Seconds: {self._config['duration_seconds']}")

        ColorPrint.blue("=" * 70 + "\n")


# Global singleton instance
speech_config_cache = SpeechConfigCache()
