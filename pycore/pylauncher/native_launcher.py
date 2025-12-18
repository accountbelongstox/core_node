#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Native UI Launcher

Centralized launcher for all Native UI applications.
Sub-apps should ONLY use this entry point and pass parameters.

Architecture:
    Sub-app (callmodule, matrix, okx_price_monitor)
      ↓ (pass parameters)
    pycore/pylauncher/native_launcher.py (this file)
      ↓ (handle launch logic)
    pycore/pyutils/native_ui/launch_native_app

Usage:
    from pycore.pylauncher import launch_with_native_ui

    launch_with_native_ui(
        app_id="my_app",
        app_name="My Application",
        frontend_enabled=True,
        rpc_enabled=True,
        ...
    )
"""

from typing import Callable, Optional, List, Dict, Tuple, Union, Literal
from pathlib import Path

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app


def launch_with_native_ui(
    # ========== Required Parameters ==========
    app_id: str,
    app_name: str,
    main_entry: Optional[Callable] = None,

    # ========== Project Path ==========
    project_root: Optional[Path] = None,

    # ========== Debug Window ==========
    show_debug_window: bool = True,
    debug_window_width: int = 650,
    debug_window_height: int = 500,
    min_display_time: float = 2.0,

    # ========== System Tray ==========
    enable_tray: bool = False,
    tray_type: Literal["tk", "pyside6"] = "pyside6",
    tray_menu_items: Optional[List[Dict]] = None,
    minimize_to_tray: bool = True,

    # ========== Main Window URL ==========
    url: str = "",
    url_type: Literal["remote", "static", "nuxt_app", "vue_dist", "auto"] = "auto",

    # ========== UI Style ==========
    window_size: Union[Tuple[int, int], Literal["fullscreen"]] = (1280, 900),
    show_on_start: bool = True,
    frameless: bool = True,
    loading_style: int = 10,
    window_title_key: Optional[str] = None,

    # ========== Icons and Logo ==========
    icon_path: Optional[str] = None,
    logo_path: Optional[str] = None,
    logo_size: int = 24,

    # ========== Multi-Language ==========
    enable_language_selector: bool = True,

    # ========== Callbacks (Queue-based) ==========
    on_ready_callbacks: Optional[List[Callable]] = None,
    on_closed_callbacks: Optional[List[Callable]] = None,
    on_closing_callbacks: Optional[List[Callable]] = None,
    on_restart_callback: Optional[Callable] = None,

    # ========== Frontend Management ==========
    frontend_enabled: bool = False,
    frontend_framework: Optional[str] = None,
    frontend_app_dir: Optional[Path] = None,
    frontend_mode: str = "production",
    frontend_port: int = 3000,
    frontend_auto_install: bool = True,
    frontend_package_manager: str = "pnpm",
    frontend_skip_build: bool = False,
    frontend_block_until_ready: bool = False,

    # ========== RPC v2 Management ==========
    rpc_enabled: bool = False,
    rpc_port: int = 8000,
    rpc_host: str = "0.0.0.0",
    rpc_debug: bool = True,
    rpc_routers: Optional[List] = None,
    rpc_allow_origins: Optional[List[str]] = None,
    rpc_init_callback: Optional[Callable] = None,
    rpc_auto_mount_frontend: bool = True,

    # ========== Timer Management ==========
    enable_timer: bool = False,

    # ========== Restart Support ==========
    enable_restart: bool = False,

    # ========== QtWebEngine Configuration ==========
    webengine_enable_config: bool = True,
    webengine_chromium_flags: Optional[Dict[str, str]] = None,
    webengine_disable_gpu_sandbox: bool = False,
    webengine_enable_webcodecs: bool = True,
    webengine_enable_hardware_acceleration: bool = True,
    webengine_enable_remote_debugging: bool = False,
    webengine_remote_debugging_port: int = 9222,
    webengine_print_diagnostics: bool = False,

    # ========== Singleton Detection ==========
    force: bool = False,

    # ========== Debug Mode ==========
    debug: bool = False,
) -> None:
    """
    Unified Native UI launcher for all applications

    This is the ONLY entry point for Native UI applications.
    Sub-apps should NOT directly import launch_native_app or NativeUIConfig.

    Architecture Flow:
        1. Sub-app calls launch_with_native_ui() with parameters
        2. pylauncher creates NativeUIConfig
        3. pylauncher calls launch_native_app(config)
        4. native_ui layer handles all launch logic

    Args:
        app_id: Application unique identifier (for singleton detection)
        app_name: Application display name (supports i18n keys)
        main_entry: Main application entry function (called after startup)
        project_root: Project root directory (auto-detected if None)

        show_debug_window: Whether to show debug log window during startup
        debug_window_width: Debug window width in pixels
        debug_window_height: Debug window height in pixels
        min_display_time: Minimum time to display debug window (seconds)

        enable_tray: Whether to enable system tray icon
        tray_type: Tray implementation type (tk or pyside6)
        tray_menu_items: Tray menu items (list of dicts with 'text' and 'callback')
        minimize_to_tray: Minimize to tray instead of closing

        url: Main window URL (remote HTTP, static file, nuxt app, etc.)
        url_type: URL type (auto-detected if 'auto')

        window_size: Window size (width, height) or 'fullscreen'
        show_on_start: Whether to show window immediately on start
        frameless: Frameless window (custom title bar)
        loading_style: Loading animation style (1-14)
        window_title_key: Window title i18n key

        icon_path: Window icon path (.ico or .png)
        logo_path: Logo image path (.png)
        logo_size: Logo size in pixels

        enable_language_selector: Enable language selector in debug window

        on_ready_callbacks: Callback queue when UI is ready
        on_closed_callbacks: Callback queue when UI is closed
        on_closing_callbacks: Callback queue before UI closes
        on_restart_callback: Callback when application restarts

        frontend_enabled: Enable integrated frontend launcher
        frontend_framework: Frontend framework (nuxt|react|vite|vue|next)
        frontend_app_dir: Frontend project directory
        frontend_mode: Frontend mode (dev|production)
        frontend_port: Frontend dev server port
        frontend_auto_install: Auto-install frontend dependencies
        frontend_package_manager: Package manager (pnpm|npm|yarn)
        frontend_skip_build: Skip build in production mode
        frontend_block_until_ready: Block until frontend is ready

        rpc_enabled: Enable RPC v2 backend service
        rpc_port: RPC v2 service port
        rpc_host: RPC v2 service host
        rpc_debug: RPC v2 debug mode
        rpc_routers: FastAPI router list
        rpc_allow_origins: CORS allowed origins list
        rpc_init_callback: RPC v2 initialization callback
        rpc_auto_mount_frontend: Auto-mount frontend static files

        enable_timer: Enable built-in timer manager
        enable_restart: Enable application restart support

        webengine_enable_config: Enable QtWebEngine configuration
        webengine_chromium_flags: Custom Chromium flags
        webengine_disable_gpu_sandbox: Disable GPU sandbox
        webengine_enable_webcodecs: Enable WebCodecs API
        webengine_enable_hardware_acceleration: Enable hardware acceleration
        webengine_enable_remote_debugging: Enable remote debugging
        webengine_remote_debugging_port: Remote debugging port
        webengine_print_diagnostics: Print WebEngine diagnostics

        force: Force launch (skip singleton detection)
        debug: Debug mode

    Example:
        from pycore.pylauncher import launch_with_native_ui

        launch_with_native_ui(
            app_id="my_app",
            app_name="My Application",
            frontend_enabled=True,
            frontend_framework="vite",
            frontend_app_dir=Path(__file__).parent / "frontend",
            rpc_enabled=True,
            rpc_port=8000,
            rpc_routers=[router1, router2],
            enable_tray=True,
        )
    """
    if debug:
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(f" {app_name.upper()} - UNIFIED NATIVE UI LAUNCHER")
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(f"[pylauncher] App ID: {app_id}")
        ColorPrint.blue(f"[pylauncher] Frontend: {'enabled' if frontend_enabled else 'disabled'}")
        ColorPrint.blue(f"[pylauncher] RPC v2: {'enabled' if rpc_enabled else 'disabled'}")
        ColorPrint.blue("=" * 70)

    # Create NativeUIConfig from parameters
    config = NativeUIConfig(
        # Required
        app_id=app_id,
        app_name=app_name,
        main_entry=main_entry or (lambda: None),  # Provide no-op if None
        project_root=project_root,

        # Debug Window
        show_debug_window=show_debug_window,
        debug_window_width=debug_window_width,
        debug_window_height=debug_window_height,
        min_display_time=min_display_time,

        # System Tray
        enable_tray=enable_tray,
        tray_type=tray_type,
        tray_menu_items=tray_menu_items or [],
        minimize_to_tray=minimize_to_tray,

        # Main Window URL
        url=url,
        url_type=url_type,

        # UI Style
        window_size=window_size,
        show_on_start=show_on_start,
        frameless=frameless,
        loading_style=loading_style,
        window_title_key=window_title_key,

        # Icons and Logo
        icon_path=icon_path,
        logo_path=logo_path,
        logo_size=logo_size,

        # Multi-Language
        enable_language_selector=enable_language_selector,

        # Callbacks
        on_ready_callbacks=on_ready_callbacks or [],
        on_closed_callbacks=on_closed_callbacks or [],
        on_closing_callbacks=on_closing_callbacks or [],
        on_restart_callback=on_restart_callback,

        # Frontend Management
        frontend_enabled=frontend_enabled,
        frontend_framework=frontend_framework,
        frontend_app_dir=frontend_app_dir,
        frontend_mode=frontend_mode,
        frontend_port=frontend_port,
        frontend_auto_install=frontend_auto_install,
        frontend_package_manager=frontend_package_manager,
        frontend_skip_build=frontend_skip_build,
        frontend_block_until_ready=frontend_block_until_ready,

        # RPC v2 Management
        rpc_enabled=rpc_enabled,
        rpc_port=rpc_port,
        rpc_host=rpc_host,
        rpc_debug=rpc_debug,
        rpc_routers=rpc_routers or [],
        rpc_allow_origins=rpc_allow_origins or ["*"],
        rpc_init_callback=rpc_init_callback,
        rpc_auto_mount_frontend=rpc_auto_mount_frontend,

        # Timer Management
        enable_timer=enable_timer,

        # Restart Support
        enable_restart=enable_restart,

        # QtWebEngine Configuration
        webengine_enable_config=webengine_enable_config,
        webengine_chromium_flags=webengine_chromium_flags,
        webengine_disable_gpu_sandbox=webengine_disable_gpu_sandbox,
        webengine_enable_webcodecs=webengine_enable_webcodecs,
        webengine_enable_hardware_acceleration=webengine_enable_hardware_acceleration,
        webengine_enable_remote_debugging=webengine_enable_remote_debugging,
        webengine_remote_debugging_port=webengine_remote_debugging_port,
        webengine_print_diagnostics=webengine_print_diagnostics,

        # Singleton Detection
        force=force,

        # Debug Mode
        debug=debug,
    )

    # Launch via native_ui layer
    launch_native_app(config)
