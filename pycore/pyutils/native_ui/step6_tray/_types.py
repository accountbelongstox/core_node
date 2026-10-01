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

from pycore.pyutils.native_ui.step1_config.tray_config import TrayMenuItem, tray_menu_from_dicts


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
    """Convert TrayMenuItem objects or canonical menu dicts to AppIndicatorMenuItem list."""
    result = []
    for item in menu_items:
        if isinstance(item, dict):
            item = tray_menu_from_dicts([item])[0]
        if item.is_separator():
            result.append(AppIndicatorMenuItem(text="---", separator=True))
            continue
        result.append(AppIndicatorMenuItem(
            text=item.get_display_text(),
            callback=item.action_signal or None,
            enabled=item.is_enabled(),
            checkable=item.checked is not None,
            checked=bool(item.checked),
            submenu=build_appindicator_menu_items(item.submenu) if item.submenu else None,
        ))
    return result
