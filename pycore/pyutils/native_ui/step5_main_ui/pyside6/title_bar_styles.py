#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Title Bar Styles - Configurable Style System

提供默认样式和样式叠加机制
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from copy import deepcopy


@dataclass
class TitleBarStyles:
    """标题栏完整样式配置"""

    # ========== 标题栏总样式 ==========
    bar_height: int = 40
    bar_bg_color: str = "#1a1a2e"
    bar_use_gradient: bool = True
    bar_gradient_colors: list = field(default_factory=lambda: ["#1a1a2e", "#16213e", "#0f1419"])
    bar_border_bottom: str = "1px solid rgba(255, 255, 255, 0.1)"
    bar_padding_left: int = 12
    bar_padding_right: int = 8
    bar_spacing: int = 0

    # ========== Logo 样式 ==========
    logo_size: int = 28
    logo_border_radius: int = 4
    logo_padding: int = 2
    logo_spacing_right: int = 10
    logo_background: str = "transparent"

    # ========== 标题文字样式 ==========
    title_font_size: str = "11pt"
    title_font_weight: int = 600
    title_font_family: str = "'Microsoft YaHei UI', 'Segoe UI', sans-serif"
    title_color: str = "#ffffff"
    title_text_shadow: str = "0 1px 2px rgba(0, 0, 0, 0.3)"
    title_padding: str = "0 8px"

    # ========== 菜单按钮样式 ==========
    menu_icon: str = "☰"
    menu_hover_color: str = "#4a5568"
    menu_pressed_color: str = "#2d3748"

    # ========== 窗口控制按钮通用样式 ==========
    button_width: int = 48
    button_height: int = 40
    button_border_radius: int = 8
    button_font_size: str = "16px"
    button_font_weight: int = 600
    button_margin: str = "4px"
    button_normal_bg: str = "transparent"

    # ========== 最小化按钮样式 ==========
    minimize_icon: str = "−"
    minimize_hover_color: str = "#4a5568"
    minimize_pressed_color: str = "#2d3748"

    # ========== 最大化/还原按钮样式 ==========
    maximize_icon: str = "□"
    maximize_icon_restore: str = "❐"
    maximize_hover_color: str = "#4a5568"
    maximize_pressed_color: str = "#2d3748"

    # ========== 关闭按钮样式 ==========
    close_icon: str = "✕"
    close_use_gradient: bool = True
    close_hover_gradient_start: str = "#ff4757"
    close_hover_gradient_end: str = "#e74c3c"
    close_pressed_gradient_start: str = "#c23616"
    close_pressed_gradient_end: str = "#b33939"
    close_hover_color: str = "#e74c3c"  # 非渐变时使用
    close_pressed_color: str = "#c23616"  # 非渐变时使用

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TitleBarStyles':
        """从字典创建"""
        return cls(**data)

    def merge(self, custom_styles: Optional[Dict[str, Any]]) -> 'TitleBarStyles':
        """
        合并自定义样式到默认样式（创建新实例）

        Args:
            custom_styles: 用户自定义样式字典

        Returns:
            合并后的新样式实例
        """
        if not custom_styles:
            return deepcopy(self)

        # 深拷贝当前样式
        merged_data = self.to_dict()

        # 用户样式覆盖默认值
        merged_data.update(custom_styles)

        return self.from_dict(merged_data)


# ========== 预设样式主题 ==========

def get_default_style() -> TitleBarStyles:
    """获取默认样式（深色现代风格）"""
    return TitleBarStyles()


def get_dark_style() -> TitleBarStyles:
    """深色主题样式"""
    return TitleBarStyles(
        bar_bg_color="#1a1a2e",
        bar_gradient_colors=["#1a1a2e", "#16213e", "#0f1419"],
        title_color="#ffffff",
    )


def get_light_style() -> TitleBarStyles:
    """浅色主题样式"""
    return TitleBarStyles(
        bar_bg_color="#f5f5f5",
        bar_use_gradient=True,
        bar_gradient_colors=["#f5f5f5", "#e8e8e8", "#d0d0d0"],
        bar_border_bottom="1px solid rgba(0, 0, 0, 0.1)",
        title_color="#2c3e50",
        title_text_shadow="0 1px 1px rgba(255, 255, 255, 0.5)",
        menu_hover_color="#d0d0d0",
        menu_pressed_color="#b0b0b0",
        minimize_hover_color="#d0d0d0",
        minimize_pressed_color="#b0b0b0",
        maximize_hover_color="#d0d0d0",
        maximize_pressed_color="#b0b0b0",
        close_hover_gradient_start="#ff6b6b",
        close_hover_gradient_end="#ee5a52",
    )


