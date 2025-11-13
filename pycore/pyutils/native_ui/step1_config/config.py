#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Configuration Module
UI Framework Configuration Module
"""

from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Dict, Any
from enum import Enum


class WindowState(Enum):
    """Window state enumeration"""
    NORMAL = "normal"
    MAXIMIZED = "maximized"
    MINIMIZED = "minimized"
    HIDDEN = "hidden"


@dataclass
class UIConfig:
    """
    UI Configuration Class

    Usage example:
        config = UIConfig(
            app_name="My Application",
            window_size=(1280, 800),
            show_on_start=True
        )
    """
    # Application configuration
    app_name: str = "Native UI App"
    icon_path: Optional[str] = None

    # Window configuration
    window_size: Tuple[int, int] = (1280, 800)
    min_window_size: Tuple[int, int] = (800, 600)
    show_on_start: bool = False
    resizable: bool = True
    frameless: bool = True  # Frameless window (uses custom title bar)

    # Title bar configuration
    title_bar_height: int = 32
    title_bar_bg: str = "#2c3e50"
    title_bar_fg: str = "#ecf0f1"
    title_font: Tuple[str, int] = ("Microsoft YaHei UI", 10)

    # Tray configuration
    enable_tray: bool = True
    tray_menu_items: List[Dict[str, Any]] = field(default_factory=list)

    # WebView configuration
    ui_source: Optional[str] = None  # URL or local HTML path
    enable_webview: bool = True

    # Debug configuration
    debug: bool = False
