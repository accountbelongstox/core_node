#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
I18n Manager - Internationalization Management System

Provides multi-language support with dynamic language switching,
nested key access, and language change listeners.

Features:
- Multi-language support (JSON-based translations)
- Dynamic language switching
- Nested key access with dot notation (e.g., "menu.file.open")
- Language change listeners for UI updates
- Singleton pattern for global access
- Multi-file configuration support
- Fallback to default language on missing keys

Configuration Structure:
    i18n_dir/
    ├── i18n_base.json         # Base configuration
    │   {
    │     "default_language": "en",
    │     "supported_languages": ["en", "zh", "ja"]
    │   }
    ├── translations_en.json   # English translations
    ├── translations_zh.json   # Chinese translations
    └── translations_ja.json   # Japanese translations

Translation File Format:
    {
      "welcome": "Welcome",
      "menu": {
        "file": {
          "open": "Open",
          "save": "Save"
        }
      }
    }

Usage:
    from pycore.pyutils.i18n import I18nManager

    # Initialize
    i18n = I18nManager()
    i18n.initialize(config_dir="/path/to/i18n")

    # Get translations
    text = i18n.get("welcome")  # "Welcome"
    text = i18n.get("menu.file.open")  # "Open" (nested key)

    # Switch language
    i18n.set_language("zh")

    # Register listener
    def on_language_change(lang):
        print(f"Language changed to {lang}")

    i18n.add_listener(on_language_change)

