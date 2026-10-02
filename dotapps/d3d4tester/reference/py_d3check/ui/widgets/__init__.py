#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# DOT-REF: none (not ported directly; see dotapps/d3d4tester/docs/PY_DOT_PORT_MAP.md)
"""
UI Widgets Module
Essential themed widgets for consistent UI appearance
"""

from .basic import (
    ThemedLabel,
    ThemedButton,
    ThemedFrame,
    ThemedLabelFrame,
    ThemedEntry,
    ThemedText,
    ThemedCheckbutton,
    ThemedCombobox,
    ThemedSpinbox,
    ThemedScrollbar
)

from .hotkey_input import HotkeyInput

# LanguageCombobox is now replaced by ConfigBinding.create_combobox_binding()

__all__ = [
    # Basic widgets
    "ThemedLabel",
    "ThemedButton",
    "ThemedFrame",
    "ThemedLabelFrame",
    "ThemedEntry",
    "ThemedText",
    "ThemedCheckbutton",
    "ThemedCombobox",
    "ThemedSpinbox",
    "ThemedScrollbar",

    # Specialized widgets
    "HotkeyInput",
    # "LanguageCombobox"  # Now replaced by ConfigBinding
]
