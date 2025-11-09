#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
I18n (Internationalization) Package

Provides multi-language support for applications.

Usage:
    from pycore.pyutils.i18n import I18nManager

    # Get singleton instance
    i18n = I18nManager()

    # Initialize with config
    i18n.initialize(config_dir="path/to/i18n/config")

    # Get translation
    text = i18n.get("welcome_message")

    # Switch language
    i18n.set_language("zh")

    # Register language change listener
    i18n.add_listener(lambda lang: print(f"Language changed to {lang}"))
"""

from pycore.pyutils.native_ui.i18n.i18n_manager import I18nManager, get_i18n_manager

__all__ = [
    'I18nManager',
    'get_i18n_manager'
]
