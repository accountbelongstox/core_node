#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Styles for D3-Check Application
Centralized styling system for consistent UI appearance
"""

import tkinter as tk
from tkinter import ttk

class UnifiedStyles:
    """Centralized styling system for D3-Check UI"""
    
    # Color Palette
    COLORS = {
        # Primary colors
        'primary': '#2E3440',           # Dark blue-gray
        'primary_light': '#3B4252',     # Lighter blue-gray
        'primary_dark': '#2E3440',      # Darker blue-gray
        
        # Secondary colors
        'secondary': '#5E81AC',         # Blue
        'secondary_light': '#81A1C1',   # Light blue
        'secondary_dark': '#4C566A',    # Dark gray-blue
        
        # Accent colors
        'accent': '#88C0D0',            # Cyan
        'accent_light': '#8FBCBB',      # Light cyan
        'accent_dark': '#5E81AC',       # Dark cyan
        
        # Background colors
        'bg_primary': '#2E3440',        # Main background
        'bg_secondary': '#3B4252',      # Secondary background
        'bg_tertiary': '#434C5E',       # Tertiary background
        'bg_light': '#4C566A',          # Light background
        
        # Text colors
        'text_primary': '#ECEFF4',      # Primary text (white)
        'text_secondary': '#D8DEE9',    # Secondary text (light gray)
        'text_muted': '#A3BE8C',        # Muted text (green)
        'text_accent': '#88C0D0',       # Accent text (cyan)
        
        # Status colors
        'success': '#A3BE8C',           # Green
        'warning': '#EBCB8B',           # Yellow
        'error': '#BF616A',             # Red
        'info': '#5E81AC',              # Blue
        
        # Button colors
        'btn_primary': '#5E81AC',       # Primary button
        'btn_secondary': '#4C566A',     # Secondary button
        'btn_success': '#A3BE8C',       # Success button
        'btn_warning': '#EBCB8B',       # Warning button
        'btn_danger': '#BF616A',        # Danger button
        
        # Input colors
        'input_bg': '#3B4252',          # Input background
        'input_border': '#4C566A',      # Input border
        'input_focus': '#5E81AC',       # Input focus border
        'input_text': '#ECEFF4',        # Input text
        
        # Panel colors
        'panel_bg': '#2E3440',          # Panel background
        'panel_border': '#4C566A',      # Panel border
        'panel_header': '#3B4252',      # Panel header
        
        # Tab colors
        'tab_bg': '#3B4252',            # Tab background
        'tab_active': '#5E81AC',        # Active tab
        'tab_hover': '#4C566A',         # Tab hover
        'tab_text': '#ECEFF4',          # Tab text
    }
    
    # Font Configuration (9px as minimum font size)
    FONTS = {
        'default': ('Segoe UI', 9),      # 9px as minimum font size
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
        """Configure TTK styles for consistent appearance"""
        style = ttk.Style()
        
        # Configure Notebook (Tab) styles - padding [L,T,R,B] equal top/bottom for same height
        style.configure('TNotebook',
                       background=cls.COLORS['bg_primary'],
                       borderwidth=0)
        
        style.configure('TNotebook.Tab',
                       background=cls.COLORS['tab_bg'],
                       foreground=cls.COLORS['text_primary'],
                       padding=[12, 8, 12, 8],
                       borderwidth=0,
                       focusthickness=0,
                       shiftrelief=0,
                       relief='flat',
                       font=cls.FONTS['button'])
        
        style.map('TNotebook.Tab',
                 background=[('selected', cls.COLORS['tab_active']),
                           ('active', cls.COLORS['tab_hover'])],
                 foreground=[('selected', cls.COLORS['text_primary']),
                           ('active', cls.COLORS['text_primary'])],
                 expand=[('selected', [0, 0, 0, 6]), ('!selected', [0, 0, 0, 0])])
        
        # Configure Frame styles
        style.configure('TFrame',
                       background=cls.COLORS['bg_primary'])
        
        style.configure('Card.TFrame',
                       background=cls.COLORS['bg_secondary'],
                       relief='solid',
                       borderwidth=1)
        
        # Configure Label styles
        style.configure('TLabel',
                       background=cls.COLORS['bg_primary'],
                       foreground=cls.COLORS['text_primary'],
                       font=cls.FONTS['label'])
        
        style.configure('Heading.TLabel',
                       background=cls.COLORS['bg_primary'],
                       foreground=cls.COLORS['text_primary'],
                       font=cls.FONTS['heading'])
        
        style.configure('Subheading.TLabel',
                       background=cls.COLORS['bg_primary'],
                       foreground=cls.COLORS['text_secondary'],
                       font=cls.FONTS['subheading'])
        
        style.configure('Muted.TLabel',
                       background=cls.COLORS['bg_primary'],
                       foreground=cls.COLORS['text_muted'],
                       font=cls.FONTS['small'])
        
        # Configure Button styles
        style.configure('TButton',
                       background=cls.COLORS['btn_primary'],
                       foreground=cls.COLORS['text_primary'],
                       font=cls.FONTS['button'],
                       padding=[12, 6],
                       relief='flat')
        
        style.map('TButton',
                 background=[('active', cls.COLORS['btn_secondary']),
                           ('pressed', cls.COLORS['primary_dark'])])
        
        style.configure('Success.TButton',
                       background=cls.COLORS['btn_success'])
        
        style.configure('Warning.TButton',
                       background=cls.COLORS['btn_warning'])
        
        style.configure('Danger.TButton',
                       background=cls.COLORS['btn_danger'])
        
        # Configure Entry styles
        style.configure('TEntry',
                       fieldbackground=cls.COLORS['input_bg'],
                       foreground=cls.COLORS['input_text'],
                       bordercolor=cls.COLORS['input_border'],
                       focuscolor=cls.COLORS['input_focus'],
                       font=cls.FONTS['input'])
        
        # Configure Combobox styles with high contrast
        style.configure('TCombobox',
                       fieldbackground=cls.COLORS['bg_primary'],      # Dark background
                       foreground=cls.COLORS['text_primary'],         # White text
                       bordercolor=cls.COLORS['accent'],              # Bright border
                       focuscolor=cls.COLORS['primary'],              # Focus color
                       selectbackground=cls.COLORS['accent'],         # Selection background
                       selectforeground=cls.COLORS['bg_primary'],     # Selection text
                       arrowcolor=cls.COLORS['text_primary'],         # White arrow
                       font=cls.FONTS['input'],
                       relief='solid',
                       borderwidth=2)

        # Configure Combobox state mappings for better visibility
        style.map('TCombobox',
                 fieldbackground=[('readonly', cls.COLORS['bg_primary']),
                                ('focus', cls.COLORS['bg_secondary']),
                                ('active', cls.COLORS['bg_secondary'])],
                 foreground=[('readonly', cls.COLORS['text_primary']),
                           ('focus', cls.COLORS['text_primary']),
                           ('active', cls.COLORS['text_primary'])],
                 bordercolor=[('focus', cls.COLORS['primary']),
                            ('active', cls.COLORS['primary'])],
                 selectbackground=[('focus', cls.COLORS['accent'])],
                 selectforeground=[('focus', cls.COLORS['bg_primary'])])
        
        # Configure LabelFrame styles
        style.configure('TLabelframe',
                       background=cls.COLORS['bg_secondary'],
                       foreground=cls.COLORS['text_primary'],
                       bordercolor=cls.COLORS['panel_border'],
                       font=cls.FONTS['subheading'])
        
        style.configure('TLabelframe.Label',
                       background=cls.COLORS['bg_secondary'],
                       foreground=cls.COLORS['text_primary'],
                       font=cls.FONTS['subheading'])
        
        return style
    
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
