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
    TRAY_MENU_OPEN_WEB = "tray.menu.open_web"
    TRAY_MENU_PYCORE_UI = "tray.menu.pycore_ui"
    TRAY_MENU_HIDE = "tray.menu.hide"
    TRAY_MENU_MAXIMIZE = "tray.menu.maximize"
    TRAY_MENU_MINIMIZE = "tray.menu.minimize"
    TRAY_MENU_RESTORE = "tray.menu.restore"
    TRAY_MENU_RESTART = "tray.menu.restart"
    TRAY_MENU_EXIT = "tray.menu.exit"
    TRAY_MENU_EXIT_APP = "tray.menu.exit_app"      # "...{app_name}"
    TRAY_MENU_RPC_SERVER = "tray.menu.rpc_server"          # "...: {port}"
    TRAY_MENU_SINGLETON_PORT = "tray.menu.singleton_port"  # "...: {port}"
    TRAY_MENU_AUTOSTART = "tray.menu.autostart"
    TRAY_MENU_SERVICE_TOGGLE = "tray.menu.service_toggle"
    TRAY_MENU_LANGUAGE = "tray.menu.language"
    TRAY_MENU_CODE_SYNC = "tray.menu.code_sync"
    TRAY_MENU_CODE_SYNC_DISTRIBUTE = "tray.menu.code_sync_distribute"
    TRAY_MENU_CODE_SYNC_SKIP_UPDATE = "tray.menu.code_sync_skip_update"
    TRAY_MENU_PROMPT_DERIVE_SOUND = "tray.menu.prompt_derive_sound"
    TRAY_MENU_PROMPT_NEW_NOTIFY = "tray.menu.prompt_new_notify"

    # Toast keys
    TOAST_PROMPT_DERIVED_TITLE = "toast.prompt_derived_title"
    TOAST_PROMPT_NEW_TITLE = "toast.prompt_new_title"
    TOAST_ACTION_COPY = "toast.action_copy"
    TOAST_CLICK_TO_COPY = "toast.click_to_copy"
    TOAST_COPIED = "toast.copied"

    # Machine receive notifications
    RECEIVE_FILES_TITLE = "receive.files_title"
    RECEIVE_FILES_MESSAGE = "receive.files_message"          # "...{count} {dir}"
    RECEIVE_TEXT_TITLE = "receive.text_title"
    RECEIVE_TEXT_MESSAGE = "receive.text_message"            # "...{path}"
    RECEIVE_CLIPBOARD_TITLE = "receive.clipboard_title"
    RECEIVE_CLIPBOARD_MESSAGE = "receive.clipboard_message"  # "...{chars}"
    RECEIVE_CLIPBOARD_IMAGE_MESSAGE = "receive.clipboard_image_message"  # "...{path}"

    # Terminal backup notifications
    TERMINAL_BACKUP_TITLE = "terminal_backup.title"
    TERMINAL_BACKUP_MESSAGE = "terminal_backup.message"  # "...{count} {kb} {stored_kb}"
    TERMINAL_BACKUP_STUCK_TITLE = "terminal_backup.stuck_title"
    TERMINAL_BACKUP_STUCK_MESSAGE = "terminal_backup.stuck_message"  # "...{number} {name}"
    GITSYNC_CONFLICT_TITLE = "gitsync_watch.conflict_title"
    GITSYNC_CONFLICT_MESSAGE = "gitsync_watch.conflict_message"  # "...{path}"
    
    # Loading keys
    LOADING_TEXT = "loading.text"
    LOADING_PLEASE_WAIT = "loading.please_wait"
    
    # Language keys
    LANGUAGE_SELECT = "language.select"
    LANGUAGE_FOLLOW_SYSTEM = "language.follow_system"
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

