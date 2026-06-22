#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Basic Themed Widgets
Provides themed versions of standard tkinter widgets
"""

import tkinter as tk
from tkinter import ttk
from typing import Optional
from ..theme import UITheme


class ThemedLabel:
    """Factory for creating themed labels"""

    @staticmethod
    def create(parent, text: str = "", font_type: str = 'body',
              fg_color: str = 'text_primary', bg_color: str = 'bg_primary',
              **kwargs) -> tk.Label:
        """
        Create a themed label

        Args:
            parent: Parent widget
            text: Label text
            font_type: Font type from UITheme.FONTS
            fg_color: Foreground color from UITheme.COLORS
            bg_color: Background color from UITheme.COLORS
            **kwargs: Additional tk.Label arguments

        Returns:
            Configured tk.Label widget
        """
        return tk.Label(
            parent,
            text=text,
            font=UITheme.get_font(font_type),
            fg=UITheme.get_color(fg_color),
            bg=UITheme.get_color(bg_color),
            **kwargs
        )


class ThemedButton:
    """Factory for creating themed buttons"""

    @staticmethod
    def create(parent, text: str = "", command=None, button_type: str = 'primary',
              width: Optional[int] = None, **kwargs) -> tk.Button:
        """
        Create a themed button

        Args:
            parent: Parent widget
            text: Button text
            command: Callback function
            button_type: Button type ('primary', 'secondary', 'accent', 'info')
            width: Button width
            **kwargs: Additional tk.Button arguments

        Returns:
            Configured tk.Button widget
        """
        width = width or UITheme.get_size('button_width')

        color_map = {
            'primary': ('btn_primary', 'btn_primary_hover'),
            'secondary': ('btn_secondary', 'btn_secondary_hover'),
            'accent': ('btn_accent', 'btn_accent_hover'),
            'info': ('btn_info', 'btn_info_hover'),
        }

        bg_color, hover_color = color_map.get(button_type, color_map['primary'])

        return tk.Button(
            parent,
            text=text,
            command=command,
            font=UITheme.get_font('button'),
            bg=UITheme.get_color(bg_color),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=UITheme.get_size('border_width'),
            activebackground=UITheme.get_color(hover_color),
            activeforeground=UITheme.get_color('text_primary'),
            width=width,
            **kwargs
        )


class ThemedFrame:
    """Factory for creating themed frames"""

    @staticmethod
    def create(parent, bg_color: str = 'bg_primary', relief: str = tk.FLAT,
              bd: int = 0, **kwargs) -> tk.Frame:
        """
        Create a themed frame

        Args:
            parent: Parent widget
            bg_color: Background color from UITheme.COLORS
            relief: Frame relief style
            bd: Border width
            **kwargs: Additional tk.Frame arguments

        Returns:
            Configured tk.Frame widget
        """
        return tk.Frame(
            parent,
            bg=UITheme.get_color(bg_color),
            relief=relief,
            bd=bd,
            **kwargs
        )


class ThemedLabelFrame:
    """Factory for creating themed label frames"""

    @staticmethod
    def create(parent, text: str = "", bg_color: str = 'bg_secondary',
              fg_color: str = 'text_secondary', font_type: str = 'subtitle',
              relief: str = tk.RAISED, bd: int = 2, **kwargs) -> tk.LabelFrame:
        """
        Create a themed label frame

        Args:
            parent: Parent widget
            text: Frame label text
            bg_color: Background color from UITheme.COLORS
            fg_color: Foreground color from UITheme.COLORS
            font_type: Font type from UITheme.FONTS
            relief: Frame relief style
            bd: Border width
            **kwargs: Additional tk.LabelFrame arguments

        Returns:
            Configured tk.LabelFrame widget
        """
        return tk.LabelFrame(
            parent,
            text=text,
            font=UITheme.get_font(font_type),
            fg=UITheme.get_color(fg_color),
            bg=UITheme.get_color(bg_color),
            relief=relief,
            bd=bd,
            **kwargs
        )


class ThemedEntry:
    """Factory for creating themed entry widgets"""

    @staticmethod
    def create(parent, textvariable=None, width: Optional[int] = None,
              font_type: str = 'body', **kwargs) -> tk.Entry:
        """
        Create a themed entry widget

        Args:
            parent: Parent widget
            textvariable: tk.StringVar for entry value
            width: Entry width
            font_type: Font type from UITheme.FONTS
            **kwargs: Additional tk.Entry arguments

        Returns:
            Configured tk.Entry widget
        """
        width = width or UITheme.get_size('input_width')
        # Let kwargs override theme; pop to avoid duplicate keyword for tk.Entry (callers may pass bg/fg/font)
        bg = kwargs.pop('bg', None) or UITheme.get_color('input_bg')
        fg = kwargs.pop('fg', None) or UITheme.get_color('text_primary')
        font = kwargs.pop('font', None) or UITheme.get_font(font_type)
        insertbackground = kwargs.pop('insertbackground', None) or UITheme.get_color('text_primary')

        return tk.Entry(
            parent,
            textvariable=textvariable,
            width=width,
            font=font,
            bg=bg,
            fg=fg,
            insertbackground=insertbackground,
            relief=tk.SUNKEN,
            bd=1,
            **kwargs
        )


class ThemedSpinbox:
    """Factory for creating themed spinbox widgets"""

    @staticmethod
    def create(parent, from_=0, to=100, increment=1, textvariable=None,
              width: Optional[int] = None, font_type: str = 'body',
              bg_color: str = 'input_bg', **kwargs) -> tk.Spinbox:
        """
        Create a themed spinbox widget

        Args:
            parent: Parent widget
            from_: Minimum value
            to: Maximum value
            increment: Increment step
            textvariable: tk.StringVar for spinbox value
            width: Spinbox width
            font_type: Font type from UITheme.FONTS
            bg_color: Background color from UITheme.COLORS
            **kwargs: Additional tk.Spinbox arguments

        Returns:
            Configured tk.Spinbox widget
        """
        width = width or UITheme.get_size('input_width')
        # Omit theme keys from kwargs so themed values are not duplicated (avoids "multiple values for keyword argument 'bg'")
        theme_keys = ('bg', 'fg', 'font', 'insertbackground')
        extra = {k: v for k, v in kwargs.items() if k not in theme_keys}

        return tk.Spinbox(
            parent,
            from_=from_,
            to=to,
            increment=increment,
            textvariable=textvariable,
            width=width,
            font=UITheme.get_font(font_type),
            bg=UITheme.get_color(bg_color),
            fg=UITheme.get_color('text_primary'),
            insertbackground=UITheme.get_color('text_primary'),
            relief=tk.SUNKEN,
            bd=1,
            **extra
        )


class ThemedText:
    """Factory for creating themed text widgets"""

    @staticmethod
    def create(parent, height: int = 10, width: int = 50, font_type: str = 'code',
              wrap: str = tk.WORD, **kwargs) -> tk.Text:
        """
        Create a themed text widget

        Args:
            parent: Parent widget
            height: Widget height
            width: Widget width
            font_type: Font type from UITheme.FONTS
            wrap: Text wrapping mode
            **kwargs: Additional tk.Text arguments

        Returns:
            Configured tk.Text widget
        """
        return tk.Text(
            parent,
            height=height,
            width=width,
            wrap=wrap,
            font=UITheme.get_font(font_type),
            bg=UITheme.get_color('input_bg'),
            fg=UITheme.get_color('text_primary'),
            insertbackground=UITheme.get_color('text_primary'),
            relief=tk.SUNKEN,
            bd=1,
            **kwargs
        )


class ThemedCheckbutton:
    """Factory for creating themed checkbuttons"""

    @staticmethod
    def create(parent, text: str = "", variable=None, font_type: str = 'body',
              fg_color: str = 'text_primary', bg_color: str = 'bg_primary',
              select_color: str = 'text_secondary', **kwargs) -> tk.Checkbutton:
        """
        Create a themed checkbutton

        Args:
            parent: Parent widget
            text: Checkbutton text
            variable: tk.BooleanVar for checkbutton state
            font_type: Font type from UITheme.FONTS
            fg_color: Foreground color from UITheme.COLORS
            bg_color: Background color from UITheme.COLORS
            select_color: Selection color from UITheme.COLORS
            **kwargs: Additional tk.Checkbutton arguments

        Returns:
            Configured tk.Checkbutton widget
        """
        return tk.Checkbutton(
            parent,
            text=text,
            variable=variable,
            font=UITheme.get_font(font_type),
            fg=UITheme.get_color(fg_color),
            bg=UITheme.get_color(bg_color),
            selectcolor=UITheme.get_color(select_color),
            activebackground=UITheme.get_color(bg_color),
            activeforeground=UITheme.get_color(select_color),
            **kwargs
        )


class ThemedCombobox:
    """Factory for creating themed comboboxes"""

    @staticmethod
    def create(parent, textvariable=None, values=None, width: Optional[int] = None,
              font_type: str = 'body', **kwargs) -> ttk.Combobox:
        """
        Create a themed combobox

        Args:
            parent: Parent widget
            textvariable: tk.StringVar for combobox value
            values: List of combobox options
            width: Combobox width
            font_type: Font type from UITheme.FONTS
            **kwargs: Additional ttk.Combobox arguments

        Returns:
            Configured ttk.Combobox widget
        """
        width = width or UITheme.get_size('input_width')

        combobox = ttk.Combobox(
            parent,
            textvariable=textvariable,
            values=values or [],
            width=width,
            font=UITheme.get_font(font_type),
            **kwargs
        )
        
        # Apply themed style to ttk.Combobox
        style = ttk.Style()
        style.configure('Themed.TCombobox',
                       fieldbackground=UITheme.get_color('input_bg'),
                       background=UITheme.get_color('input_bg'),
                       foreground=UITheme.get_color('text_primary'),
                       arrowcolor=UITheme.get_color('text_primary'),
                       borderwidth=1,
                       relief='solid')
        style.map('Themed.TCombobox',
                 fieldbackground=[('readonly', UITheme.get_color('input_bg')),
                                ('active', UITheme.get_color('input_bg')),
                                ('focus', UITheme.get_color('input_bg'))],
                 background=[('readonly', UITheme.get_color('input_bg')),
                           ('active', UITheme.get_color('input_bg')),
                           ('focus', UITheme.get_color('input_bg'))],
                 foreground=[('readonly', UITheme.get_color('text_primary')),
                           ('active', UITheme.get_color('text_primary')),
                           ('focus', UITheme.get_color('text_primary'))])
        
        combobox.configure(style='Themed.TCombobox')
        return combobox


class ThemedScrollbar:
    """Factory for creating themed scrollbars"""

    @staticmethod
    def create(parent, orient: str = 'vertical', command=None, **kwargs) -> tk.Scrollbar:
        """
        Create a themed scrollbar

        Args:
            parent: Parent widget
            orient: Scrollbar orientation ('vertical' or 'horizontal')
            command: Scroll command callback
            **kwargs: Additional tk.Scrollbar arguments

        Returns:
            Configured tk.Scrollbar widget
        """
        return tk.Scrollbar(
            parent,
            orient=orient,
            command=command,
            bg=UITheme.get_color('bg_secondary'),
            troughcolor=UITheme.get_color('bg_primary'),
            activebackground=UITheme.get_color('text_accent'),
            **kwargs
        )


# Compatibility wrapper for legacy code
class ThemedWidgets:
    """
    Compatibility wrapper for legacy code that uses ThemedWidgets.create_*() pattern

    This class provides the old API while delegating to the new factory classes.
    New code should use the specific factory classes directly (ThemedLabel.create(), etc.)
    """

    @staticmethod
    def create_label(*args, **kwargs):
        """Create themed label - delegates to ThemedLabel.create()"""
        return ThemedLabel.create(*args, **kwargs)

    @staticmethod
    def create_button(*args, **kwargs):
        """Create themed button - delegates to ThemedButton.create()"""
        return ThemedButton.create(*args, **kwargs)

    @staticmethod
    def create_frame(*args, **kwargs):
        """Create themed frame - delegates to ThemedFrame.create()"""
        return ThemedFrame.create(*args, **kwargs)

    @staticmethod
    def create_label_frame(*args, **kwargs):
        """Create themed label frame - delegates to ThemedLabelFrame.create()"""
        return ThemedLabelFrame.create(*args, **kwargs)

    @staticmethod
    def create_entry(*args, **kwargs):
        """Create themed entry - delegates to ThemedEntry.create()"""
        return ThemedEntry.create(*args, **kwargs)

    @staticmethod
    def create_text(*args, **kwargs):
        """Create themed text - delegates to ThemedText.create()"""
        return ThemedText.create(*args, **kwargs)

    @staticmethod
    def create_checkbutton(*args, **kwargs):
        """Create themed checkbutton - delegates to ThemedCheckbutton.create()"""
        return ThemedCheckbutton.create(*args, **kwargs)

    @staticmethod
    def create_combobox(*args, **kwargs):
        """Create themed combobox - delegates to ThemedCombobox.create()"""
        return ThemedCombobox.create(*args, **kwargs)

    @staticmethod
    def create_scrollbar(*args, **kwargs):
        """Create themed scrollbar - delegates to ThemedScrollbar.create()"""
        return ThemedScrollbar.create(*args, **kwargs)
