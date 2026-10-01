#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Title Bar Styles - Configurable Style System

Default title bar style plus per-key overrides.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from copy import deepcopy


@dataclass
class TitleBarStyles:
    """Complete title bar style configuration."""

    # ========== Bar ==========
    bar_height: int = 40
    bar_bg_color: str = "#1a1a2e"
    bar_use_gradient: bool = True
    bar_gradient_colors: list = field(default_factory=lambda: ["#1a1a2e", "#16213e", "#0f1419"])
    bar_border_bottom: str = "1px solid rgba(255, 255, 255, 0.1)"
    bar_padding_left: int = 12
    bar_padding_right: int = 8
    bar_spacing: int = 0

    # ========== Logo ==========
    logo_size: int = 28
    logo_border_radius: int = 4
    logo_padding: int = 2
    logo_spacing_right: int = 10
    logo_background: str = "transparent"

    # ========== Title text ==========
    title_font_size: str = "11pt"
    title_font_weight: int = 600
    title_font_family: str = "'Microsoft YaHei UI', 'Segoe UI', sans-serif"
    title_color: str = "#ffffff"
    title_text_shadow: str = "0 1px 2px rgba(0, 0, 0, 0.3)"
    title_padding: str = "0 8px"

    # ========== Menu button ==========
    menu_icon: str = "\u2630"
    menu_hover_color: str = "#4a5568"
    menu_pressed_color: str = "#2d3748"

    # ========== Window control buttons ==========
    button_width: int = 48
    button_height: int = 40
    button_border_radius: int = 8
    button_font_size: str = "16px"
    button_font_weight: int = 600
    button_margin: str = "4px"
    button_normal_bg: str = "transparent"

    # ========== Minimize button ==========
    minimize_icon: str = "\u2212"
    minimize_hover_color: str = "#4a5568"
    minimize_pressed_color: str = "#2d3748"

    # ========== Maximize / restore button ==========
    maximize_icon: str = "\u25a1"
    maximize_icon_restore: str = "\u2750"
    maximize_hover_color: str = "#4a5568"
    maximize_pressed_color: str = "#2d3748"

    # ========== Close button ==========
    close_icon: str = "\u2715"
    close_use_gradient: bool = True
    close_hover_gradient_start: str = "#ff4757"
    close_hover_gradient_end: str = "#e74c3c"
    close_pressed_gradient_start: str = "#c23616"
    close_pressed_gradient_end: str = "#b33939"
    close_hover_color: str = "#e74c3c"  # used when close_use_gradient is False
    close_pressed_color: str = "#c23616"  # used when close_use_gradient is False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to a dict."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TitleBarStyles':
        """Create from a dict."""
        return cls(**data)

    def merge(self, custom_styles: Optional[Dict[str, Any]]) -> 'TitleBarStyles':
        """Return a new style with custom_styles keys overriding this one."""
        if not custom_styles:
            return deepcopy(self)

        merged_data = self.to_dict()
        merged_data.update(custom_styles)

        return self.from_dict(merged_data)


class StyleSheetGenerator:
    """Generate Qt stylesheets from a TitleBarStyles configuration."""

    @staticmethod
    def generate_title_bar_stylesheet(styles: TitleBarStyles) -> str:
        """Title bar stylesheet."""
        if styles.bar_use_gradient:
            gradient_stops = []
            num_colors = len(styles.bar_gradient_colors)
            for i, color in enumerate(styles.bar_gradient_colors):
                stop = i / (num_colors - 1) if num_colors > 1 else 0
                gradient_stops.append(f"stop:{stop} {color}")

            gradient = f"qlineargradient(x1:0, y1:0, x2:1, y2:0, {', '.join(gradient_stops)})"
            background = f"background: {gradient};"
        else:
            background = f"background-color: {styles.bar_bg_color};"

        return f"""
            QWidget {{
                {background}
                border-bottom: {styles.bar_border_bottom};
            }}
        """

    @staticmethod
    def generate_logo_stylesheet(styles: TitleBarStyles) -> str:
        """Logo stylesheet."""
        return f"""
            QLabel {{
                border-radius: {styles.logo_border_radius}px;
                padding: {styles.logo_padding}px;
                background: {styles.logo_background};
            }}
        """

    @staticmethod
    def generate_title_label_stylesheet(styles: TitleBarStyles) -> str:
        """
        Generate title label stylesheet

        Note: Qt StyleSheet does not support 'text-shadow' CSS property,
        so we skip it even if defined in styles config.
        """
        # Qt StyleSheet doesn't support text-shadow, skip it
        return f"""
            QLabel {{
                color: {styles.title_color};
                font-size: {styles.title_font_size};
                font-weight: {styles.title_font_weight};
                font-family: {styles.title_font_family};
                padding: {styles.title_padding};
            }}
        """

    @staticmethod
    def generate_button_stylesheet(styles: TitleBarStyles,
                                   button_type: str = "normal") -> str:
        """Button stylesheet; button_type is "normal", "minimize", "maximize" or "close"."""
        if button_type == "close" and styles.close_use_gradient:
            hover_bg = f"""background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 {styles.close_hover_gradient_start},
                stop:1 {styles.close_hover_gradient_end});"""
            pressed_bg = f"""background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 {styles.close_pressed_gradient_start},
                stop:1 {styles.close_pressed_gradient_end});"""
        else:
            if button_type == "close":
                hover_color = styles.close_hover_color
                pressed_color = styles.close_pressed_color
            elif button_type == "minimize":
                hover_color = styles.minimize_hover_color
                pressed_color = styles.minimize_pressed_color
            elif button_type == "maximize":
                hover_color = styles.maximize_hover_color
                pressed_color = styles.maximize_pressed_color
            else:
                hover_color = styles.menu_hover_color
                pressed_color = styles.menu_pressed_color

            hover_bg = f"background-color: {hover_color};"
            pressed_bg = f"background-color: {pressed_color};"

        return f"""
            QPushButton {{
                background-color: {styles.button_normal_bg};
                border: none;
                border-radius: {styles.button_border_radius}px;
                color: #ffffff;
                font-size: {styles.button_font_size};
                font-weight: {styles.button_font_weight};
                font-family: 'Segoe MDL2 Assets', 'Microsoft YaHei UI';
                margin: {styles.button_margin};
            }}
            QPushButton:hover {{
                {hover_bg}
                color: #ffffff;
            }}
            QPushButton:pressed {{
                {pressed_bg}
                padding-top: 2px;
            }}
        """
