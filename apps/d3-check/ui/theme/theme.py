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

    # Color definitions
    COLORS = {
        # Background colors
        'bg_primary': '#1a1a2e',      # Main background
        'bg_secondary': '#16213e',     # Secondary background
        'bg_tertiary': '#0f3460',      # Tertiary background
        'bg_dark': '#0a0a0a',          # Dark background
        'bg_input': '#2a2a3e',         # Input field background
        'bg_input_dark': '#1a1a2e',     # Dark input field background

        # Text colors
        'text_primary': '#e0e0e0',     # Primary text (light gray - high contrast)
        'text_secondary': '#00d4ff',   # Secondary text (cyan)
        'text_accent': '#ff6b6b',      # Accent text (red)
        'text_success': '#00ff88',     # Success text (green)
        'text_warning': '#ff9800',     # Warning text (orange)

        # Button colors
        'btn_primary': '#4CAF50',      # Primary button (green)
        'btn_primary_hover': '#45a049',
        'btn_secondary': '#f44336',    # Secondary button (red)
        'btn_secondary_hover': '#da190b',
        'btn_accent': '#ff9800',       # Accent button (orange)
        'btn_accent_hover': '#f57c00',
        'btn_info': '#2196F3',         # Info button (blue)
        'btn_info_hover': '#1976D2',

        # UI component colors
        'tab_selected_bg': '#2196F3',   # Tab selected background (blue)
        'tab_selected_fg': '#e0e0e0',   # Tab selected foreground (light gray)
        'combobox_bg': '#f0f0f0',       # Combobox background (light gray)
        'combobox_fg': '#1a1a1a',       # Combobox foreground (dark gray - high contrast)
        'combobox_arrow': '#1a1a1a',    # Combobox arrow color (dark gray)
        
        # Tab colors - multiple variants to force override
        'tab_unselected_bg': '#f0f0f0',  # Tab unselected background (light gray)
        'tab_unselected_fg': '#1a1a1a',  # Tab unselected foreground (dark gray)
        'tab_hover_bg': '#e0e0e0',       # Tab hover background (lighter gray)
        'tab_hover_fg': '#000000',       # Tab hover foreground (black)
        'tab_active_bg': '#d0d0d0',      # Tab active background (medium gray)
        'tab_active_fg': '#000000',      # Tab active foreground (black)
        
        # Test colors for high contrast
        'test_high_contrast': '#00ff00', # High contrast green for testing

        # Border and decoration
        'border_primary': '#00d4ff',   # Primary border
        'border_secondary': '#ff6b6b', # Secondary border
        'separator': '#2a2a3e',        # Separator line
    }

    # Font definitions
    FONTS = {
        'title': ('Arial', 14, 'bold'),
        'subtitle': ('Arial', 12, 'bold'),
        'heading': ('Arial', 11, 'bold'),
        'subheading': ('Arial', 10, 'bold'),
        'body': ('Arial', 9),
        'button': ('Arial', 9, 'bold'),
        'code': ('Consolas', 9),
    }

    # Size definitions
    SIZES = {
        'padding_small': 5,
        'padding_medium': 10,
        'padding_large': 15,
        'border_width': 2,
        'button_width': 8,
        'input_width': 10,
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
    def apply_ttk_style(cls, style: ttk.Style):
        """
        Apply theme to ttk widgets

        Args:
            style: ttk.Style instance to configure
        """
        # Configure Notebook style
        style.configure('TNotebook',
                       background=cls.get_color('bg_primary'),
                       borderwidth=0,
                       tabmargins=[2, 5, 2, 0])

        style.configure('TNotebook.Tab',
                       background=cls.get_color('bg_secondary'),
                       foreground=cls.get_color('text_primary'),
                       padding=[20, 10],
                       font=cls.get_font('button'))

        style.map('TNotebook.Tab',
                 background=[('selected', cls.get_color('bg_tertiary')),
                           ('active', cls.get_color('bg_input'))],
                 foreground=[('selected', cls.get_color('text_secondary')),
                           ('active', cls.get_color('text_accent'))])

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

        # Configure Button style
        style.configure('TButton',
                       background=cls.get_color('btn_primary'),
                       foreground=cls.get_color('text_primary'),
                       font=cls.get_font('button'),
                       padding=[10, 5])

        style.map('TButton',
                 background=[('active', cls.get_color('btn_primary_hover')),
                           ('pressed', '#3d8b40')])

        # Configure Entry style
        style.configure('TEntry',
                       fieldbackground=cls.get_color('bg_input'),
                       foreground=cls.get_color('text_primary'),
                       insertcolor=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

        # Configure Combobox style
        style.configure('TCombobox',
                       fieldbackground=cls.get_color('bg_input'),
                       foreground=cls.get_color('text_primary'),
                       insertcolor=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

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
                       fieldbackground=cls.get_color('bg_input'),
                       foreground=cls.get_color('text_primary'),
                       insertcolor=cls.get_color('text_primary'),
                       font=cls.get_font('body'))

        # Configure Progressbar style
        style.configure('TProgressbar',
                       background=cls.get_color('btn_primary'),
                       troughcolor=cls.get_color('bg_input'),
                       borderwidth=0,
                       lightcolor=cls.get_color('btn_primary'),
                       darkcolor=cls.get_color('btn_primary'))

    @classmethod
    def apply_to_root(cls, root: tk.Tk):
        """
        Apply theme to root window

        Args:
            root: Root Tk window
        """
        try:
            root.configure(bg=cls.get_color('bg_dark'))
        except tk.TclError:
            # Some Tkinter versions don't support bg option
            pass

        # Apply ttk theme
        style = ttk.Style()
        cls.apply_ttk_style(style)
