#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Native UI Framework - Configuration Module

Configuration for PySide6-based UI framework.
"""

from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Dict, Any, Callable
from enum import Enum


class WindowState(Enum):
    """Window state enumeration"""
    NORMAL = "normal"
    MAXIMIZED = "maximized"
    MINIMIZED = "minimized"
    HIDDEN = "hidden"


class WebViewEngine(Enum):
    """WebView engine selection"""
    PYSIDE6 = "pyside6"  # QWebEngineView (default)
    AUTO = "auto"        # Auto-detect best available


@dataclass
class PySide6UIConfig:
    """
    PySide6 UI Configuration Class

    This configuration is used for PySide6-based UI framework.
    The startup window (tkinter) uses separate simple configuration.

    Usage example:
        config = PySide6UIConfig(
            app_name="My Application",
            window_size=(1280, 800),
            webview_url="http://localhost:3000"
        )
    """
    # ========== Application Configuration ==========
    app_name: str = "Native UI App"
    app_id: Optional[str] = None  # Unique app identifier for settings
    icon_path: Optional[str] = None
    logo_path: Optional[str] = None
    logo_size: int = 24

    # ========== Window Configuration ==========
    window_size: Tuple[int, int] = (1280, 800)
    min_window_size: Tuple[int, int] = (800, 600)
    show_on_start: bool = False
    resizable: bool = True
    frameless: bool = True  # Frameless window (uses custom title bar)
    window_position: Optional[Tuple[int, int]] = None  # None = center

    # ========== Title Bar Configuration ==========
    enable_title_bar: bool = True
    title_bar_height: int = 32
    title_bar_bg: str = "#2c3e50"
    title_bar_fg: str = "#ecf0f1"
    title_font: Tuple[str, int] = ("Microsoft YaHei UI", 10)

    # Button configuration
    show_menu_button: bool = True
    show_minimize_button: bool = True
    show_maximize_button: bool = True
    show_close_button: bool = True

    # ========== System Tray Configuration ==========
    enable_tray: bool = True
    tray_icon_path: Optional[str] = None  # None = use app icon
    tray_menu_items: List[Dict[str, Any]] = field(default_factory=list)
    minimize_to_tray: bool = False  # Minimize hides to tray instead

    # ========== WebView Configuration ==========
    enable_webview: bool = True
    webview_engine: WebViewEngine = WebViewEngine.PYSIDE6
    webview_url: Optional[str] = None  # URL or local HTML path

    # Loading page configuration
    enable_loading_page: bool = True
    loading_page_path: Optional[str] = None  # Custom loading HTML
    loading_style: int = 1  # Built-in loading animation style (1-14)
    loading_text: str = "Loading..."
    loading_background: str = "#1e1e1e"

    # WebView settings
    enable_dev_tools: bool = False  # Enable web inspector
    enable_javascript: bool = True
    enable_plugins: bool = False

    # ========== Thread Configuration ==========
    # Main thread: UI event loop (PySide6 QApplication)
    # Tick thread: Periodic tasks timer thread
    enable_tick_timer: bool = True
    tick_interval: float = 1.0  # seconds

    # ========== I18n Configuration ==========
    enable_i18n: bool = True
    i18n_default_language: Optional[str] = None  # None = auto-detect
    i18n_use_system_language: bool = True
    i18n_use_cache: bool = True

    # ========== Callbacks ==========
    # UI lifecycle callbacks
    on_ready: Optional[Callable] = None  # Called when UI is ready
    on_closing: Optional[Callable] = None  # Called before window closes
    on_closed: Optional[Callable] = None  # Called after window closes

    # WebView callbacks
    on_webview_ready: Optional[Callable] = None  # Called when webview loads
    on_webview_error: Optional[Callable] = None  # Called on webview error

    # ========== Debug Configuration ==========
    debug: bool = False
    log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR

    # ========== Cache Configuration ==========
    cache_dir: Optional[str] = None  # None = use default cache dir
    cache_window_state: bool = True  # Save/restore window size/position
    cache_language: bool = True  # Save/restore language preference


@dataclass
class StartupWindowConfig:
    """
    Startup Window Configuration (Python native/tkinter)

    Simple configuration for the initialization window that shows
    BEFORE PySide6 dependencies are installed.
    """
    app_name: str = "Application"
    width: int = 500
    height: int = 400
    show_startup: bool = True  # Whether to show startup window
    on_complete: Optional[Callable] = None  # Called when startup completes


# Action types for window actions
class ActionType:
    """
    Window action types for PySide6 framework.

    These actions can have callbacks registered.
    """
    CLOSE = "close"
    MINIMIZE = "minimize"
    MAXIMIZE = "maximize"
    RESTORE = "restore"
    RESTART = "restart"
    MENU = "menu"
    HIDE = "hide"
    SHOW = "show"
