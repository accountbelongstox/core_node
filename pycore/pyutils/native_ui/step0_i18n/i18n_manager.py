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
    from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
    from pathlib import Path
    
    # i18n is pre-initialized with base translations
    # Extend with app translations (auto-detects {appname}_i18n or i18n directory)
    app_dir = Path(__file__).parent  # Current app directory
    i18n.extend_translations(app_dir=str(app_dir), app_name="myapp")

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
import locale
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusKeys, BusSignals
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)

# Base translations directory (step0_i18n/translations/)
_BASE_I18N_DIR = Path(__file__).parent / "translations"


def _notify_i18n_listener(listener: Callable[[str], None], language: str) -> None:
    listener(language)


class I18nManager:
    """
    Internationalization Manager

    Singleton pattern implementation for global i18n management.
    """

    def __init__(self):
        """Initialize i18n manager."""
        self._config_dir: Optional[Path] = None
        self._current_language = "en"  # Default
        self._supported_languages: List[str] = ["en"]
        self._translations: Dict[str, Dict[str, Any]] = {}
        self._language_change_listeners: List[Callable[[str], None]] = []
        self._is_configured = False
        self._base_config: Dict[str, Any] = {}  # Store base config for merging
        init_serialized_owner(
            self,
            "native_ui.i18n.state",
            "I18nManagerState",
        )

        # Load base translations from step0_i18n/translations/
        self._load_base_translations()

        # Initialize THREAD_BUS with i18n state
        THREAD_BUS.signal(BusKeys.I18N_CURRENT_LANGUAGE, self._current_language)
        THREAD_BUS.signal(BusKeys.I18N_SUPPORTED_LANGUAGES, self._supported_languages.copy())

        # Register bus event handler for language change requests
        def on_set_language_request(event_data: Dict[str, Any]):
            """Handle language change request from THREAD_BUS"""
            language = event_data.get('language')
            if language:
                self.set_language(language)

        THREAD_BUS.register_event_handler(BusSignals.I18N_SET_LANGUAGE, on_set_language_request)
        ColorPrint.print_info("[I18nManager] Registered I18N_SET_LANGUAGE event handler")

        ColorPrint.print_info("[I18nManager] Initialized (singleton)")

    @serialized_method
    def extend_translations(
        self,
        app_dir: str,
        app_name: str,
        default_language: Optional[str] = None,
        use_system_language: bool = True
    ) -> bool:
        """
        Extend i18n manager with app-specific translations

        Note: i18n manager is already initialized with base translations from step0_i18n/translations/
        This method extends/merges app translations with existing base translations.
        App-specific i18n keys should be defined in {appname}_i18n_keys.py and imported in app code.

        Args:
            app_dir: Path to app directory (e.g., Path(__file__).parent)
            app_name: App name (e.g., "mcpserver")
            default_language: Default language code (overrides config and system)
            use_system_language: If True, detect and use system language (default: True)

        Returns:
            True if extended successfully, False otherwise
        """
        app_dir_path = Path(app_dir)
        
        # Auto-detect i18n directory: try {appname}_i18n first, then i18n
        i18n_dir = app_dir_path / f"{app_name}_i18n"
        if not i18n_dir.exists():
            i18n_dir = app_dir_path / "i18n"
        
        if not i18n_dir.exists():
            ColorPrint.print_warn(
                f"[I18nManager] No i18n directory found in {app_dir_path} "
                f"(tried {app_name}_i18n and i18n), skipping app translations"
            )
            return False
        
        self._config_dir = i18n_dir

        try:
            # Load base configuration
            self._load_base_config()

            # Detect system language if enabled and no default specified
            if use_system_language and not default_language:
                system_lang = self._detect_system_language()
                if system_lang in self._supported_languages:
                    self._current_language = system_lang
                    ColorPrint.print_info(f"[I18nManager] Detected system language: {system_lang}")

            # Override with default language if specified
            if default_language:
                self._current_language = default_language

            # Load translations for all supported languages
            self._load_translations()

            # Update THREAD_BUS with current language and supported languages
            THREAD_BUS.signal(BusKeys.I18N_CURRENT_LANGUAGE, self._current_language)
            THREAD_BUS.signal(BusKeys.I18N_SUPPORTED_LANGUAGES, self._supported_languages.copy())

            self._is_configured = True
            ColorPrint.print_success(
                f"[I18nManager] Extended with app translations, current language: {self._current_language}"
            )
            return True

        except Exception as e:
            ColorPrint.print_error(f"[I18nManager] Failed to extend translations: {e}")
            self._create_default_config()
            self._is_configured = True
            return False

    def _load_base_config(self):
        """Load app configuration from app i18n_base.json (deep merges with base config)"""
        base_config_path = self._config_dir / "i18n_base.json"

        if base_config_path.exists():
            try:
                with open(base_config_path, 'r', encoding='utf-8') as f:
                    app_config = json.load(f)

                # Deep merge app config with base config (preserve base values, extend with app values)
                # Use stored base config for merging
                base_config_dict = self._base_config.copy() if self._base_config else {
                    'default_language': self._current_language,
                    'supported_languages': self._supported_languages.copy()
                }
                
                # Deep merge app config into base config
                merged_config = self._deep_merge_dict(base_config_dict, app_config)
                
                # Apply merged config
                self._current_language = merged_config.get('default_language', self._current_language)
                
                # Merge supported_languages list (union, preserve order)
                base_langs = merged_config.get('supported_languages', self._supported_languages)
                app_langs = app_config.get('supported_languages', [])
                merged_langs = list(base_langs) if isinstance(base_langs, list) else []
                for lang in app_langs:
                    if lang not in merged_langs:
                        merged_langs.append(lang)
                self._supported_languages = merged_langs
                
                ColorPrint.print_info(
                    f"[I18nManager] Merged app config with base config, supported languages: {self._supported_languages}"
                )
            except Exception as e:
                ColorPrint.print_warn(
                    f"[I18nManager] Failed to load app config: {base_config_path}, {e}"
                )
        else:
            ColorPrint.print_warn(
                f"[I18nManager] App config not found: {base_config_path}, using base config"
            )

    def _load_base_translations(self):
        """Load base translations from step0_i18n/translations/ directory"""
        if not _BASE_I18N_DIR.exists():
            ColorPrint.print_warn(
                f"[I18nManager] Base translations directory not found: {_BASE_I18N_DIR}"
            )
            return

        # Load base config
        base_config_path = _BASE_I18N_DIR / "i18n_base.json"
        if base_config_path.exists():
            try:
                with open(base_config_path, 'r', encoding='utf-8') as f:
                    self._base_config = json.load(f)
                self._current_language = self._base_config.get('default_language', 'en')
                self._supported_languages = self._base_config.get('supported_languages', ['en'])
            except Exception as e:
                ColorPrint.print_warn(f"[I18nManager] Failed to load base config: {e}")
                self._base_config = {}

        # Load base translations for all supported languages
        for lang in self._supported_languages:
            translation_file = _BASE_I18N_DIR / f"translations_{lang}.json"
            if translation_file.exists():
                try:
                    with open(translation_file, 'r', encoding='utf-8') as f:
                        self._translations[lang] = json.load(f)
                    ColorPrint.print_info(
                        f"[I18nManager] Loaded base translations for language: {lang}"
                    )
                except Exception as e:
                    ColorPrint.print_warn(
                        f"[I18nManager] Failed to load base translations for {lang}: {e}"
                    )
                    self._translations[lang] = {}

        # Base translations alone are a working configuration: services that never
        # call extend_translations() (e.g. the pyservice tray) must still get
        # translated strings instead of raw keys from get().
        if self._translations:
            self._is_configured = True

    def _deep_merge_dict(self, base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries (recursive merge for nested dicts)
        
        Args:
            base: Base dictionary (base translations)
            update: Update dictionary (app translations)
            
        Returns:
            Merged dictionary (base + update, with update taking precedence for conflicts)
        """
        result = base.copy()
        for key, value in update.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                result[key] = self._deep_merge_dict(result[key], value)
            else:
                # Override or add new key
                result[key] = value
        return result

    def _load_translations(self):
        """Load translation files for all supported languages from app directory"""
        # Note: This deep merges with existing base translations, not replacing them
        for lang in self._supported_languages:
            translation_file = self._config_dir / f"translations_{lang}.json"

            if translation_file.exists():
                try:
                    with open(translation_file, 'r', encoding='utf-8') as f:
                        app_translations = json.load(f)

                    # Deep merge with existing translations (base translations)
                    if lang in self._translations:
                        self._translations[lang] = self._deep_merge_dict(
                            self._translations[lang], 
                            app_translations
                        )
                    else:
                        self._translations[lang] = app_translations

                    ColorPrint.print_info(
                        f"[I18nManager] Loaded and merged app translations for language: {lang}"
                    )

                except Exception as e:
                    ColorPrint.print_error(
                        f"[I18nManager] Failed to load app translations for {lang}: {e}"
                    )
                    if lang not in self._translations:
                        self._translations[lang] = {}
            else:
                ColorPrint.print_warn(
                    f"[I18nManager] App translation file not found: {translation_file}"
                )
                if lang not in self._translations:
                    self._translations[lang] = {}

    def _detect_system_language(self) -> str:
        """
        Detect system language

        Returns:
            Language code (e.g., 'en', 'zh', 'ja')
        """
        try:
            # Get system locale
            system_locale = locale.getdefaultlocale()[0]
            if system_locale:
                # Extract language code (e.g., 'zh_CN' -> 'zh')
                lang_code = system_locale.split('_')[0].lower()
                ColorPrint.print_info(f"[I18nManager] System locale detected: {system_locale} -> {lang_code}")
                return lang_code
        except Exception as e:
            ColorPrint.print_warn(f"[I18nManager] Failed to detect system language: {e}")

        return "en"  # Default fallback

    def _create_default_config(self):
        """Create default configuration"""
        self._current_language = "en"
        self._supported_languages = ["en"]
        self._translations = {"en": {}}

        ColorPrint.print_warn("[I18nManager] Using default configuration")

    @serialized_method
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

        value = self._lookup(self._translations[lang], key)

        # Fallback: missing key in the current language -> default language
        if value is None:
            fallback_lang = self._base_config.get('default_language', 'en')
            if fallback_lang != lang and fallback_lang in self._translations:
                value = self._lookup(self._translations[fallback_lang], key)

        return str(value) if value is not None else (default or key)

    @staticmethod
    def _lookup(translations: Dict[str, Any], key: str) -> Optional[Any]:
        """Resolve a key in one language dict (flat key first, then dot-nested)."""
        # Flat key (e.g., "mcpserver.tray.start_mcp_server")
        if key in translations:
            value = translations[key]
            if not isinstance(value, dict):
                return value

        # Nested navigation (e.g., "window.title.initializing")
        value = translations
        for part in key.split('.'):
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return None
        return None if isinstance(value, dict) else value

    @serialized_method
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

        previous_language = self._current_language
        self._current_language = language
        ColorPrint.print_success(f"[I18nManager] Language changed to: {language}")

        # Update THREAD_BUS with current language
        THREAD_BUS.signal(BusKeys.I18N_CURRENT_LANGUAGE, language)
        THREAD_BUS.signal(BusKeys.I18N_SUPPORTED_LANGUAGES, self._supported_languages.copy())

        # Emit language changed signal
        THREAD_BUS.signal(BusSignals.I18N_LANGUAGE_CHANGED, {
            "language": language,
            "previous_language": previous_language,
            "supported_languages": self._supported_languages.copy()
        })

        # Emit UI redraw signal (for both Tkinter and PySide6)
        THREAD_BUS.signal(BusSignals.UI_REDRAW, {
            "reason": "language_changed",
            "language": language
        })

        # Notify listeners
        self._notify_listeners(language)

        return True

    @serialized_method
    def get_current_language(self) -> str:
        """Get current language code"""
        return self._current_language

    @serialized_method
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        return self._supported_languages.copy()

    @serialized_method
    def get_language_name_key(self, language_code: str) -> str:
        """
        Get i18n key for language name (e.g., "language.name.en")
        
        Args:
            language_code: Language code (e.g., "en", "zh", "ja")
            
        Returns:
            I18n key for language name (e.g., "language.name.en")
        """
        # Check if language_names exists in base_config
        language_names = self._base_config.get('language_names', {})
        if language_code in language_names:
            # Return the i18n key format
            return f"language.name.{language_code}"
        else:
            # Fallback: return key format anyway (translation may exist in translation files)
            return f"language.name.{language_code}"

    @serialized_method
    def add_listener(self, listener: Callable[[str], None]):
        """
        Add language change listener

        Args:
            listener: Callback function(lang: str) called when language changes
        """
        if listener not in self._language_change_listeners:
            self._language_change_listeners.append(listener)
            ColorPrint.print_info("[I18nManager] Added language change listener")

    @serialized_method
    def remove_listener(self, listener: Callable[[str], None]):
        """Remove language change listener"""
        if listener in self._language_change_listeners:
            self._language_change_listeners.remove(listener)
            ColorPrint.print_info("[I18nManager] Removed language change listener")

    def _notify_listeners(self, language: str):
        """Notify all listeners of language change"""
        for listener in self._language_change_listeners:
            try:
                start_bus_task(
                    _notify_i18n_listener,
                    listener,
                    language,
                    thread_name="I18nListenerThread",
                )
            except Exception as e:
                ColorPrint.print_error(
                    f"[I18nManager] Error in language change listener: {e}"
                )

    @serialized_method
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

    @serialized_method
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


_I18N_MANAGER_PROVIDER = SerializedSingletonProvider(
    I18nManager,
    "native_ui.i18n.provider",
    "I18nManagerProvider",
)

i18n = _I18N_MANAGER_PROVIDER.get()


# Export
__all__ = ['i18n']
