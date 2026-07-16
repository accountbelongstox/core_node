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

from pycore.pyutils.native_ui.step0_i18n import i18n


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


def build_appindicator_menu_items(menu_items: List[Any]) -> List[AppIndicatorMenuItem]:
    """
    Convert tray config menu items to AppIndicatorMenuItem list.

    Accepts TrayMenuItem (tkinter: text, action_signal) or dict (text_key/text, signal/action_signal).
    Uses i18n.get() for display text when item has i18n key.
    """
    result = []
    for item in menu_items:
        if getattr(item, 'text', None) == "---" or (isinstance(item, dict) and item.get('text_key') == '---'):
            result.append(AppIndicatorMenuItem(text="---", separator=True))
            continue
        if isinstance(item, dict):
            text_key = item.get('text_key') or item.get('text', '')
            text = i18n.get(text_key) if i18n and text_key else text_key
            signal = item.get('signal') or item.get('action_signal', '')
            submenu_data = item.get('submenu')
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
            text_raw = getattr(item, 'text', '') or getattr(item, 'text_key', '')
            text = i18n.get(text_raw) if i18n and text_raw and text_raw != "---" else text_raw
            signal = getattr(item, 'action_signal', None) or getattr(item, 'signal', '')
            submenu_raw = getattr(item, 'submenu', None)
            submenu = build_appindicator_menu_items(submenu_raw) if submenu_raw else None
            result.append(AppIndicatorMenuItem(
                text=text,
                callback=signal or None,
                enabled=getattr(item, 'enabled', True),
                checkable=getattr(item, 'checkable', False),
                checked=getattr(item, 'checked', False),
                submenu=submenu
            ))
    return result
