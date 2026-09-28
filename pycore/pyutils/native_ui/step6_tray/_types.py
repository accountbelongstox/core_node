#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared types for step6_tray — extracted to break the circular import between
appindicator_system_tray and appindicator_thread.

This module has NO imports from sibling modules within step6_tray.
Imports go at file top.
"""

from typing import Optional, List, Callable, Any
from dataclasses import dataclass

from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n


@dataclass
class AppIndicatorMenuItem:
    """
    Menu item configuration for AppIndicator.

    Attributes:
        text: Menu item label (supports i18n keys)
        callback: Function to call when clicked
        icon_path: Optional icon path
        checkable: Whether item is checkable (toggle)
        checked: Initial checked state (if checkable)
        separator: True if this is a separator
        submenu: List of submenu items
        enabled: Whether item is enabled
    """
    text: str
    callback: Optional[Callable] = None
    icon_path: Optional[str] = None
    checkable: bool = False
    checked: bool = False
    separator: bool = False
    submenu: Optional[List['AppIndicatorMenuItem']] = None
    enabled: bool = True


def _apply_text_args(text: str, text_args: Optional[dict]) -> str:
    """Apply dynamic format args (e.g. port numbers) to a translated template."""
    if not text_args:
        return text
    try:
        return text.format(**text_args)
    except (KeyError, IndexError, ValueError):
        return text  # malformed template: show it untouched rather than crash the tray


def build_appindicator_menu_items(menu_items: List[Any]) -> List[AppIndicatorMenuItem]:
    """
    Convert tray config menu items to AppIndicatorMenuItem list.

    Accepts:
    - TrayMenuItem objects (tkinter backend): uses get_display_text() (i18n +
      text_args + state prefix) and is_enabled() (enabled_getter) when present.
    - Canonical dicts (tray_menu_to_dicts / tray.update_menu payload): keys
      separator/text/action_signal/enabled/children; `text` is ALREADY translated
      and formatted, so it is used as-is.
    - Raw config dicts: text_key (translated via i18n) + text_args, signal, submenu.
    """
    result = []
    for item in menu_items:
        if isinstance(item, dict):
            if item.get('separator') or item.get('text_key') == '---' or item.get('text') == '---':
                result.append(AppIndicatorMenuItem(text="---", separator=True))
                continue
            text_key = item.get('text_key')
            if text_key:
                text = i18n.get(text_key) if i18n else text_key
                text = _apply_text_args(text, item.get('text_args'))
            else:
                # Canonical dict: text is already translated/formatted display text.
                text = item.get('text', '')
            signal = item.get('signal') or item.get('action_signal', '')
            submenu_data = item.get('submenu') or item.get('children')
            submenu = build_appindicator_menu_items(submenu_data) if submenu_data else None
            result.append(AppIndicatorMenuItem(
                text=text,
                callback=signal or None,
                enabled=item.get('enabled', True),
                checkable=item.get('checkable', False),
                checked=item.get('checked', False),
                submenu=submenu
            ))
        else:
            if getattr(item, 'text', None) == "---":
                result.append(AppIndicatorMenuItem(text="---", separator=True))
                continue
            get_display_text = getattr(item, 'get_display_text', None)
            if callable(get_display_text):
                try:
                    text = get_display_text()
                except Exception:
                    text = getattr(item, 'text', '')
            else:
                text_raw = getattr(item, 'text', '') or getattr(item, 'text_key', '')
                text = i18n.get(text_raw) if i18n and text_raw else text_raw
                text = _apply_text_args(text, getattr(item, 'text_args', None))
            is_enabled = getattr(item, 'is_enabled', None)
            if callable(is_enabled):
                try:
                    enabled = bool(is_enabled())
                except Exception:
                    enabled = getattr(item, 'enabled', True)
            else:
                enabled = getattr(item, 'enabled', True)
            signal = getattr(item, 'action_signal', None) or getattr(item, 'signal', '')
            submenu_raw = getattr(item, 'submenu', None)
            submenu = build_appindicator_menu_items(submenu_raw) if submenu_raw else None
            result.append(AppIndicatorMenuItem(
                text=text,
                callback=signal or None,
                enabled=enabled,
                checkable=getattr(item, 'checkable', False),
                checked=getattr(item, 'checked', False) or False,
                submenu=submenu
            ))
    return result
