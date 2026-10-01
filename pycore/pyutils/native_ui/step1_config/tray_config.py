#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tray types shared by every tray backend (pystray, Win32, AppIndicator, PySide6 bridge).

Menu items emit their ``action_signal`` through THREAD_BUS; ``text`` is an i18n
key (or literal text) translated when the menu is rendered.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n

SEPARATOR_TEXT = "---"
TRAY_EVENT_SOURCE = "tray_menu"
CHECKED_PREFIX = "[X]"
UNCHECKED_PREFIX = "[ ]"


class TrayBackend(Enum):
    """System tray backend."""
    PYSTRAY = "pystray"
    PYSIDE6 = "pyside6"
    APPINDICATOR = "appindicator"
    NONE = "none"


@dataclass
class TrayMenuItem:
    """One tray menu entry.

    text: i18n key or literal text; text_args formats the translated template.
    checked: None = no checkbox, True/False = checked prefix.
    state_getter / enabled_getter: dynamic prefix text / enabled state.
    """
    text: str
    action_signal: str
    icon_name: Optional[str] = None
    enabled: bool = True
    default: bool = False
    submenu: Optional[List["TrayMenuItem"]] = None
    checked: Optional[bool] = None
    state_getter: Optional[Callable] = None
    enabled_getter: Optional[Callable] = None
    text_args: Optional[dict] = None

    SEPARATOR = None

    def is_separator(self) -> bool:
        return self.text == SEPARATOR_TEXT

    def is_enabled(self) -> bool:
        if self.enabled_getter is not None:
            return bool(self.enabled_getter())
        return self.enabled

    def get_display_text(self) -> str:
        """Translated text with text_args applied and the state/checked prefix."""
        text = i18n.get(self.text) if self.text else self.text
        if self.text_args:
            try:
                text = text.format(**self.text_args)
            except (KeyError, IndexError, ValueError) as exc:
                ColorPrint.yellow(f"[TrayMenuItem] format failed key={self.text} args={self.text_args}: {exc}")
        if self.state_getter:
            state_text = self.state_getter()
            return f"{state_text} {text}" if state_text else text
        if self.checked is None:
            return text
        return f"{CHECKED_PREFIX if self.checked else UNCHECKED_PREFIX} {text}"


TrayMenuItem.SEPARATOR = TrayMenuItem(text=SEPARATOR_TEXT, action_signal="", enabled=False)


@dataclass
class TrayConfig:
    """Tray configuration stored in THREAD_BUS (BusKeys.TRAY_CONFIG)."""
    enabled: bool = True
    app_name: str = ""
    icon_path: Optional[str] = None
    menu_items: List[TrayMenuItem] = field(default_factory=list)


def create_default_tray_menu() -> List[TrayMenuItem]:
    """Show / Restart / Exit menu emitting BusSignals.TRAY_SHOW / TRAY_RESTART / TRAY_EXIT."""
    return [
        TrayMenuItem(text=I18nKeys.TRAY_MENU_SHOW, action_signal=BusSignals.TRAY_SHOW, default=True),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(text=I18nKeys.TRAY_MENU_RESTART, action_signal=BusSignals.TRAY_RESTART),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(text=I18nKeys.TRAY_MENU_EXIT, action_signal=BusSignals.TRAY_EXIT),
    ]


def create_window_tray_menu(
    app_name: str,
    enable_show_hide: bool = True,
    enable_maximize: bool = True,
    enable_restart: bool = False,
) -> List[TrayMenuItem]:
    """Main-window menu emitting window.show/hide/maximize/minimize/restore, app.restart and app.close."""
    items: List[TrayMenuItem] = []
    if enable_show_hide:
        items += [
            TrayMenuItem(text=I18nKeys.TRAY_MENU_SHOW, action_signal="window.show", default=True),
            TrayMenuItem(text=I18nKeys.TRAY_MENU_HIDE, action_signal="window.hide"),
            TrayMenuItem.SEPARATOR,
        ]
    if enable_maximize:
        items += [
            TrayMenuItem(text=I18nKeys.TRAY_MENU_MAXIMIZE, action_signal="window.maximize"),
            TrayMenuItem(text=I18nKeys.TRAY_MENU_MINIMIZE, action_signal="window.minimize"),
            TrayMenuItem(text=I18nKeys.TRAY_MENU_RESTORE, action_signal="window.restore"),
            TrayMenuItem.SEPARATOR,
        ]
    if enable_restart:
        items += [TrayMenuItem(text=I18nKeys.TRAY_MENU_RESTART, action_signal="app.restart"), TrayMenuItem.SEPARATOR]
    items.append(TrayMenuItem(text=I18nKeys.TRAY_MENU_EXIT_APP, action_signal="app.close", text_args={"app_name": app_name}))
    return items


def tray_menu_from_dicts(items: List[Dict[str, Any]]) -> List[TrayMenuItem]:
    """Convert canonical menu dicts {separator, text, action_signal, enabled, children, callback}.

    A ``callback`` without ``action_signal`` gets a derived ``tray_action_<text>``
    signal with the callback registered as its THREAD_BUS handler.
    """
    result: List[TrayMenuItem] = []
    for item in items:
        text = item.get("text", "")
        if item.get("separator") or text == SEPARATOR_TEXT:
            result.append(TrayMenuItem.SEPARATOR)
            continue
        signal = item.get("action_signal") or ""
        callback = item.get("callback")
        if callback and not signal:
            signal = f"tray_action_{text.lower().replace(' ', '_')}"
            THREAD_BUS.register_event_handler(signal, lambda event_data, cb=callback: cb())
        children = item.get("children")
        result.append(TrayMenuItem(
            text=text,
            action_signal=signal,
            enabled=item.get("enabled", True),
            submenu=tray_menu_from_dicts(children) if children else None,
        ))
    return result
