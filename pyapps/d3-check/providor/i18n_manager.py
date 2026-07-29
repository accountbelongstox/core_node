"""
Internationalization Manager (single place for the project).
Manages multi-language support and language switching. Initialized once on first import.
"""
import json
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class I18nManager:
    """Internationalization Manager for multi-language support (singleton)."""

    _instance: Optional["I18nManager"] = None
    _initialized = False

    def __new__(cls) -> "I18nManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if I18nManager._initialized:
            return
        # providor/i18n_manager.py -> parent = providor, parent.parent = pyapps/d3-check
        self.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.providor_dir = os.path.join(self.root_dir, "providor")
        self.i18n_dir = os.path.join(self.providor_dir, "i18n")
        self.i18n_config_path = os.path.join(self.providor_dir, "i18n_config.json")
        self.current_language = ""
        self.supported_languages: List[str] = []
        self._language_names: Dict[str, str] = {}
        self.translations: Dict[str, Any] = {}
        self.language_change_listeners: List[Callable[[str], None]] = []
        self._load_i18n_config()
        I18nManager._initialized = True

    def _load_i18n_config(self) -> None:
        try:
            if os.path.exists(self.i18n_dir):
                self._load_multi_file_config()
            elif os.path.exists(self.i18n_config_path):
                with open(self.i18n_config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                self.current_language = config.get("default_language") or ""
                self.supported_languages = config.get("supported_languages") or []
                self._language_names = config.get("language_names") or {}
                self.translations = config.get("translations", {})
                ColorPrint.green(f"[I18nManager] Loaded single file i18n config, current language: {self.current_language}")
            else:
                ColorPrint.yellow("[I18nManager] i18n config files not found, using default settings")
                self._create_default_config()
        except (OSError, json.JSONDecodeError) as e:
            ColorPrint.red(f"[I18nManager] Failed to load i18n config: {e}")
            self._create_default_config()

    def _load_multi_file_config(self) -> None:
        try:
            base_config_path = os.path.join(self.i18n_dir, "i18n_base.json")
            if os.path.exists(base_config_path):
                with open(base_config_path, "r", encoding="utf-8") as f:
                    base_config = json.load(f)
                self.current_language = base_config.get("default_language") or ""
                self.supported_languages = base_config.get("supported_languages") or []
                self._language_names = base_config.get("language_names") or {}
            else:
                self.current_language = ""
                self.supported_languages = []
                self._language_names = {}
            self.translations = {}
            for lang in self.supported_languages:
                self.translations[lang] = self._load_language_files(lang)
            ColorPrint.green(f"[I18nManager] Loaded multi-file i18n config, current language: {self.current_language}")
        except (OSError, json.JSONDecodeError) as e:
            ColorPrint.red(f"[I18nManager] Failed to load multi-file config: {e}")
            self._create_default_config()

    def _load_language_files(self, language: str) -> Dict[str, Any]:
        translations: Dict[str, Any] = {}
        file_patterns = [
            f"i18n_main_window_{language}.json",
            f"i18n_skill_config_{language}.json",
            f"i18n_auxiliary_panel_{language}.json",
            f"i18n_rosbot_panel_{language}.json",
            f"i18n_d4_panel_{language}.json",
            f"i18n_log_panel_{language}.json",
            f"i18n_tabs_{language}.json",
            f"i18n_common_{language}.json",
            f"i18n_errors_{language}.json",
        ]
        loaded = []
        for pattern in file_patterns:
            file_path = os.path.join(self.i18n_dir, pattern)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        file_data = json.load(f)
                    self._merge_dict(translations, file_data)
                    loaded.append(pattern)
                except (OSError, json.JSONDecodeError) as e:
                    ColorPrint.red(f"[I18nManager] Failed to load {pattern}: {e}")
        if loaded:
            ColorPrint.blue(f"[I18nManager] Loaded {', '.join(loaded)}")
        return translations

    def _merge_dict(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._merge_dict(target[key], value)
            else:
                target[key] = value

    def _create_default_config(self) -> None:
        self.current_language = "zh"
        self.supported_languages = ["zh", "en"]
        self.translations = {
            "zh": {"ui": {"main_window": {"title": "暗黑破坏神3 宏助手"}}},
            "en": {"ui": {"main_window": {"title": "Diablo 3 Macro Assistant"}}},
        }

    def add_language_change_listener(self, listener: Callable[[str], None]) -> None:
        if listener not in self.language_change_listeners:
            self.language_change_listeners.append(listener)

    def remove_language_change_listener(self, listener: Callable[[str], None]) -> None:
        if listener in self.language_change_listeners:
            self.language_change_listeners.remove(listener)

    def _notify_language_change(self) -> None:
        for listener in list(self.language_change_listeners):
            try:
                listener(self.current_language)
            except Exception:
                pass

    def set_language(self, language: str, force: bool = False) -> None:
        if language not in self.supported_languages:
            ColorPrint.red(f"[I18nManager] Unsupported language: {language}")
            return
        if not force and self.current_language == language:
            ColorPrint.blue(f"[I18nManager] Language already set to {language}, skipping change")
            return
        old_language = self.current_language
        self.current_language = language
        self._save_language_to_config()
        self._notify_language_change()
        ColorPrint.green(f"[I18nManager] Language changed from {old_language} to {language}")

    def get_current_language(self) -> str:
        return self.current_language

    def get_supported_languages(self) -> List[str]:
        return self.supported_languages.copy()

    def get_language_names(self) -> Dict[str, str]:
        return {"zh": "中文", "en": "English"}

    def translate(self, key: str, default: Optional[str] = None) -> str:
        keys = key.split(".")
        value = self.translations.get(self.current_language, {})
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default if default is not None else key
        return value if isinstance(value, str) else (default if default is not None else key)

    def get_ui_text(self, ui_key: str, default: Optional[str] = None) -> str:
        if not ui_key.startswith("ui."):
            ui_key = f"ui.{ui_key}"
        fallback = default if default is not None else ui_key
        return self.translate(ui_key, fallback)

    def _save_language_to_config(self) -> None:
        try:
            from providor.providor_index import set_config_value_async
            set_config_value_async("ui_settings.current_language", self.current_language)
            set_config_value_async("ui_settings.supported_languages", self.supported_languages)
            ColorPrint.green(f"[I18nManager] Language setting saved to CONFIG: {self.current_language}")
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to save language setting to CONFIG: {e}")

    def load_language_from_config(self) -> None:
        try:
            from providor.providor_index import get_config_value_safe
            saved_language = get_config_value_safe("ui_settings.current_language", None)
            if saved_language and saved_language in self.supported_languages:
                self.current_language = saved_language
                ColorPrint.green(f"[I18nManager] Loaded language from CONFIG: {self.current_language}")
            elif saved_language:
                ColorPrint.yellow(f"[I18nManager] Language '{saved_language}' from CONFIG not in supported, using default")
        except Exception as e:
            ColorPrint.red(f"[I18nManager] Failed to load language from CONFIG: {e}")

    def get_translation_keys(self, language: Optional[str] = None) -> List[str]:
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
        missing_keys: Dict[str, List[str]] = {}
        zh_keys = set(self.get_translation_keys("zh"))
        for lang in self.supported_languages:
            if lang != "zh":
                lang_keys = set(self.get_translation_keys(lang))
                missing = zh_keys - lang_keys
                if missing:
                    missing_keys[lang] = list(missing)
        return missing_keys

    def reload_config(self) -> None:
        self.translations = {}
        self._load_i18n_config()
        ColorPrint.green("[I18nManager] Configuration reloaded successfully")


# Single project-wide instance; initialized once on first import of this module
i18n_manager = I18nManager()
