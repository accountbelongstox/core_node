"""
Internationalization Manager
Manages multi-language support and language switching functionality
"""

import json
import os
import sys
from typing import Dict, Any, Optional, List, Callable
from pathlib import Path

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint

class I18nManager:
    """Internationalization Manager for multi-language support (Singleton)"""

    _instance = None
    _initialized = False

    def __new__(cls):
        """Ensure singleton pattern"""
        if cls._instance is None:
            cls._instance = super(I18nManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the internationalization manager (only once)"""
        if I18nManager._initialized:
            return

        self.root_dir = os.path.dirname(os.path.dirname(__file__))
        self.providor_dir = os.path.join(self.root_dir, "providor")
        self.i18n_dir = os.path.join(self.providor_dir, "i18n")
        self.i18n_config_path = os.path.join(self.providor_dir, "i18n_config.json")

        # Language configuration
        self.current_language = "zh"  # Default Chinese
        self.supported_languages = ["zh", "en"]
        self.translations = {}
        
        # Listener list for language changes
        self.language_change_listeners: List[Callable[[str], None]] = []
        
        # Load configuration
        self._load_i18n_config()

        # Mark as initialized
        I18nManager._initialized = True
    
    def _load_i18n_config(self):
        """Load internationalization configuration"""
        try:
            # Try to load split multi-file configuration first
            if os.path.exists(self.i18n_dir):
                self._load_multi_file_config()
            elif os.path.exists(self.i18n_config_path):
                # Fallback to single file configuration
                with open(self.i18n_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                self.current_language = config.get('default_language', 'zh')
                self.supported_languages = config.get('supported_languages', ['zh', 'en'])
                self.translations = config.get('translations', {})
                
                ColorPrint.green(f"[I18nManager] Loaded single file i18n config, current language: {self.current_language}")
            else:
                ColorPrint.yellow("[I18nManager] i18n config files not found, using default settings")
                self._create_default_config()
                
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to load i18n config: {e}")
            self._create_default_config()
    
    def _load_multi_file_config(self):
        """Load multi-file configuration"""
        try:
            # Load base configuration
            base_config_path = os.path.join(self.i18n_dir, "i18n_base.json")
            if os.path.exists(base_config_path):
                with open(base_config_path, 'r', encoding='utf-8') as f:
                    base_config = json.load(f)
                
                self.current_language = base_config.get('default_language', 'zh')
                self.supported_languages = base_config.get('supported_languages', ['zh', 'en'])
            else:
                self.current_language = "zh"
                self.supported_languages = ["zh", "en"]
            
            # Load translation files for each language
            self.translations = {}
            for lang in self.supported_languages:
                self.translations[lang] = self._load_language_files(lang)
            
            ColorPrint.green(f"[I18nManager] Loaded multi-file i18n config, current language: {self.current_language}")
            
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to load multi-file config: {e}")
            self._create_default_config()
    
    def _load_language_files(self, language: str) -> Dict[str, Any]:
        """Load all translation files for specified language"""
        translations = {}

        # Define file loading order (by dependency)
        file_patterns = [
            f"i18n_main_window_{language}.json",
            f"i18n_skill_config_{language}.json",
            f"i18n_auxiliary_panel_{language}.json",
            f"i18n_rosbot_panel_{language}.json",
            f"i18n_d4_panel_{language}.json",
            f"i18n_log_panel_{language}.json",
            f"i18n_tabs_{language}.json",
            f"i18n_common_{language}.json",
            f"i18n_errors_{language}.json"
        ]
        
        for pattern in file_patterns:
            file_path = os.path.join(self.i18n_dir, pattern)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_data = json.load(f)
                    
                    # Merge into translation dictionary
                    self._merge_dict(translations, file_data)
                    ColorPrint.blue(f"[I18nManager] Loaded {pattern}")
                    
                except Exception as e:
                    ColorPrint.red(f"[I18nManager] Failed to load {pattern}: {e}")
        
        return translations
    
    def _merge_dict(self, target: Dict[str, Any], source: Dict[str, Any]):
        """Recursively merge dictionaries"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._merge_dict(target[key], value)
            else:
                target[key] = value
    
    def _create_default_config(self):
        """Create default configuration"""
        self.current_language = "zh"
        self.supported_languages = ["zh", "en"]
        self.translations = {
            "zh": {
                "ui": {
                    "main_window": {
                        "title": "暗黑破坏神3 宏助手"
                    }
                }
            },
            "en": {
                "ui": {
                    "main_window": {
                        "title": "Diablo 3 Macro Assistant"
                    }
                }
            }
        }
    
    def add_language_change_listener(self, listener: Callable[[str], None]):
        """Add language change listener"""
        if listener not in self.language_change_listeners:
            self.language_change_listeners.append(listener)
    
    def remove_language_change_listener(self, listener: Callable[[str], None]):
        """Remove language change listener"""
        if listener in self.language_change_listeners:
            self.language_change_listeners.remove(listener)
    
    def _notify_language_change(self):
        """Notify language change to all listeners"""
        for listener in self.language_change_listeners:
            try:
                listener(self.current_language)
            except Exception as e:
                ColorPrint.red(f"[I18nManager] Error in language change listener: {e}")
    
    def set_language(self, language: str, force: bool = False):
        """Set current language with debouncing"""
        if language not in self.supported_languages:
            ColorPrint.red(f"[I18nManager] Unsupported language: {language}")
            return

        # Debouncing: only change if different or forced
        if not force and self.current_language == language:
            ColorPrint.blue(f"[I18nManager] Language already set to {language}, skipping change")
            return

        old_language = self.current_language
        self.current_language = language

        # Save to template_config.json
        self._save_language_to_config()

        # Notify change
        self._notify_language_change()

        ColorPrint.green(f"[I18nManager] Language changed from {old_language} to {language}")
    
    def get_current_language(self) -> str:
        """Get current language"""
        return self.current_language
    
    def get_supported_languages(self) -> List[str]:
        """Get supported languages list"""
        return self.supported_languages.copy()
    
    def get_language_names(self) -> Dict[str, str]:
        """Get language names mapping"""
        return {
            "zh": "中文",
            "en": "English"
        }
    
    def translate(self, key: str, default: str = None) -> str:
        """Translate text"""
        try:
            # Support dot-separated key paths, e.g., "ui.main_window.title"
            keys = key.split('.')
            value = self.translations.get(self.current_language, {})
            
            for k in keys:
                if isinstance(value, dict) and k in value:
                    value = value[k]
                else:
                    # If translation not found, return default value or key itself
                    return default if default is not None else key
            
            return value if isinstance(value, str) else (default if default is not None else key)
            
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Translation error for key '{key}': {e}")
            return default if default is not None else key
    
    def get_ui_text(self, ui_key: str, default: Optional[str] = None) -> str:
        """Get UI text, with optional fallback when key is missing."""
        # Only add "ui." prefix if the key doesn't already have it
        if not ui_key.startswith("ui."):
            ui_key = f"ui.{ui_key}"
        fallback = default if default is not None else ui_key
        return self.translate(ui_key, fallback)
    
    def _save_language_to_config(self):
        """Save language setting to template_config.json"""
        try:
            template_config_path = os.path.join(self.providor_dir, "template_config.json")
            
            # Read existing configuration
            data = {}
            if os.path.exists(template_config_path):
                with open(template_config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            # Update language settings
            if 'ui_settings' not in data:
                data['ui_settings'] = {}
            
            data['ui_settings']['current_language'] = self.current_language
            data['ui_settings']['supported_languages'] = self.supported_languages
            
            # Save to file
            with open(template_config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            ColorPrint.green(f"[I18nManager] Language setting saved to template_config.json")
            
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to save language setting: {e}")
    
    def load_language_from_config(self):
        """Load language setting from template_config.json"""
        try:
            template_config_path = os.path.join(self.providor_dir, "template_config.json")
            
            if os.path.exists(template_config_path):
                with open(template_config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                ui_settings = data.get('ui_settings', {})
                saved_language = ui_settings.get('current_language')
                
                if saved_language and saved_language in self.supported_languages:
                    self.current_language = saved_language
                    ColorPrint.green(f"[I18nManager] Loaded language from config: {self.current_language}")
                
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to load language from config: {e}")
    
    def get_translation_keys(self, language: str = None) -> List[str]:
        """Get translation keys list"""
        if language is None:
            language = self.current_language
        
        def extract_keys(data: Dict[str, Any], prefix: str = "") -> List[str]:
            keys = []
            for key, value in data.items():
                current_key = f"{prefix}.{key}" if prefix else key
                if isinstance(value, dict):
                    keys.extend(extract_keys(value, current_key))
                else:
                    keys.append(current_key)
            return keys
        
        return extract_keys(self.translations.get(language, {}))
    
    def validate_translations(self) -> Dict[str, List[str]]:
        """Validate translation completeness"""
        missing_keys = {}
        
        # Use Chinese as baseline to check other languages
        zh_keys = set(self.get_translation_keys("zh"))
        
        for lang in self.supported_languages:
            if lang != "zh":
                lang_keys = set(self.get_translation_keys(lang))
                missing = zh_keys - lang_keys
                if missing:
                    missing_keys[lang] = list(missing)
        
        return missing_keys
    
    def reload_config(self):
        """Reload i18n configuration"""
        try:
            self.translations = {}
            self._load_i18n_config()
            ColorPrint.green("[I18nManager] Configuration reloaded successfully")
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to reload configuration: {e}")

# Global internationalization manager instance
i18n_manager = I18nManager()