Author: Extracted from d3-check, adapted for pycore
"""

import json
import os
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable

from pycore import ColorPrint


class I18nManager:
    """
    Internationalization Manager

    Singleton pattern implementation for global i18n management.
    """

    _instance: Optional['I18nManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize i18n manager (only once)"""
        if getattr(self, '_initialized', False):
            return

        self._config_dir: Optional[Path] = None
        self._current_language = "en"  # Default
        self._supported_languages: List[str] = ["en"]
        self._translations: Dict[str, Dict[str, Any]] = {}
        self._language_change_listeners: List[Callable[[str], None]] = []
        self._is_configured = False

        ColorPrint.print_info("[I18nManager] Initialized (singleton)")
        self._initialized = True

    def initialize(
        self,
        config_dir: str,
        default_language: Optional[str] = None
    ) -> bool:
        """
        Initialize i18n manager with configuration directory

        Args:
            config_dir: Path to i18n configuration directory
            default_language: Default language code (overrides config)

        Returns:
            True if initialized successfully, False otherwise
        """
        self._config_dir = Path(config_dir)

        if not self._config_dir.exists():
            ColorPrint.print_warn(
                f"[I18nManager] Config directory not found: {config_dir}, "
                f"using default settings"
            )
            self._create_default_config()
            self._is_configured = True
            return False

        try:
            # Load base configuration
            self._load_base_config()

            # Override default language if specified
            if default_language:
                self._current_language = default_language

            # Load translations for all supported languages
            self._load_translations()

            self._is_configured = True
            ColorPrint.print_success(
                f"[I18nManager] Initialized with language: {self._current_language}"
            )
            return True

        except Exception as e:
            ColorPrint.print_error(f"[I18nManager] Failed to initialize: {e}")
            self._create_default_config()
            self._is_configured = True
            return False

    def _load_base_config(self):
        """Load base configuration from i18n_base.json"""
        base_config_path = self._config_dir / "i18n_base.json"

        if base_config_path.exists():
            with open(base_config_path, 'r', encoding='utf-8') as f:
                base_config = json.load(f)

            self._current_language = base_config.get('default_language', 'en')
            self._supported_languages = base_config.get('supported_languages', ['en'])
        else:
            ColorPrint.print_warn(
                f"[I18nManager] Base config not found: {base_config_path}"
            )
            self._current_language = "en"
            self._supported_languages = ["en"]

    def _load_translations(self):
        """Load translation files for all supported languages"""
        self._translations = {}

        for lang in self._supported_languages:
            translation_file = self._config_dir / f"translations_{lang}.json"

            if translation_file.exists():
                try:
                    with open(translation_file, 'r', encoding='utf-8') as f:
                        self._translations[lang] = json.load(f)

                    ColorPrint.print_info(
                        f"[I18nManager] Loaded translations for language: {lang}"
                    )

                except Exception as e:
                    ColorPrint.print_error(
                        f"[I18nManager] Failed to load translations for {lang}: {e}"
                    )
                    self._translations[lang] = {}
            else:
                ColorPrint.print_warn(
                    f"[I18nManager] Translation file not found: {translation_file}"
                )
                self._translations[lang] = {}

    def _create_default_config(self):
        """Create default configuration"""
        self._current_language = "en"
        self._supported_languages = ["en"]
        self._translations = {"en": {}}

        ColorPrint.print_warn("[I18nManager] Using default configuration")

    def get(
        self,
        key: str,
        default: Optional[str] = None,
        language: Optional[str] = None
    ) -> str:
        """
        Get translation for a key

        Supports nested keys with dot notation (e.g., "menu.file.open")

        Args:
            key: Translation key (supports dot notation for nested keys)
            default: Default value if key not found
            language: Language code (uses current language if None)

        Returns:
            Translated text or default value or key itself if not found
        """
        if not self._is_configured:
            return default or key

        lang = language or self._current_language

        if lang not in self._translations:
            ColorPrint.print_warn(f"[I18nManager] Language not found: {lang}")
            return default or key

        # Navigate nested keys
        value = self._translations[lang]
        for part in key.split('.'):
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                # Key not found, try fallback or return default
                return default or key

        return str(value) if value is not None else (default or key)

    def set_language(self, language: str) -> bool:
        """
        Set current language

        Args:
            language: Language code

        Returns:
            True if language changed successfully, False otherwise
        """
        if language not in self._supported_languages:
            ColorPrint.print_warn(
                f"[I18nManager] Unsupported language: {language}, "
                f"supported: {self._supported_languages}"
            )
            return False

        if self._current_language == language:
            return True

        self._current_language = language
        ColorPrint.print_success(f"[I18nManager] Language changed to: {language}")

        # Notify listeners
        self._notify_listeners(language)

        return True

    def get_current_language(self) -> str:
        """Get current language code"""
        return self._current_language

    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        return self._supported_languages.copy()

    def add_listener(self, listener: Callable[[str], None]):
        """
        Add language change listener

        Args:
            listener: Callback function(lang: str) called when language changes
        """
        if listener not in self._language_change_listeners:
            self._language_change_listeners.append(listener)
            ColorPrint.print_info("[I18nManager] Added language change listener")

    def remove_listener(self, listener: Callable[[str], None]):
        """Remove language change listener"""
        if listener in self._language_change_listeners:
            self._language_change_listeners.remove(listener)
            ColorPrint.print_info("[I18nManager] Removed language change listener")

    def _notify_listeners(self, language: str):
        """Notify all listeners of language change"""
        for listener in self._language_change_listeners:
            try:
                listener(language)
            except Exception as e:
                ColorPrint.print_error(
                    f"[I18nManager] Error in language change listener: {e}"
                )

    def add_translations(
        self,
        language: str,
        translations: Dict[str, Any],
        merge: bool = True
    ):
        """
        Add or update translations for a language

        Args:
            language: Language code
            translations: Translation dictionary
            merge: If True, merge with existing translations; otherwise replace
        """
        if language not in self._supported_languages:
            ColorPrint.print_warn(
                f"[I18nManager] Adding unsupported language: {language}"
            )
            self._supported_languages.append(language)

        if merge and language in self._translations:
            self._translations[language].update(translations)
        else:
            self._translations[language] = translations

        ColorPrint.print_success(
            f"[I18nManager] Added/updated translations for language: {language}"
        )

    def reload(self) -> bool:
        """
        Reload translations from configuration directory

        Returns:
            True if reloaded successfully, False otherwise
        """
        if not self._config_dir or not self._config_dir.exists():
            ColorPrint.print_warn("[I18nManager] Cannot reload: no config directory")
            return False

        try:
            self._load_base_config()
            self._load_translations()

            ColorPrint.print_success("[I18nManager] Reloaded translations")
            return True

        except Exception as e:
            ColorPrint.print_error(f"[I18nManager] Failed to reload: {e}")
            return False


def get_i18n_manager() -> I18nManager:
    """
    Get the singleton I18nManager instance

    Returns:
        I18nManager singleton instance
    """
    return I18nManager()


# Export
__all__ = [
    'I18nManager',
    'get_i18n_manager'
]
