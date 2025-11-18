#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Configuration Module (DEPRECATED)

⚠️ DEPRECATED: This module is deprecated and will be removed in future versions.
Use NativeUIConfig from step1_config/app_config.py instead.

Migration guide:
    # Old (deprecated)
    from pycore.pyutils.native_ui import UIConfig
    config = UIConfig(app_name="My App")

    # New (recommended)
    from pycore.pyutils.native_ui import NativeUIConfig
    config = NativeUIConfig(app_id="my_app", app_name="My App")
"""

import warnings
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

    ⚠️ DEPRECATED: Use NativeUIConfig instead.

    This class will be removed in future versions.
    Please migrate to NativeUIConfig from step1_config/app_config.py.

    See: pycore/pyutils/native_ui/step1_config/app_config.py:NativeUIConfig

    Usage example (deprecated):
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

    def __post_init__(self):
        """Emit deprecation warning when UIConfig is instantiated"""
        warnings.warn(
            "UIConfig is deprecated. Use NativeUIConfig instead. "
            "See: pycore/pyutils/native_ui/step1_config/app_config.py",
            DeprecationWarning,
            stacklevel=2
        )
