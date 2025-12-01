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


def build_matrix_launcher_config(project_root: Path, frontend_port: int, backend_port: int, backend_host: str = '0.0.0.0'):
    """
    Build LauncherConfig for Matrix application

    Args:
        project_root: Project root directory
        frontend_port: Frontend port (Nuxt)
        backend_port: Backend port (FastAPI)
        backend_host: Backend host

    Returns:
        LauncherConfig instance
    """
    ColorPrint.blue("[Matrix ConfigBuilder] Building launcher configuration...")

    # Get i18n manager
    i18n = get_i18n_manager()

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

    # Icon path
    icon_path = project_root / "pyapps" / "matrix" / "icon.png"
    if not icon_path.exists():
        icon_path = None

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
            'app_name': i18n.get("matrix.app_name") if hasattr(i18n, 'get') else 'Matrix',
            'app_id': 'matrix',
            'window_size': (1400, 900),
            'webview_url': f"http://localhost:{frontend_port}",
            'show_on_start': True,
            'frameless': False,
            'icon_path': str(icon_path) if icon_path else None,
            'enable_tray': False,  # Use separate tray service instead
            'enable_webview': True,
            'enable_dev_tools': False,
            'debug': False,
            'show_startup': True,
            'auto_close_startup': True
        },

        # Tray service
        'tray': {
            'app_name': i18n.get("matrix.app_name") if hasattr(i18n, 'get') else 'Matrix',
            'icon_path': str(icon_path) if icon_path else None,
            'menu_items': _build_tray_menu(frontend_port, backend_port, backend_host),
            'trigger_shutdown_on_exit': True
        }
    }

    # Create launcher configuration
    config = LauncherConfig(
        app_id="matrix",
        app_name=i18n.get("matrix.app_name") if hasattr(i18n, 'get') else 'Matrix',
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
            text=i18n.get("matrix.tray.open_frontend") if hasattr(i18n, 'get') else 'Open Frontend',
            action_signal="tray_action_open_frontend",
            default=True
        ),
        TrayMenuItem(
            text=i18n.get("matrix.tray.open_api_docs") if hasattr(i18n, 'get') else 'Open API Docs',
            action_signal="tray_action_open_api_docs"
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Exit",
            action_signal="tray_action_exit"
        ),
    ]
