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
    app_user_model_id: Optional[str] = None  # Windows AppUserModelID for taskbar icon (if None, auto-generated)
    icon_path: Optional[str] = None
    logo_path: Optional[str] = None
    logo_size: int = 24

    # ========== Window Configuration ==========
    window_size: Tuple[int, int] = (1280, 800)
    min_window_size: Tuple[int, int] = (800, 600)
    show_on_start: bool = True  # Show window on start (default: True, changed from False)
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
    menu_icon_path: Optional[str] = None  # Path to menu icon (if provided, menu button will be shown)
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
    enable_dev_tools: bool = False  # Enable web inspector (F12 or right-click inspect)
    enable_javascript: bool = True
    enable_plugins: bool = False

    # ========== QtWebEngine Configuration ==========
    # QtWebEngine/Chromium flags for hardware acceleration and WebCodecs support
    webengine_enable_config: bool = True  # Enable multi-tier WebEngine configuration
    webengine_chromium_flags: Optional[List[str]] = None  # Custom Chromium flags (None = use defaults)
    webengine_disable_gpu_sandbox: bool = True  # Disable GPU sandbox (may be needed for hardware acceleration on Windows)
    webengine_enable_webcodecs: bool = True  # Enable WebCodecs API (H.264 video decoding)
    webengine_enable_hardware_acceleration: bool = True  # Enable GPU hardware acceleration
    webengine_enable_remote_debugging: bool = False  # Enable remote debugging (F12 dev tools via http://localhost:port)
    webengine_remote_debugging_port: int = 9222  # Remote debugging port (default: 9222)
    webengine_print_diagnostics: bool = False  # Print detailed WebEngine diagnostic info on startup

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

    # ========== THREAD_BUS Integration (Always Enabled) ==========
    thread_bus_namespace: Optional[str] = None
    """
    THREAD_BUS event namespace (default: app_id if provided, else 'ui')
    Automatically listens to events like:
    - {namespace}.show - Show window
    - {namespace}.hide - Hide window
    - {namespace}.toggle - Toggle window visibility
    - {namespace}.move - Move window (data: {x, y})
    - {namespace}.resize - Resize window (data: {width, height})
    - {namespace}.close - Close window
    - {namespace}.minimize - Minimize window
    - {namespace}.maximize - Maximize window
    """

    trigger_shutdown_on_close: bool = True
    """Trigger global THREAD_BUS shutdown when window closes (default: True)"""

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
    Startup Window Configuration (DEPRECATED in favor of TkinterStartupThread)

    Simple configuration for the initialization window that shows
    BEFORE PySide6 dependencies are installed.

<<<<<<< HEAD
    This window can be used as a debug/log window that shows ColorPrint output.
=======
    DEPRECATED: This config is kept for backward compatibility but should not be used.
    Use NativeUIConfig.show_debug_window=True with launcher_with_startup.py instead.

    This creates TkinterStartupThread which has better features:
    - Thread-safe
    - ColorPrint integration
    - Language selector support
    - Auto-close on frontend.ready
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    """
    app_name: str = "Application"
    width: int = 500
    height: int = 400
    icon_path: Optional[str] = None  # Path to window icon (.ico for Windows, .png for Linux)
<<<<<<< HEAD
    show_startup: bool = True  # Whether to show startup window
=======
    show_startup: bool = False  # Default: False (use TkinterStartupThread via launcher_with_startup instead)
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    auto_close: bool = True  # Auto-close when PySide6 starts (False = keep as debug window)
    daemon: bool = True  # Run as daemon thread (auto-terminates with main)
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
