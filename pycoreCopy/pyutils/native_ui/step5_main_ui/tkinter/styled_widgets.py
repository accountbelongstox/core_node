#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Styled Widgets Factory for Tkinter

Provides factory functions for creating themed tkinter widgets
with consistent styling from ThemeSystem.

Features:
- Pre-styled widgets (Label, Button, Frame, Entry, etc.)
- Multiple button types (primary, secondary, success, warning, danger)
- Automatic theme application
- Hover effects support
- Easy customization

Usage:
    from pycore.pyutils.native_ui.tkinter import StyledWidgets
    import tkinter as tk

    root = tk.Tk()

    # Create styled button
    btn = StyledWidgets.create_button(
        root,
        text="Click Me",
        command=my_function,
        button_type='primary'
    )

    # Create styled label
    label = StyledWidgets.create_label(
        root,
        text="Hello World",
        font_type='heading'
    )

    # Create styled frame
    frame = StyledWidgets.create_frame(
        root,
        bg_color='bg_secondary'
    )

Author: Extracted from d3-check, generalized for pycore
"""

from typing import Optional, Callable

from pycore.pyfoundations.third_party import get_third_package_tkinter
from pycore.pyutils.native_ui.step5_main_ui.tkinter.theme_system import ThemeSystem

# Get tkinter via third_party manager (auto-installs python3-tk on Linux)
tk = get_third_package_tkinter()
ttk = tk.ttk


class StyledWidgets:
    """
    Factory class for creating styled tkinter widgets

    All widgets are automatically styled using the current ThemeSystem theme.
    """

    @staticmethod
    def create_label(
        parent,
        text: str = "",
        font_type: str = 'default',
        fg_color: str = 'text_primary',
        bg_color: str = 'bg_primary',
        **kwargs
    ) -> tk.Label:
        """
        Create a styled label

        Args:
            parent: Parent widget
            text: Label text
            font_type: Font type from ThemeSystem
            fg_color: Foreground color name
            bg_color: Background color name
            **kwargs: Additional tk.Label arguments

        Returns:
            Configured tk.Label widget
        """
        return tk.Label(
            parent,
            text=text,
            font=ThemeSystem.get_font(font_type),
            fg=ThemeSystem.get_color(fg_color),
            bg=ThemeSystem.get_color(bg_color),
            **kwargs
        )

    @staticmethod
    def create_button(
        parent,
        text: str = "",
        command: Optional[Callable] = None,
        button_type: str = 'primary',
        width: Optional[int] = None,
        height: Optional[int] = None,
        **kwargs
    ) -> tk.Button:
        """
        Create a styled button

        Args:
            parent: Parent widget
            text: Button text
            command: Callback function
            button_type: Button type ('primary', 'secondary', 'success', 'warning', 'danger')
            width: Button width (uses theme default if None)
            height: Button height (uses theme default if None)
            **kwargs: Additional tk.Button arguments

        Returns:
            Configured tk.Button widget
        """
        width = width or ThemeSystem.get_size('button_width')
        height = height or ThemeSystem.get_size('button_height')

        # Button type to color mapping
        color_map = {
            'primary': ('btn_primary', 'btn_primary_hover'),
            'secondary': ('btn_secondary', 'btn_secondary_hover'),
            'success': ('btn_success', 'btn_success_hover'),
            'warning': ('btn_warning', 'btn_warning_hover'),
            'danger': ('btn_danger', 'btn_danger_hover'),
        }

        bg_color, hover_color = color_map.get(button_type, color_map['primary'])

        button = tk.Button(
            parent,
            text=text,
            command=command,
            font=ThemeSystem.get_font('button'),
            bg=ThemeSystem.get_color(bg_color),
            fg=ThemeSystem.get_color('text_primary'),
            activebackground=ThemeSystem.get_color(hover_color),
            activeforeground=ThemeSystem.get_color('text_primary'),
            relief=tk.RAISED,
            bd=ThemeSystem.get_size('border_width'),
            width=width,
            height=height,
            **kwargs
        )

        return button

    @staticmethod
    def create_frame(
        parent,
        bg_color: str = 'bg_primary',
        relief: str = tk.FLAT,
        border_width: Optional[int] = None,
        **kwargs
    ) -> tk.Frame:
        """
        Create a styled frame

        Args:
            parent: Parent widget
            bg_color: Background color name
            relief: Frame relief style
            border_width: Border width (uses theme default if None)
            **kwargs: Additional tk.Frame arguments

        Returns:
            Configured tk.Frame widget
        """
        bd = border_width if border_width is not None else 0

        return tk.Frame(
            parent,
            bg=ThemeSystem.get_color(bg_color),
            relief=relief,
            bd=bd,
            **kwargs
        )

    @staticmethod
    def create_entry(
        parent,
        width: Optional[int] = None,
        font_type: str = 'input',
        **kwargs
    ) -> tk.Entry:
        """
        Create a styled entry widget

        Args:
            parent: Parent widget
            width: Entry width (uses theme default if None)
            font_type: Font type from ThemeSystem
            **kwargs: Additional tk.Entry arguments

        Returns:
            Configured tk.Entry widget
        """
        width = width or ThemeSystem.get_size('input_width')

        return tk.Entry(
            parent,
            font=ThemeSystem.get_font(font_type),
            bg=ThemeSystem.get_color('input_bg'),
            fg=ThemeSystem.get_color('input_text'),
            insertbackground=ThemeSystem.get_color('text_primary'),
            relief=tk.FLAT,
            bd=ThemeSystem.get_size('border_width'),
            width=width,
            **kwargs
        )

    @staticmethod
    def create_text(
        parent,
        width: Optional[int] = None,
        height: Optional[int] = None,
        font_type: str = 'default',
        wrap: str = tk.WORD,
        **kwargs
    ) -> tk.Text:
        """
        Create a styled text widget

        Args:
            parent: Parent widget
            width: Text width
            height: Text height
            font_type: Font type from ThemeSystem
            wrap: Text wrap mode
            **kwargs: Additional tk.Text arguments

        Returns:
            Configured tk.Text widget
        """
        return tk.Text(
            parent,
            font=ThemeSystem.get_font(font_type),
            bg=ThemeSystem.get_color('input_bg'),
            fg=ThemeSystem.get_color('input_text'),
            insertbackground=ThemeSystem.get_color('text_primary'),
            relief=tk.FLAT,
            bd=ThemeSystem.get_size('border_width'),
            wrap=wrap,
            width=width,
            height=height,
            **kwargs
        )

    @staticmethod
    def create_checkbutton(
        parent,
        text: str = "",
        variable: Optional[tk.Variable] = None,
        command: Optional[Callable] = None,
        **kwargs
    ) -> tk.Checkbutton:
        """
        Create a styled checkbutton

        Args:
            parent: Parent widget
            text: Checkbutton text
            variable: tk.Variable for state
            command: Callback function
            **kwargs: Additional tk.Checkbutton arguments

        Returns:
            Configured tk.Checkbutton widget
        """
        return tk.Checkbutton(
            parent,
            text=text,
            variable=variable,
            command=command,
            font=ThemeSystem.get_font('default'),
            bg=ThemeSystem.get_color('bg_primary'),
            fg=ThemeSystem.get_color('text_primary'),
            activebackground=ThemeSystem.get_color('bg_hover'),
            activeforeground=ThemeSystem.get_color('text_primary'),
            selectcolor=ThemeSystem.get_color('btn_primary'),
            **kwargs
        )

    @staticmethod
    def create_separator(
        parent,
        orient: str = tk.HORIZONTAL,
        color: str = 'border_subtle',
        **kwargs
    ) -> tk.Frame:
        """
        Create a styled separator line

        Args:
            parent: Parent widget
            orient: Orientation (tk.HORIZONTAL or tk.VERTICAL)
            color: Separator color name
            **kwargs: Additional tk.Frame arguments

        Returns:
            Configured tk.Frame widget as separator
        """
        if orient == tk.HORIZONTAL:
            return tk.Frame(
                parent,
                height=1,
                bg=ThemeSystem.get_color(color),
                **kwargs
            )
        else:
            return tk.Frame(
                parent,
                width=1,
                bg=ThemeSystem.get_color(color),
                **kwargs
            )

    @staticmethod
    def create_labelframe(
        parent,
        text: str = "",
        bg_color: str = 'bg_primary',
        fg_color: str = 'text_primary',
        font_type: str = 'subheading',
        **kwargs
    ) -> tk.LabelFrame:
        """
        Create a styled labelframe

        Args:
            parent: Parent widget
            text: Frame label text
            bg_color: Background color name
            fg_color: Foreground color name
            font_type: Font type from ThemeSystem
            **kwargs: Additional tk.LabelFrame arguments

        Returns:
            Configured tk.LabelFrame widget
        """
        return tk.LabelFrame(
            parent,
            text=text,
            font=ThemeSystem.get_font(font_type),
            bg=ThemeSystem.get_color(bg_color),
            fg=ThemeSystem.get_color(fg_color),
            bd=ThemeSystem.get_size('border_width'),
            **kwargs
        )


# Export
__all__ = ['StyledWidgets']
