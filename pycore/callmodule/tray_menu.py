# -*- coding: utf-8 -*-
"""
Tray Menu Builder for Pycore Module Caller

Builds tray menu items with dynamic state getters.
This module only defines menu structure, does not start any threads.
"""

import platform
from typing import Any, Dict, List

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem

import pycore.callmodule.platform.system_service_manager as ssm
from pycore.callmodule.tray_codesync_cache import get_tray_codesync_state



IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'

# Signal prefix for tray language switching; one event per language code is
# emitted as f"{TRAY_SET_LANGUAGE_SIGNAL}.{code}" (handlers registered in
# event_handlers.py from the same supported-languages list).
TRAY_SET_LANGUAGE_SIGNAL = "tray_action_set_language"
TRAY_TOGGLE_CODE_SYNC_DISTRIBUTE_SIGNAL = "tray_action_toggle_code_sync_distribute"
TRAY_TOGGLE_CODE_SYNC_SKIP_UPDATE_SIGNAL = "tray_action_toggle_code_sync_skip_update"


def build_code_sync_submenu() -> List[TrayMenuItem]:
    """
    Code Sync toggles backed by the same CodeSyncManager singleton as the UI API.

    Distribute applies only on dev role; skip-update applies only on client role.
    State getters read the THREAD_BUS cache only (never @serialized_method on the
    tray message thread). TrayCodeSyncCacheThread keeps the cache fresh.
    """

    def get_distribute_state():
        try:
            state = get_tray_codesync_state()
            return "[X]" if state.get("distributing") else "[ ]"
        except Exception:
            return "[ ]"

    def get_skip_update_state():
        try:
            state = get_tray_codesync_state()
            return "[X]" if state.get("skip_update") else "[ ]"
        except Exception:
            return "[ ]"

    def distribute_enabled():
        try:
            return get_tray_codesync_state().get("role") == "dev"
        except Exception:
            return False

    def skip_update_enabled():
        try:
            state = get_tray_codesync_state()
            return state.get("role") == "client" and not state.get("light")
        except Exception:
            return False

    return [
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_CODE_SYNC_DISTRIBUTE,
            action_signal=TRAY_TOGGLE_CODE_SYNC_DISTRIBUTE_SIGNAL,
            state_getter=get_distribute_state,
            enabled_getter=distribute_enabled,
        ),
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_CODE_SYNC_SKIP_UPDATE,
            action_signal=TRAY_TOGGLE_CODE_SYNC_SKIP_UPDATE_SIGNAL,
            state_getter=get_skip_update_state,
            enabled_getter=skip_update_enabled,
        ),
    ]


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
    # State getter for Voice Subtitle window visibility (published by the UI framework)
    def get_voice_subtitle_state():
        """Get current Voice Subtitle window visibility state"""
        visible = THREAD_BUS.get_signal('voice_subtitle_ui.window_visible', False)
        return "[X]" if visible else "[ ]"

    # State getter for the Linux system-service toggle: reflects whether the
    # `pycore` system unit is enabled (start on boot). Lazy import keeps this
    # menu-structure module free of subprocess deps at import time.
    def get_service_toggle_state():
        try:
            if not IS_LINUX:
                return "[ ]"
            return "[X]" if ssm.pycore_service_enabled() else "[ ]"
        except Exception:
            return "[ ]"

    # Define menu items. Every text is an i18n key; get_display_text() translates
    # it per the current language at render time (the Win32 backend rebuilds the
    # menu on each right-click, so language switches apply live).
    menu_items = [
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_OPEN_WEB,
            action_signal="tray_action_open",
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
            state_getter=get_voice_subtitle_state,
            default=True,
        ),
        TrayMenuItem(
            text=I18nKeys.TRAY_MENU_CODE_SYNC,
            action_signal="",
            submenu=build_code_sync_submenu(),
        ),
    ])

    # Linux only: toggle installing pycore (+ the dashboard UI) as systemd system
    # services so they start on boot. ON installs BOTH units; OFF removes ONLY the
    # pycore unit and leaves the UI unit running (with a printed removal command).
    # The auto-start-on-boot toggle itself lives in the pycore-manager UI
    # (Settings -> Startup) backed by /api/manage/control/autostart.
    if IS_LINUX:
        menu_items.append(
            TrayMenuItem(
                text=I18nKeys.TRAY_MENU_SERVICE_TOGGLE,
                action_signal="tray_action_toggle_service",
                state_getter=get_service_toggle_state,
            )
        )

    menu_items.extend([
        # Auto-start on boot now lives in the pycore-manager UI (Settings ->
        # Startup), not the tray. The GET/POST /api/manage/control/autostart API
        # backs that toggle.
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
    Note: state ([X]/[ ] prefixes, e.g. PyCore UI visibility and the language
    radio items) and i18n are already baked into `text` via
    TrayMenuItem.get_display_text().
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
            'enabled': item.is_enabled(),
        }
        if item.submenu:
            entry['children'] = tray_menu_to_dicts(item.submenu)
        dicts.append(entry)
    return dicts

import json
import hashlib
from pycore.callmodule.callmodule_config.config import Config as CallmoduleConfig

_TRAY_MENU_SIGNATURE = {'value': None}

def _menu_signature(menu_items: list) -> str:
    """Create a stable signature for tray menu payloads."""
    try:
        from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
        state = THREAD_BUS.get_signal("tray.codesync.state")
        if not isinstance(state, dict):
            state = {}
        payload = {
            "menu": menu_items,
            "codesync": state,
        }
        encoded = json.dumps(
            payload,
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
        return hashlib.md5(encoded).hexdigest()
    except Exception:
        return hashlib.md5(str(menu_items).encode("utf-8")).hexdigest()

def update_tray_menu_with_singleton(launcher, port: int, singleton_port: int):
    """
    Update tray menu with singleton port info.

    Emits a 'tray.update_menu' event (canonical dict menu) that the native Qt
    tray (PySide6 framework) listens for and rebuilds in the Qt main thread.

    Args:
        launcher: ServiceLauncher instance (unused; kept for call-site compatibility)
        port: RPC v2 server port
        singleton_port: Singleton port
    """
    from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
    from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
    menu = build_tray_menu(port=port, singleton_port=singleton_port)
    if CallmoduleConfig.UI_ENABLE_TRAY:
        payload = tray_menu_to_dicts(menu)
    else:
        payload = menu

    signature = _menu_signature(payload)
    THREAD_BUS.signal(
        'tray.menu.payload',
        {
            'menu_items': payload,
            'signature': signature,
            'backend_pyside': CallmoduleConfig.UI_ENABLE_TRAY,
        }
    )

    if _TRAY_MENU_SIGNATURE['value'] == signature:
        ColorPrint.blue("[ConfigBuilder] Tray menu unchanged; skip menu update event")
        return

    _TRAY_MENU_SIGNATURE['value'] = signature

    THREAD_BUS.trigger_event('tray.update_menu', {'menu_items': payload})
    ColorPrint.blue("[ConfigBuilder] Tray menu update requested via THREAD_BUS")
