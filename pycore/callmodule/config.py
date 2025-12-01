# -*- coding: utf-8 -*-
"""
LauncherConfig Builder for Pycore Module Caller

Builds LauncherConfig for different platforms.
Does NOT start any threads or services.
"""

import platform
from pathlib import Path

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import LauncherConfig
from pycore.callmodule.tray_menu import build_tray_menu

IS_WINDOWS = platform.system() == 'Windows'


def build_launcher_config(host='0.0.0.0', port=59000, debug=False):
    """
    Build LauncherConfig for Pycore Module Caller

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode

    Returns:
        LauncherConfig instance
    """
    ColorPrint.blue("[ConfigBuilder] Building launcher configuration...")

    # Import routers (from independent files)
    from pycore.callmodule.routers.web_router import router as web_router
    from pycore.callmodule.routers.voice_subtitle_router import router as voice_subtitle_router
    from pycore.callmodule.routers.mcp_router import mcp_router

    # Define static mounts configuration
    PYCORE_ROOT = Path(__file__).parent.parent
    DESKTOP_UI_DIR = PYCORE_ROOT / "pyctl" / "desktop" / "ui"

    static_mounts = []
    if DESKTOP_UI_DIR.exists():
        static_mounts.append({
            'url_prefix': '/desktop',
            'directory': str(DESKTOP_UI_DIR),
            'name': 'desktop_ui_static'
        })
        ColorPrint.blue(f"[ConfigBuilder] Added static mount: /desktop -> {DESKTOP_UI_DIR}")

    # Base services (common to all platforms)
    services = {
        'heartbeat': {},
        'rpc_v2': {
            'port': port,
            'host': host,
            'debug': debug,
            'fastapi_routers': [
                web_router,              # Web UI routes
                voice_subtitle_router,   # Voice subtitle API routes
                mcp_router               # MCP backend routes (file, database, codebase tools)
            ],
            'static_mounts': static_mounts  # Mount static files
        },
    }

    # Add UI service (voice subtitle window)
    # Note: Only on Windows for now, can be extended to other platforms
    if IS_WINDOWS:
        services['ui'] = {
            'app_name': 'Voice Subtitle',
            'app_id': 'voice_subtitle_ui',
            'window_size': (1000, 180),
            'webview_url': f'http://localhost:{port}/web/subtitle',
            'show_on_start': True,  # Show window on start (default: True)
            'frameless': False,
            'enable_tray': False,  # Use main tray
            'enable_webview': True,
            'enable_dev_tools': debug,
            'debug': debug,
            # Startup window config (tk debug window)
            'show_startup': True,  # Show tk startup/debug window
            'auto_close_startup': False  # Don't auto-close tk window (keep it for debugging)
            # Note: trigger_shutdown_on_close is built-in to PySide6UIConfig (default: True)
            # No need to pass it explicitly
        }

    # Add Windows-specific tray service
    if IS_WINDOWS:
        # Get icon path
        PYCORE_ROOT = Path(__file__).parent.parent
        icon_path = PYCORE_ROOT / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
        if not icon_path.exists():
            icon_path = None

        # Build tray menu (singleton_port will be updated later)
        tray_menu = build_tray_menu(port=port, singleton_port=None)

        # Add tray service
        services['tray'] = {
            'app_name': 'Pycore RPC Server',
            'icon_path': str(icon_path) if icon_path else None,
            'menu_items': tray_menu,
            'trigger_shutdown_on_exit': True
        }

        ColorPrint.blue("[ConfigBuilder] Added Windows tray service")

    # Create launcher configuration
    config = LauncherConfig(
        app_id="pycore_module_caller",
        app_name="Pycore Module Caller",
        singleton=True,
        shutdown_existing=True,
        singleton_port_start=59100,
        singleton_port_range=100,
        services=services
    )

    ColorPrint.green(f"[ConfigBuilder] Configuration built with {len(services)} services")
    ColorPrint.blue(f"[ConfigBuilder] Services: {', '.join(services.keys())}")
    return config


def update_tray_menu_with_singleton(launcher, port: int, singleton_port: int):
    """
    Update tray menu with singleton port info

    Args:
        launcher: ServiceLauncher instance
        port: RPC v2 server port
        singleton_port: Singleton port
    """
    if not IS_WINDOWS:
        return

    tray = launcher.get_service('tray')
    if not tray:
        ColorPrint.yellow("[ConfigBuilder] Tray service not found, skipping menu update")
        return

    # Rebuild menu with singleton port
    updated_menu = build_tray_menu(port=port, singleton_port=singleton_port)

    # Use THREAD_BUS event to update menu (thread-safe)
    THREAD_BUS.trigger_event('tray.update_menu', {'menu_items': updated_menu})
    ColorPrint.blue("[ConfigBuilder] Tray menu update requested via THREAD_BUS")
