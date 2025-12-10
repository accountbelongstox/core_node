#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
I18n Keys - Translation Key Constants

Provides type-safe access to translation keys, avoiding string typos
and ensuring consistency across the codebase.

Usage:
    from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
    
    # Use constants instead of strings
    text = i18n.get(I18nKeys.WINDOW_TITLE_INITIALIZING)
    text = i18n.get(I18nKeys.TRAY_MENU_SHOW)
"""


class I18nKeys:
    """
    Base i18n translation key constants
    
    All keys use dot notation matching the translation JSON structure.
    """
    
    # Window keys
    WINDOW_TITLE_INITIALIZING = "window.title.initializing"
    WINDOW_BUTTON_MINIMIZE = "window.button.minimize"
    WINDOW_BUTTON_MAXIMIZE = "window.button.maximize"
    WINDOW_BUTTON_RESTORE = "window.button.restore"
    WINDOW_BUTTON_CLOSE = "window.button.close"
    WINDOW_BUTTON_MENU = "window.button.menu"
    WINDOW_ACTION_SHOW = "window.action.show"
    WINDOW_ACTION_HIDE = "window.action.hide"
    WINDOW_ACTION_RESTART = "window.action.restart"
    WINDOW_ACTION_EXIT = "window.action.exit"
    
    # Startup keys
    STARTUP_TITLE = "startup.title"
    STARTUP_STATUS_INITIALIZING = "startup.status.initializing"
    STARTUP_STATUS_CHECKING_DEPS = "startup.status.checking_deps"
    STARTUP_STATUS_INSTALLING = "startup.status.installing"
    STARTUP_STATUS_LOADING = "startup.status.loading"
    STARTUP_STATUS_READY = "startup.status.ready"
    STARTUP_STATUS_ERROR = "startup.status.error"
    
    # Tray keys
    TRAY_TOOLTIP = "tray.tooltip"
    TRAY_MENU_SHOW = "tray.menu.show"
    TRAY_MENU_HIDE = "tray.menu.hide"
    TRAY_MENU_MAXIMIZE = "tray.menu.maximize"
    TRAY_MENU_MINIMIZE = "tray.menu.minimize"
    TRAY_MENU_RESTORE = "tray.menu.restore"
    TRAY_MENU_RESTART = "tray.menu.restart"
    TRAY_MENU_EXIT = "tray.menu.exit"
    
    # Loading keys
    LOADING_TEXT = "loading.text"
    LOADING_PLEASE_WAIT = "loading.please_wait"
    
    # Language keys
    LANGUAGE_SELECT = "language.select"
    LANGUAGE_NAME_EN = "language.name.en"
    LANGUAGE_NAME_ZH = "language.name.zh"
    LANGUAGE_NAME_JA = "language.name.ja"
    
    @classmethod
    def get_all_keys(cls) -> list[str]:
        """Get all key constants as a list"""
        return [
            value for key, value in cls.__dict__.items()
            if not key.startswith('_') and isinstance(value, str) and key.isupper()
        ]


__all__ = ['I18nKeys']