def get_vibrant_style() -> TitleBarStyles:
    """鲜艳主题样式"""
    return TitleBarStyles(
        bar_bg_color="#2d3561",
        bar_use_gradient=True,
        bar_gradient_colors=["#2d3561", "#1f2544", "#0f1419"],
        bar_border_bottom="2px solid rgba(124, 58, 237, 0.5)",
        title_color="#ffffff",
        title_font_size="12pt",
        button_border_radius=12,
        minimize_hover_color="#5b21b6",
        maximize_hover_color="#5b21b6",
        close_hover_gradient_start="#f43f5e",
        close_hover_gradient_end="#dc2626",
    )


def get_minimal_style() -> TitleBarStyles:
    """极简主题样式"""
    return TitleBarStyles(
        bar_height=36,
        bar_bg_color="#ffffff",
        bar_use_gradient=False,
        bar_border_bottom="1px solid #e5e5e5",
        title_color="#171717",
        title_font_size="10pt",
        title_font_weight=500,
        title_text_shadow="none",
        button_width=44,
        button_height=36,
        button_border_radius=6,
        button_font_size="14px",
        minimize_hover_color="#f5f5f5",
        minimize_pressed_color="#e5e5e5",
        maximize_hover_color="#f5f5f5",
        maximize_pressed_color="#e5e5e5",
        close_use_gradient=False,
        close_hover_color="#fee2e2",
        close_pressed_color="#fecaca",
    )


# ========== 样式工具函数 ==========

def merge_styles(base_style: TitleBarStyles,
                 custom_dict: Optional[Dict[str, Any]] = None) -> TitleBarStyles:
    """
    合并样式的便捷函数

    Args:
        base_style: 基础样式（默认或预设主题）
        custom_dict: 用户自定义样式字典

    Returns:
        合并后的样式

    Example:
        >>> base = get_dark_style()
        >>> custom = {"title_color": "#00ff00", "bar_height": 50}
        >>> final_style = merge_styles(base, custom)
    """
    return base_style.merge(custom_dict)


def create_custom_style(**kwargs) -> TitleBarStyles:
    """
    创建自定义样式（基于默认样式）

    Args:
        **kwargs: 样式参数（会覆盖默认值）

    Returns:
        自定义样式实例

    Example:
        >>> style = create_custom_style(
        ...     bar_height=50,
        ...     title_color="#00ff00",
        ...     close_hover_color="#ff0000"
        ... )
    """
    base = get_default_style()
    return base.merge(kwargs)


# ========== 样式生成器 ==========

class StyleSheetGenerator:
    """样式表生成器 - 根据样式配置生成 Qt StyleSheet"""

    @staticmethod
    def generate_title_bar_stylesheet(styles: TitleBarStyles) -> str:
        """
        生成标题栏样式表

        Args:
            styles: 样式配置

        Returns:
            Qt StyleSheet 字符串
        """
        if styles.bar_use_gradient:
            # 生成渐变背景
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
        """生成 Logo 样式表"""
        return f"""
            QLabel {{
                border-radius: {styles.logo_border_radius}px;
                padding: {styles.logo_padding}px;
                background: {styles.logo_background};
            }}
        """

    @staticmethod
    def generate_title_label_stylesheet(styles: TitleBarStyles) -> str:
        """生成标题文字样式表"""
        text_shadow = f"text-shadow: {styles.title_text_shadow};" if styles.title_text_shadow != "none" else ""

        return f"""
            QLabel {{
                color: {styles.title_color};
                font-size: {styles.title_font_size};
                font-weight: {styles.title_font_weight};
                font-family: {styles.title_font_family};
                padding: {styles.title_padding};
                {text_shadow}
            }}
        """

    @staticmethod
    def generate_button_stylesheet(styles: TitleBarStyles,
                                   button_type: str = "normal") -> str:
        """
        生成按钮样式表

        Args:
            styles: 样式配置
            button_type: 按钮类型 ("normal", "minimize", "maximize", "close")

        Returns:
            Qt StyleSheet 字符串
        """
        # 根据按钮类型选择颜色
        if button_type == "close" and styles.close_use_gradient:
            # 关闭按钮使用渐变
            hover_bg = f"""background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 {styles.close_hover_gradient_start},
                stop:1 {styles.close_hover_gradient_end});"""
            pressed_bg = f"""background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 {styles.close_pressed_gradient_start},
                stop:1 {styles.close_pressed_gradient_end});"""
        else:
            # 其他按钮或关闭按钮不使用渐变
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


# ========== 导出 ==========

__all__ = [
    'TitleBarStyles',
    'get_default_style',
    'get_dark_style',
    'get_light_style',
    'get_vibrant_style',
    'get_minimal_style',
    'merge_styles',
    'create_custom_style',
    'StyleSheetGenerator',
]
