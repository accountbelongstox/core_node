#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Theme Definitions
Centralized theme configuration for colors, fonts, and sizes
"""

import tkinter as tk
from tkinter import ttk
from typing import Dict, Any


class UITheme:
    """UI Theme configuration class - contains only theme definitions"""

    # Color definitions - Organized by component and state
    COLORS = {
        # ============ Background Colors ============
        'bg_primary': '#1a1a2e',        # Main dark background
        'bg_secondary': '#16213e',      # Secondary dark background
        'bg_tertiary': '#0f3460',       # Tertiary dark background
        'bg_dark': '#0a0a0a',           # Darkest background
        'bg_light': '#f0f0f0',          # Light background (for contrast elements)
        'bg_hover': '#2a2a3e',          # Hover state background

        # ============ Text Colors ============
        'text_primary': '#e0e0e0',      # Primary light text
        'text_secondary': '#00d4ff',    # Secondary cyan text
        'text_tertiary': '#a0a0a0',     # Muted gray text
        'text_dark': '#1a1a1a',         # Dark text (for light backgrounds)
        'text_accent': '#ff6b6b',       # Accent red text
        'text_success': '#00ff88',      # Success green text
        'text_warning': '#ff9800',      # Warning orange text
        'text_error': '#ff4444',        # Error red text

        # ============ Interactive States ============
        'state_normal': '#16213e',      # Normal state
        'state_hover': '#0f3460',       # Hover state
        'state_active': '#2196F3',      # Active/Selected state
        'state_focus': '#00d4ff',       # Focus state
        'state_disabled': '#2a2a3e',    # Disabled state

        # ============ Button Colors ============
        'btn_primary': '#4CAF50',       # Primary green button
        'btn_primary_hover': '#45a049',
        'btn_secondary': '#f44336',     # Secondary red button
        'btn_secondary_hover': '#da190b',
        'btn_success': '#00ff88',       # Success button (docs/ui2 §4.3 merge)
        'btn_danger': '#ff4444',        # Danger button (docs/ui2 §4.3 merge)
        'btn_accent': '#ff9800',        # Accent orange button
        'btn_accent_hover': '#f57c00',
        'btn_info': '#2196F3',          # Info blue button
        'btn_info_hover': '#1976D2',

        # ============ Input/Form Elements ============
        'input_bg': '#2a2a3e',          # Input background
        'input_text': '#e0e0e0',        # Input text color
        'input_border': '#00d4ff',      # Input border
        'input_focus': '#2196F3',       # Input focus border

        # ============ Border & Decoration ============
        'border_primary': '#00d4ff',    # Primary border
        'border_secondary': '#ff6b6b',  # Secondary border
        'border_subtle': '#2a2a3e',     # Subtle border
        'separator': '#2a2a3e',         # Separator line
        'panel_border': '#4C566A',      # Panel border (docs/ui2 §4.3 merge)

        # ============ Tab (Notebook) - high contrast unselected ============
        'tab_unselected_bg': '#4C566A',     # Unselected tab bg (distinct from content)
        'tab_unselected_fg': '#ECEFF4',    # Unselected tab text (high contrast)
        'tab_selected_bg': '#16213e',      # Selected tab bg
        'tab_selected_fg': '#e0e0e0',      # Selected tab text

        # ============ Accent Colors ============
        'accent': '#00d4ff',            # Default accent (docs/ui2 §4.3 merge; alias cyan)
        'accent_blue': '#2196F3',       # Blue accent
        'accent_cyan': '#00d4ff',       # Cyan accent
        'accent_red': '#ff6b6b',        # Red accent
        'accent_orange': '#ff9800',     # Orange accent
        'accent_green': '#00ff88',      # Green accent
    }

    # Font definitions (9px as minimum font size)
    FONTS = {
        'title': ('Arial', 9, 'bold'),      # 9px as minimum font size
        'subtitle': ('Arial', 9, 'bold'),   # 9px as minimum font size
        'heading': ('Arial', 9, 'bold'),    # 9px as minimum font size
        'subheading': ('Arial', 9, 'bold'), # 9px as minimum font size
        'body': ('Arial', 9),               # 9px as minimum font size
        'button': ('Arial', 9, 'bold'),     # 9px as minimum font size
        'code': ('Consolas', 9),            # 9px as minimum font size
    }

    # Size definitions (scaled to 60% of original sizes)
    SIZES = {
        'padding_small': 3,      # 5 * 0.6 = 3
        'padding_medium': 6,     # 10 * 0.6 = 6
        'padding_large': 9,      # 15 * 0.6 = 9
        'border_width': 1,       # 2 * 0.6 = 1.2 -> 1
        'button_width': 5,       # 8 * 0.6 = 4.8 -> 5
        'input_width': 6,        # 10 * 0.6 = 6
    }

    @classmethod
    def get_color(cls, color_name: str) -> str:
        """
        Get color value by name

        Args:
            color_name: Color name from COLORS dict

        Returns:
            Color hex code, defaults to white if not found
        """
        return cls.COLORS.get(color_name, '#e0e0e0')

    @classmethod
    def get_font(cls, font_name: str) -> tuple:
        """
        Get font configuration by name

        Args:
            font_name: Font name from FONTS dict

        Returns:
            Font tuple (family, size, style), defaults to Arial 9
        """
        return cls.FONTS.get(font_name, ('Arial', 9))

    @classmethod
    def get_size(cls, size_name: str) -> int:
        """
        Get size value by name

        Args:
            size_name: Size name from SIZES dict

        Returns:
            Size value in pixels, defaults to 10
        """
        return cls.SIZES.get(size_name, 10)

    @classmethod
    def _delayed_apply_ttk_style(cls, root: tk.Tk):
        """
        Delayed ttk style application after main loop starts

        Args:
            root: Root Tk window
        """
        if root is None or not root.winfo_exists():
            return
        style = ttk.Style(root)
        cls.apply_ttk_style(style)
        print("[Theme] Successfully applied ttk style (delayed)")

    @classmethod
    def apply_ttk_style(cls, style: ttk.Style):
        """
        Apply theme to ttk widgets

        Args:
            style: ttk.Style instance to configure
        """
        # Force use 'clam' theme to override system defaults. Call only with valid style.
        current = style.theme_use()
        if current != 'clam':
            style.theme_use('clam')
            print(f"[Theme] Switched from '{current}' to 'clam' in apply_ttk_style")

        # Configure Notebook style (scaled to 60%); tabmargins bottom=1 to align with Dark.TNotebook
        style.configure('TNotebook',
                       background=cls.get_color('bg_primary'),
                       borderwidth=0,
                       tabmargins=[1, 3, 1, 1])

        # Configure Tab style - unselected: high contrast; padding [L,T,R,B] equal top/bottom for same height
        style.configure('TNotebook.Tab',
                       background=cls.get_color('tab_unselected_bg'),
                       foreground=cls.get_color('tab_unselected_fg'),
                       bordercolor=cls.get_color('tab_unselected_bg'),
                       lightcolor=cls.get_color('tab_unselected_bg'),
                       darkcolor=cls.get_color('tab_unselected_bg'),
                       padding=[12, 6, 12, 6],
                       borderwidth=0,
                       focusthickness=0,
                       focuscolor=cls.get_color('tab_unselected_bg'),
                       shiftrelief=0,
                       relief='flat',
                       font=cls.get_font('button'))

        # map(): selected expand [0,0,0,6] so selected tab same height as unselected (clam default gap)
        style.map('TNotebook.Tab',
                 background=[('selected', cls.get_color('tab_selected_bg')),
                           ('active', cls.get_color('state_hover')),
                           ('!selected', cls.get_color('tab_unselected_bg'))],
                 foreground=[('selected', cls.get_color('tab_selected_fg')),
                           ('active', cls.get_color('text_primary')),
                           ('!selected', cls.get_color('tab_unselected_fg'))],
                 bordercolor=[('selected', cls.get_color('tab_selected_bg')),
                            ('active', cls.get_color('state_hover')),
                            ('!selected', cls.get_color('tab_unselected_bg'))],
                 lightcolor=[('selected', cls.get_color('tab_selected_bg')),
                           ('active', cls.get_color('state_hover')),
                           ('!selected', cls.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', cls.get_color('tab_selected_bg')),
                          ('active', cls.get_color('state_hover')),
                          ('!selected', cls.get_color('tab_unselected_bg'))],
                 expand=[('selected', [0, 0, 0, 6]), ('!selected', [0, 0, 0, 0])])

        # Configure Frame style
        style.configure('TFrame', background=cls.get_color('bg_primary'))

        # Configure LabelFrame style
        style.configure('TLabelframe',
                       background=cls.get_color('bg_primary'),
                       foreground=cls.get_color('text_secondary'),
                       font=cls.get_font('heading'))

        style.configure('TLabelframe.Label',
                       background=cls.get_color('bg_primary'),
                       foreground=cls.get_color('text_secondary'),
                       font=cls.get_font('heading'))

        # Configure Button style (scaled to 60%)
        style.configure('TButton',
                       background=cls.get_color('btn_primary'),
                       foreground=cls.get_color('text_primary'),
                       font=cls.get_font('button'),
                       padding=[6, 3])  # [10,5] * 0.6 = [6,3]

        style.map('TButton',
                 background=[('active', cls.get_color('btn_primary_hover')),
                           ('pressed', '#3d8b40')])

        # Configure Entry style
        style.configure('TEntry',
                       fieldbackground=cls.get_color('input_bg'),
                       foreground=cls.get_color('text_primary'),
                       insertcolor=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

        # Configure Combobox style (configure + map so readonly/focus/active use theme colors on all platforms)
        _input_bg = cls.get_color('input_bg')
        _input_fg = cls.get_color('text_primary')
        style.configure('TCombobox',
                       fieldbackground=_input_bg,
                       foreground=_input_fg,
                       insertcolor=_input_fg,
                       font=cls.get_font('body'))
        style.map('TCombobox',
                 fieldbackground=[('readonly', _input_bg), ('focus', _input_bg), ('active', _input_bg)],
                 foreground=[('readonly', _input_fg), ('focus', _input_fg), ('active', _input_fg)])

        # Configure Checkbutton style
        style.configure('TCheckbutton',
                       background=cls.get_color('bg_primary'),
                       foreground=cls.get_color('text_primary'),
                       font=cls.get_font('body'),
                       focuscolor='none')

        # Configure Label style
        style.configure('TLabel',
                       background=cls.get_color('bg_primary'),
                       foreground=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

        # Configure Spinbox style
        style.configure('TSpinbox',
                       fieldbackground=cls.get_color('input_bg'),
                       foreground=cls.get_color('text_primary'),
                       insertcolor=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

        # Configure Progressbar style
        style.configure('TProgressbar',
                       background=cls.get_color('btn_primary'),
                       troughcolor=cls.get_color('input_bg'),
                       borderwidth=0,
                       lightcolor=cls.get_color('btn_primary'),
                       darkcolor=cls.get_color('btn_primary'))

        # Dark.TNotebook / Dark.TFrame / Dark.TNotebook.Tab (single place for main window notebook)
        cls._apply_dark_notebook_layout(style)
        style.configure('Dark.TNotebook',
                       background=cls.get_color('bg_primary'),
                       borderwidth=0,
                       tabmargins=[1, 3, 1, 0])
        style.configure('Dark.TFrame',
                       background=cls.get_color('bg_primary'),
                       borderwidth=0)
        style.configure('Dark.TNotebook.Tab',
                       background=cls.get_color('tab_unselected_bg'),
                       foreground=cls.get_color('tab_unselected_fg'),
                       padding=[12, 8, 12, 8],
                       borderwidth=0,
                       lightcolor=cls.get_color('tab_unselected_bg'),
                       darkcolor=cls.get_color('tab_unselected_bg'),
                       bordercolor=cls.get_color('tab_unselected_bg'),
                       focusthickness=0,
                       focuscolor=cls.get_color('tab_unselected_bg'),
                       shiftrelief=0,
                       relief='flat')
        style.map('Dark.TNotebook.Tab',
                 background=[('selected', cls.get_color('tab_selected_bg')),
                             ('active', cls.get_color('state_hover')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 foreground=[('selected', cls.get_color('tab_selected_fg')),
                             ('active', cls.get_color('text_primary')),
                             ('!selected', cls.get_color('tab_unselected_fg'))],
                 lightcolor=[('selected', cls.get_color('tab_selected_bg')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', cls.get_color('tab_selected_bg')),
                           ('!selected', cls.get_color('tab_unselected_bg'))],
                 bordercolor=[('selected', cls.get_color('tab_selected_bg')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                 expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])

    @classmethod
    def _apply_dark_notebook_layout(cls, style: ttk.Style):
        """Apply Dark.TNotebook.Tab layout (no Notebook.focus wrapper). Single place for main window."""
        style.layout(
            'Dark.TNotebook.Tab',
            [
                (
                    'Notebook.tab',
                    {
                        'sticky': 'nswe',
                        'children': [
                            (
                                'Notebook.padding',
                                {
                                    'side': 'top',
                                    'sticky': 'nswe',
                                    'children': [
                                        ('Notebook.label', {'side': 'top', 'sticky': ''}),
                                    ],
                                },
                            ),
                        ],
                    },
                ),
            ],
        )

    @classmethod
    def refresh_dark_notebook(cls, style: ttk.Style):
        """Re-apply Dark.TNotebook styles (for force update after map). Call from UI when needed."""
        cls._apply_dark_notebook_layout(style)
        style.configure('Dark.TNotebook', tabmargins=[1, 3, 1, 0])
        style.configure('Dark.TNotebook.Tab',
                       background=cls.get_color('tab_unselected_bg'),
                       foreground=cls.get_color('tab_unselected_fg'),
                       padding=[12, 8, 12, 8],
                       borderwidth=0,
                       lightcolor=cls.get_color('tab_unselected_bg'),
                       darkcolor=cls.get_color('tab_unselected_bg'),
                       bordercolor=cls.get_color('tab_unselected_bg'),
                       focusthickness=0,
                       focuscolor=cls.get_color('tab_unselected_bg'),
                       shiftrelief=0,
                       relief='flat')
        style.map('Dark.TNotebook.Tab',
                 background=[('selected', cls.get_color('tab_selected_bg')),
                             ('active', cls.get_color('state_hover')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 foreground=[('selected', cls.get_color('tab_selected_fg')),
                             ('active', cls.get_color('text_primary')),
                             ('!selected', cls.get_color('tab_unselected_fg'))],
                 lightcolor=[('selected', cls.get_color('tab_selected_bg')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', cls.get_color('tab_selected_bg')),
                           ('!selected', cls.get_color('tab_unselected_bg'))],
                 bordercolor=[('selected', cls.get_color('tab_selected_bg')),
                             ('!selected', cls.get_color('tab_unselected_bg'))],
                 padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                 expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])

    @classmethod
    def apply_to_root(cls, root: tk.Tk):
        """
        Apply theme to root window. Single entry: sets bg, theme_use('clam'), and all ttk styles (including Dark.TNotebook).
        No update_idletasks here (docs/ui2): layout/paint deferred until window fully built and deiconify.
        """
        root.configure(bg=cls.get_color('bg_dark'))
        if not root.winfo_exists():
            return
        style = ttk.Style(root)
        current_theme = style.theme_use()
        if current_theme in ('vista', 'xpnative', 'winnative') or current_theme != 'clam':
            style.theme_use('clam')
        cls.apply_ttk_style(style)
        # No update_idletasks here (docs/ui2): defer layout/paint until window fully built and deiconify
