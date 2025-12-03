#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Launcher Configuration Builder

Builds LauncherConfig for Matrix application.
Does NOT start any threads or services.
"""

from pathlib import Path

from pycore import ColorPrint
from pycore.pylauncher import LauncherConfig
from pycore.pyutils.native_ui import get_i18n_manager
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem


def build_matrix_launcher_config(
    project_root: Path,
    frontend_port: int,
    backend_port: int,
    backend_host: str = '0.0.0.0',
    frontend_mode: str = 'production'
):
    """
    Build LauncherConfig for Matrix application

    Args:
        project_root: Project root directory
        frontend_port: Frontend port (Nuxt)
        backend_port: Backend port (FastAPI)
        backend_host: Backend host
        frontend_mode: Frontend mode ('dev' | 'production')

    Returns:
        LauncherConfig instance
    """
    ColorPrint.blue("[Matrix ConfigBuilder] Building launcher configuration...")

    # Determine webview URL based on frontend mode
    if frontend_mode == 'production':
        # Production mode: unified port (backend serves frontend)
        webview_url = f"http://localhost:{backend_port}"
        ColorPrint.blue(f"[Matrix ConfigBuilder] Frontend mode: production (unified port: {backend_port})")
    else:
        # Dev mode: separate ports
        webview_url = f"http://localhost:{frontend_port}"
        ColorPrint.blue(f"[Matrix ConfigBuilder] Frontend mode: dev (frontend port: {frontend_port})")

    # Get i18n manager and extend with matrix translations
    i18n = get_i18n_manager()
    current_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(current_dir), app_name="matrix")

    # Import Matrix API routers
    from pyapps.matrix.api import (
        health_router,
        device_router,
        screen_router,
        file_router,
        recording_router,
        group_router,
        config_router,
        ws_router
    )

    # Icon path (for window icon)
    icon_path = current_dir / "icon.ico"

    # Logo path (for title bar)
    logo_path = current_dir / "logo.png"

    # Menu icon path (optional, if provided, menu button will be shown in title bar)
    menu_icon_path = current_dir / "menu_icon.png"
    if not menu_icon_path.exists():
        menu_icon_path = None

    # Get translated app name
    app_name = i18n.get("matrix.app_name")

    # Base services
    services = {
        'heartbeat': {},

        # RPC v2 service (Matrix backend API)
        'rpc_v2': {
            'port': backend_port,
            'host': backend_host,
            'debug': True,
            'fastapi_routers': [
                health_router,
                device_router,
                screen_router,
                file_router,
                recording_router,
                group_router,
                config_router,
                ws_router
            ],
            'static_mounts': []
        },

        # UI service (PySide6 webview)
        'ui': {
            'app_name': app_name,
            'app_id': 'matrix',
            'app_user_model_id': 'com.xingcan.matrix.1.0',  # Custom AppUserModelID for Windows taskbar
            'window_size': (1400, 900),
            'webview_url': webview_url,  # Dynamically set based on frontend_mode
            'show_on_start': True,
            'frameless': True,
            'icon_path': str(icon_path),
            'logo_path': str(logo_path),
            'menu_icon_path': str(menu_icon_path) if menu_icon_path else None,
            'enable_tray': False,  # Use separate tray service instead
            'enable_webview': True,
            'enable_dev_tools': False,
            'debug': False,
            'show_startup': True,
            'auto_close_startup': True
        },

        # Tray service
        'tray': {
            'app_name': app_name,
            'icon_path': str(icon_path),
            'menu_items': _build_tray_menu(frontend_port, backend_port, backend_host),
            'trigger_shutdown_on_exit': True
        }
    }

    # Create launcher configuration
    config = LauncherConfig(
        app_id="matrix",
        app_name=app_name,
        singleton=True,
        shutdown_existing=False,
        force_launch=False,
        singleton_port_start=54000,
        singleton_port_range=100,
        services=services
    )

    ColorPrint.green(f"[Matrix ConfigBuilder] Configuration built with {len(services)} services")
    ColorPrint.blue(f"[Matrix ConfigBuilder] Services: {', '.join(services.keys())}")

    return config


def _build_tray_menu(frontend_port: int, backend_port: int, backend_host: str):
    """
    Build tray menu items (pure data, no event registration)

    Args:
        frontend_port: Frontend port
        backend_port: Backend port
        backend_host: Backend host

    Returns:
        List of TrayMenuItem objects
    """
    i18n = get_i18n_manager()

    return [
        TrayMenuItem(
            text=i18n.get("matrix.tray.open_frontend"),
            action_signal="tray_action_open_frontend",
            default=True
        ),
        TrayMenuItem(
            text=i18n.get("matrix.tray.open_api_docs"),
            action_signal="tray_action_open_api_docs"
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text=i18n.get("matrix.tray.exit"),
            action_signal="tray_action_exit"
        ),
    ]
