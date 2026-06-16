# -*- coding: utf-8 -*-
"""
Tray Menu Builder for Pycore Module Caller

Builds tray menu items with dynamic state getters.
This module only defines menu structure, does not start any threads.
"""

import platform
from typing import Any, Dict, List

from pycore import THREAD_BUS
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem
from pycore.callmodule.platform.startup_manager import get_startup_manager

IS_WINDOWS = platform.system() == 'Windows'

# Signal prefix for tray language switching; one event per language code is
# emitted as f"{TRAY_SET_LANGUAGE_SIGNAL}.{code}" (handlers registered in
# event_handlers.py from the same supported-languages list).
TRAY_SET_LANGUAGE_SIGNAL = "tray_action_set_language"


def build_language_submenu() -> List[TrayMenuItem]:
    """
    Build one radio-style item per supported language.

    Fully data-driven: languages come from i18n (i18n_base.json
    supported_languages), display names from the "language.name.{code}" keys.
    Adding a language there extends this menu with no code change.
    """
    codes = i18n.get_supported_languages()

    def make_state_getter(code: str):
        def getter():
            try:
                return "[X]" if i18n.get_current_language() == code else "[ ]"
            except Exception:
                return "[ ]"
        return getter

    return [
        TrayMenuItem(
            text=f"language.name.{code}",
            action_signal=f"{TRAY_SET_LANGUAGE_SIGNAL}.{code}",
            state_getter=make_state_getter(code),
        )
        for code in codes
    ]


def build_tray_menu(port: int, singleton_port: int = None) -> List[TrayMenuItem]:
    """
    Build tray menu items with dynamic state getters

    Args:
        port: RPC v2 server port
        singleton_port: Singleton port (optional)

    Returns:
        List of TrayMenuItem objects
    """
    # State getter for Auto-Start
    def get_autostart_state():
        """Get current auto-start state (native per-OS startup manager)."""
        try:
            return "[X]" if get_startup_manager().is_enabled() else "[ ]"
        except Exception:
            return "[ ]"

    # State getter for Voice Subtitle window visibility (published by the UI framework)
    def get_voice_subtitle_state():
        """Get current Voice Subtitle window visibility state"""
        visible = THREAD_BUS.get_signal('voice_subtitle_ui.window_visible', False)
        return "[X]" if visible else "[ ]"

    # Define menu items. Every text is an i18n key; get_display_text() translates
    # it per the current language at render time (the Win32 backend rebuilds the
    # menu on each right-click, so language switches apply live).
    menu_items = [
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_OPEN_WEB,
            action_signal="tray_action_open",
            default=True
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_RPC_SERVER,
            text_args={"port": port},
            action_signal="",
            enabled=False
        ),
    ]

    # Add singleton port info if available
    if singleton_port is not None:
        menu_items.append(
            TrayMenuItem(
                text=I18nKeys.TRAY_MENU_SINGLETON_PORT,
                text_args={"port": singleton_port},
                action_signal="",
                enabled=False
            )
        )

    menu_items.extend([
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            # "PyCore UI" / "PyCore UI 界面" (was "Voice Subtitle Window"): toggles
            # the same PySide6 webview window (now the pycore_laravel_wordflow_ui
            # pycore-manager UI).
            text=I18nKeys.TRAY_MENU_PYCORE_UI,
            action_signal="tray_action_toggle_voice_subtitle",
            state_getter=get_voice_subtitle_state
        ),
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_AUTOSTART,
            action_signal="tray_action_toggle_startup",
            state_getter=get_autostart_state
        ),
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_LANGUAGE,
            action_signal="",
            submenu=build_language_submenu()
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_RESTART,
            action_signal="tray_action_restart"
        ),
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_EXIT,
            action_signal="tray_action_exit"
        )
    ])

    return menu_items


def tray_menu_to_dicts(items: List[TrayMenuItem]) -> List[Dict[str, Any]]:
    """
    Convert pystray TrayMenuItem objects into the canonical, framework-agnostic
    dict format consumed by the native Qt tray.

    This keeps build_tray_menu() as the single source of truth for both the
    native (PySide6) tray and the pystray fallback, while avoiding any PySide6
    import in this layer (PySide6 is installed only after the tk bootstrap).

    Dict schema: {separator: bool, text: str, action_signal: str, enabled: bool,
    children?: [...]} — `children` (same schema, recursive) renders as a submenu.
    Note: state (Code Sync / Auto-Start prefixes) and i18n are already baked into
    `text` via TrayMenuItem.get_display_text().
    """
    dicts: List[Dict[str, Any]] = []
    for item in items:
        # Separator sentinel uses text "---"
        if item is TrayMenuItem.SEPARATOR or item.text == "---":
            dicts.append({'separator': True})
            continue
        entry: Dict[str, Any] = {
            'separator': False,
            'text': item.get_display_text(),
            'action_signal': item.action_signal or "",
            'enabled': item.enabled,
        }
        if item.submenu:
            entry['children'] = tray_menu_to_dicts(item.submenu)
        dicts.append(entry)
    return dicts
