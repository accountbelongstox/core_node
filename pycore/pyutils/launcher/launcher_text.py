# -*- coding: utf-8 -*-
"""
Launcher message catalog (i18n) for the window launcher CLI.

Translations live under launcher_i18n/<language>/*.json as flat
{"key": "text"} objects; every JSON file of a language directory is merged, so
each launcher feature owns its own file. Text may carry str.format
placeholders ({name}). Language order: PYCORE_LAUNCHER_LANG env, the saved UI
language (user_data system_settings.lang), the OS locale, then English.
"""

import ctypes
import json
import locale
import os
from pathlib import Path
from typing import Dict

from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyutils.common.user_data_store import USER_DATA_SECTION_SYSTEM_SETTINGS, user_data_store

LAUNCHER_I18N_DIR = Path(__file__).parent / 'launcher_i18n'
DEFAULT_LANGUAGE = 'en'
LANGUAGE_ENV = 'PYCORE_LAUNCHER_LANG'
LANGUAGE_SETTING_KEY = 'lang'
LANGUAGE_CODE_LENGTH = 2
CATALOG_GLOB = '*.json'


class LauncherText:
    """Resolve launcher message keys to localized text."""

    def __init__(self):
        self._catalogs: Dict[str, Dict[str, str]] = {}
        self._language = ''

    def language(self) -> str:
        if not self._language:
            self._language = self._resolve_language()
        return self._language

    def get(self, key: str, **values) -> str:
        text = self._catalog(self.language()).get(key)
        if text is None:
            text = self._catalog(DEFAULT_LANGUAGE).get(key, key)
        if values:
            return text.format(**values)
        return text

    def _resolve_language(self) -> str:
        candidates = [
            os.environ.get(LANGUAGE_ENV, ''),
            str(user_data_store.get_section(USER_DATA_SECTION_SYSTEM_SETTINGS).get(LANGUAGE_SETTING_KEY) or ''),
            self._os_language(),
            os.environ.get('LANG', ''),
        ]
        for candidate in candidates:
            code = candidate.strip().lower()[:LANGUAGE_CODE_LENGTH]
            if code and (LAUNCHER_I18N_DIR / code).is_dir():
                return code
        return DEFAULT_LANGUAGE

    @staticmethod
    def _os_language() -> str:
        # Windows locale names ("Chinese (Simplified)_China") are not ISO codes;
        # map the UI language id through the stdlib windows_locale table.
        if IS_WINDOWS:
            return locale.windows_locale.get(ctypes.windll.kernel32.GetUserDefaultUILanguage(), '')
        return locale.getlocale()[0] or ''

    def _catalog(self, language: str) -> Dict[str, str]:
        if language not in self._catalogs:
            merged: Dict[str, str] = {}
            language_dir = LAUNCHER_I18N_DIR / language
            if language_dir.is_dir():
                for catalog_path in sorted(language_dir.glob(CATALOG_GLOB)):
                    merged.update(json.loads(catalog_path.read_text(encoding='utf-8')))
            self._catalogs[language] = merged
        return self._catalogs[language]


launcher_text = LauncherText()
