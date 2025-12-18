#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tkinter Native UI Components Package

Provides themed widgets and styling system for Tkinter applications.

Modules:
    - theme_system: Centralized theme configuration (colors, fonts, sizes)
    - styled_widgets: Factory functions for creating styled tkinter widgets

Usage:
    from pycore.pyutils.native_ui.tkinter import (
        ThemeSystem,
        StyledWidgets
    )

    # Get theme colors and fonts
    bg_color = ThemeSystem.get_color('bg_primary')
    font = ThemeSystem.get_font('heading')

    # Create styled widgets
    button = StyledWidgets.create_button(
        parent,
        text="Click Me",
        button_type='primary'
    )

    label = StyledWidgets.create_label(
        parent,
        text="Hello World",
        font_type='heading'
    )
"""

from pycore.pyutils.native_ui.step5_main_ui.tkinter.theme_system import ThemeSystem
from pycore.pyutils.native_ui.step5_main_ui.tkinter.styled_widgets import StyledWidgets

__all__ = [
    'ThemeSystem',
    'StyledWidgets',
]
