#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
I18n (Internationalization) Package

Provides multi-language support for applications.

Usage:
    from pycore.pyutils.i18n import I18nManager

    # Get singleton instance
    i18n = I18nManager()

    # Extend with app translations (base translations already loaded)
    from pathlib import Path
    app_dir = Path(__file__).parent  # Current app directory
    i18n.extend_translations(app_dir=str(app_dir), app_name="myapp")

    # Get translation
    text = i18n.get("welcome_message")

    # Switch language
    i18n.set_language("zh")

    # Register language change listener
    i18n.add_listener(lambda lang: print(f"Language changed to {lang}"))
"""

from pycore.pyutils.native_ui.step0_i18n.i18n_manager import I18nManager, get_i18n_manager
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys

# Initialize i18n manager as global variable (singleton, accessible everywhere)
i18n = get_i18n_manager()

__all__ = [
    'I18nManager',
    'get_i18n_manager',
    'i18n',
    'I18nKeys'
]
