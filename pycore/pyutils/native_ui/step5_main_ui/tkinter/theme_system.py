#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Theme System for Tkinter Applications

Provides centralized theme configuration including colors, fonts,
sizes, and spacing for consistent UI appearance.

Features:
- Pre-defined dark and light themes
- Customizable color palettes
- Font configuration with size presets
- Spacing and padding standards
- Easy theme switching
- Custom theme support

Usage:
    from pycore.pyutils.native_ui.tkinter import ThemeSystem

    # Use default dark theme
    bg_color = ThemeSystem.get_color('bg_primary')
    text_color = ThemeSystem.get_color('text_primary')
    font = ThemeSystem.get_font('heading')

    # Switch to light theme
    ThemeSystem.set_theme('light')

    # Create custom theme
    custom_colors = {
        'bg_primary': '#ffffff',
        'text_primary': '#000000'
    }
    ThemeSystem.register_custom_theme('my_theme', colors=custom_colors)
    ThemeSystem.set_theme('my_theme')

Author: Extracted from d3-check, generalized for pycore
"""

from typing import Dict, Tuple, Optional, Any


class ThemeSystem:
    """
    Centralized theme system for Tkinter applications

    Manages colors, fonts, sizes, and spacing with support for
    multiple themes and custom theme registration.
    """

    # Current active theme
    _current_theme = 'dark'

    # Built-in themes
    _THEMES: Dict[str, Dict[str, Any]] = {}

    # ============================================
    # Dark Theme (Default)
    # ============================================
    _THEMES['dark'] = {
        'colors': {
            # Background colors
            'bg_primary': '#2E3440',
            'bg_secondary': '#3B4252',
            'bg_tertiary': '#434C5E',
            'bg_light': '#4C566A',
            'bg_hover': '#3B4252',

            # Text colors
            'text_primary': '#ECEFF4',
            'text_secondary': '#D8DEE9',
            'text_muted': '#A3BE8C',
            'text_accent': '#88C0D0',
            'text_dark': '#2E3440',

            # Status colors
            'success': '#A3BE8C',
            'warning': '#EBCB8B',
            'error': '#BF616A',
            'info': '#5E81AC',

            # Button colors
            'btn_primary': '#5E81AC',
            'btn_primary_hover': '#81A1C1',
            'btn_secondary': '#4C566A',
            'btn_secondary_hover': '#434C5E',
            'btn_success': '#A3BE8C',
            'btn_success_hover': '#8FBCBB',
            'btn_warning': '#EBCB8B',
            'btn_warning_hover': '#D08770',
            'btn_danger': '#BF616A',
            'btn_danger_hover': '#D08770',

            # Input colors
            'input_bg': '#3B4252',
            'input_text': '#ECEFF4',
            'input_border': '#4C566A',
            'input_focus': '#5E81AC',

            # Border colors
            'border_primary': '#4C566A',
            'border_accent': '#5E81AC',
            'border_subtle': '#3B4252',

            # Panel colors
            'panel_bg': '#2E3440',
            'panel_border': '#4C566A',
            'panel_header': '#3B4252',

            # Tab colors
            'tab_bg': '#3B4252',
            'tab_active': '#5E81AC',
            'tab_hover': '#4C566A',
            'tab_text': '#ECEFF4',
        },
        'fonts': {
            'default': ('Segoe UI', 9),
            'heading': ('Segoe UI', 10, 'bold'),
            'subheading': ('Segoe UI', 9, 'bold'),
            'bold': ('Segoe UI', 9, 'bold'),
            'small': ('Segoe UI', 8),
            'code': ('Consolas', 9),
            'button': ('Segoe UI', 9, 'bold'),
            'label': ('Segoe UI', 9),
            'input': ('Segoe UI', 9),
        },
        'sizes': {
            'padding_xs': 2,
            'padding_sm': 4,
            'padding_md': 8,
            'padding_lg': 12,
            'padding_xl': 16,
            'border_width': 1,
            'button_width': 10,
            'button_height': 2,
            'input_width': 20,
        },
        'spacing': {
            'none': 0,
            'xs': 2,
            'sm': 4,
            'md': 8,
            'lg': 12,
            'xl': 16,
            'xxl': 24,
        }
    }

    # ============================================
    # Light Theme
    # ============================================
    _THEMES['light'] = {
        'colors': {
            # Background colors
            'bg_primary': '#FFFFFF',
            'bg_secondary': '#F5F5F5',
            'bg_tertiary': '#E8E8E8',
            'bg_light': '#FAFAFA',
            'bg_hover': '#F0F0F0',

            # Text colors
            'text_primary': '#2E3440',
            'text_secondary': '#4C566A',
            'text_muted': '#81A1C1',
            'text_accent': '#5E81AC',
            'text_dark': '#2E3440',

            # Status colors
            'success': '#4CAF50',
            'warning': '#FFA726',
            'error': '#EF5350',
            'info': '#42A5F5',

            # Button colors
            'btn_primary': '#2196F3',
            'btn_primary_hover': '#1976D2',
            'btn_secondary': '#9E9E9E',
            'btn_secondary_hover': '#757575',
            'btn_success': '#4CAF50',
            'btn_success_hover': '#388E3C',
            'btn_warning': '#FFA726',
            'btn_warning_hover': '#F57C00',
            'btn_danger': '#EF5350',
            'btn_danger_hover': '#D32F2F',

            # Input colors
            'input_bg': '#FFFFFF',
            'input_text': '#2E3440',
            'input_border': '#BDBDBD',
            'input_focus': '#2196F3',

            # Border colors
            'border_primary': '#E0E0E0',
            'border_accent': '#2196F3',
            'border_subtle': '#F5F5F5',

            # Panel colors
            'panel_bg': '#FFFFFF',
            'panel_border': '#E0E0E0',
            'panel_header': '#F5F5F5',

            # Tab colors
            'tab_bg': '#F5F5F5',
            'tab_active': '#2196F3',
            'tab_hover': '#E8E8E8',
            'tab_text': '#2E3440',
        },
        'fonts': _THEMES['dark']['fonts'].copy(),
        'sizes': _THEMES['dark']['sizes'].copy(),
        'spacing': _THEMES['dark']['spacing'].copy(),
    }

    @classmethod
    def get_color(cls, color_name: str, fallback: str = '#000000') -> str:
        """
        Get color value from current theme

        Args:
            color_name: Color name from theme colors
            fallback: Fallback color if name not found

        Returns:
            Color hex code
        """
        theme = cls._THEMES.get(cls._current_theme, cls._THEMES['dark'])
        return theme['colors'].get(color_name, fallback)

    @classmethod
    def get_font(cls, font_name: str = 'default') -> Tuple:
        """
        Get font tuple from current theme

        Args:
            font_name: Font name from theme fonts

        Returns:
            Font tuple (family, size, [style])
        """
        theme = cls._THEMES.get(cls._current_theme, cls._THEMES['dark'])
        return theme['fonts'].get(font_name, ('Segoe UI', 9))

    @classmethod
    def get_size(cls, size_name: str, fallback: int = 8) -> int:
        """
        Get size value from current theme

        Args:
            size_name: Size name from theme sizes
            fallback: Fallback size if name not found

        Returns:
            Size value in pixels
        """
        theme = cls._THEMES.get(cls._current_theme, cls._THEMES['dark'])
        return theme['sizes'].get(size_name, fallback)

    @classmethod
    def get_spacing(cls, spacing_name: str, fallback: int = 8) -> int:
        """
        Get spacing value from current theme

        Args:
            spacing_name: Spacing name from theme spacing
            fallback: Fallback spacing if name not found

        Returns:
            Spacing value in pixels
        """
        theme = cls._THEMES.get(cls._current_theme, cls._THEMES['dark'])
        return theme['spacing'].get(spacing_name, fallback)

    @classmethod
    def set_theme(cls, theme_name: str) -> bool:
        """
        Switch to a different theme

        Args:
            theme_name: Theme name ('dark', 'light', or custom theme name)

        Returns:
            True if theme exists and was set, False otherwise
        """
        if theme_name in cls._THEMES:
            cls._current_theme = theme_name
            return True
        return False

    @classmethod
    def get_current_theme(cls) -> str:
        """Get current active theme name"""
        return cls._current_theme

    @classmethod
    def get_available_themes(cls) -> list:
        """Get list of available theme names"""
        return list(cls._THEMES.keys())

    @classmethod
    def register_custom_theme(
        cls,
        theme_name: str,
        colors: Optional[Dict[str, str]] = None,
        fonts: Optional[Dict[str, Tuple]] = None,
        sizes: Optional[Dict[str, int]] = None,
        spacing: Optional[Dict[str, int]] = None,
        base_theme: str = 'dark'
    ):
        """
        Register a custom theme

        Args:
            theme_name: Name for the custom theme
            colors: Custom color definitions (merged with base theme)
            fonts: Custom font definitions (merged with base theme)
            sizes: Custom size definitions (merged with base theme)
            spacing: Custom spacing definitions (merged with base theme)
            base_theme: Base theme to extend ('dark' or 'light')
        """
        base = cls._THEMES.get(base_theme, cls._THEMES['dark'])

        custom_theme = {
            'colors': base['colors'].copy(),
            'fonts': base['fonts'].copy(),
            'sizes': base['sizes'].copy(),
            'spacing': base['spacing'].copy(),
        }

        if colors:
            custom_theme['colors'].update(colors)
        if fonts:
            custom_theme['fonts'].update(fonts)
        if sizes:
            custom_theme['sizes'].update(sizes)
        if spacing:
            custom_theme['spacing'].update(spacing)

        cls._THEMES[theme_name] = custom_theme

    @classmethod
    def get_theme_config(cls, theme_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get complete theme configuration

        Args:
            theme_name: Theme name (uses current theme if None)

        Returns:
            Complete theme configuration dictionary
        """
        theme = theme_name or cls._current_theme
        return cls._THEMES.get(theme, cls._THEMES['dark']).copy()


# Export
__all__ = ['ThemeSystem']
