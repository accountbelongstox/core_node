#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Styles for D3-Check Application
Centralized styling system for consistent UI appearance.
docs/ui2 §4.3: Single style entry = UITheme only; COLORS merged from UITheme so panels read one palette.
"""

import tkinter as tk
from tkinter import ttk

from .theme import UITheme

# Keys only in UnifiedStyles (not in UITheme); COLORS = UITheme.COLORS + these (docs/ui2 §4.3)
_UNIFIED_EXTRA_COLORS = {
    'primary': '#2E3440',
    'primary_light': '#3B4252',
    'primary_dark': '#2E3440',
    'secondary': '#5E81AC',
    'secondary_light': '#81A1C1',
    'secondary_dark': '#4C566A',
    'accent_light': '#8FBCBB',
    'accent_dark': '#5E81AC',
    'text_muted': '#A3BE8C',
    'success': '#A3BE8C',
    'warning': '#EBCB8B',
    'error': '#BF616A',
    'info': '#5E81AC',
    'btn_warning': '#EBCB8B',
    'panel_bg': '#2E3440',
    'panel_header': '#3B4252',
    'tab_bg': '#3B4252',
    'tab_active': '#5E81AC',
    'tab_hover': '#4C566A',
    'tab_text': '#ECEFF4',
}


class UnifiedStyles:
    """Centralized styling system for D3-Check UI. ttk styles from UITheme only; COLORS from UITheme + extras."""

    # Single palette: UITheme first, then UnifiedStyles-only keys (docs/ui2 §4.3)
    COLORS = {**UITheme.COLORS, **_UNIFIED_EXTRA_COLORS}
    
    # Font Configuration (9px as minimum font size)
    FONTS = {
        'default': ('Segoe UI', 9),      # 9px as minimum font size
        'body': ('Segoe UI', 9),         # body text (same as label/small)
        'heading': ('Segoe UI', 9, 'bold'),  # 9px as minimum font size
        'subheading': ('Segoe UI', 9, 'bold'),  # 9px as minimum font size
        'bold': ('Segoe UI', 9, 'bold'), # 9px as minimum font size (bold style)
        'small': ('Segoe UI', 9),        # 9px as minimum font size
        'code': ('Consolas', 9),         # 9px as minimum font size
        'button': ('Segoe UI', 9, 'bold'),  # 9px as minimum font size
        'label': ('Segoe UI', 9),        # 9px as minimum font size
        'input': ('Segoe UI', 9),        # 9px as minimum font size
    }
    
    # Spacing Configuration - relaxed for readable layout (no crowding)
    SPACING = {
        'none': 0,
        'xs': 2,
        'sm': 5,
        'md': 10,
        'lg': 14,
        'xl': 18,
        'xxl': 24,
    }
    
    # Padding Configuration - comfortable padding for sections
    PADDING = {
        'none': 0,
        'xs': 3,
        'sm': 6,
        'md': 10,
        'lg': 14,
        'xl': 18,
        'xxl': 26,
    }

    # Tab content main style: same outer padding for all tab panels (reuse across TABLE1/TABLE2/ROSBOT/D4/Log/Coord).
    TAB_PAD = 8
    # One line of text height (for status bar extra row, etc.)
    LINE_HEIGHT = 20
    
    @classmethod
    def configure_ttk_styles(cls):
        """No-op: ttk styles are applied only by UITheme.apply_to_root (docs/ui2 §4.3 single style entry)."""
        pass
    
    @classmethod
    def create_styled_widget(cls, widget_class, parent, style_name=None, **kwargs):
        """Create a styled widget with consistent appearance"""
        if style_name:
            kwargs['style'] = style_name
        
        widget = widget_class(parent, **kwargs)
        
        # Apply common styling based on widget type
        if hasattr(widget, 'configure'):
            if isinstance(widget, tk.Label):
                widget.configure(
                    bg=cls.COLORS['bg_primary'],
                    fg=cls.COLORS['text_primary'],
                    font=cls.FONTS['label']
                )
            elif isinstance(widget, tk.Button):
                widget.configure(
                    bg=cls.COLORS['btn_primary'],
                    fg=cls.COLORS['text_primary'],
                    font=cls.FONTS['button'],
                    relief='flat',
                    bd=0,
                    padx=12,
                    pady=6
                )
            elif isinstance(widget, tk.Frame):
                widget.configure(bg=cls.COLORS['bg_primary'])
        
        return widget
    
    @classmethod
    def apply_hotkey_label_style(cls, label):
        """Apply special styling for hotkey labels to fix display issues"""
        label.configure(
            bg=cls.COLORS['bg_secondary'],      # Ensure background color
            fg=cls.COLORS['text_primary'],      # White text
            font=cls.FONTS['code'],             # Monospace font for hotkeys
            relief='solid',                     # Border for visibility
            bd=1,                              # Border width
            padx=8,                            # Horizontal padding
            pady=4                             # Vertical padding
        )
        return label
