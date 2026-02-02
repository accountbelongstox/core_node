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
from pycore.callmodule.callmodule_config import Config as CallmoduleConfig

# Import management layer routers
from pycore.callmodule.routers.management import (
    status_router,
    config_router,
    control_router,
    logs_router,
    capabilities_router,
    local_config_router,
    local_stats_router,
    local_test_router,
)

# Import local processing layer routers (NEW)
from pycore.callmodule.routers.local import (
    screenshot_router,
    image_router,
    audio_router,
    file_router,
    video_router,
)

# Import upload layer routers (NEW)
from pycore.callmodule.routers.upload import router as upload_router

# Import client layer routers (NEW)
from pycore.callmodule.routers.client import router as client_router

# Import legacy routers (from independent files - still active)
from pycore.callmodule.routers.mcp_router import mcp_router
from pycore.callmodule.routers.code_sync_router import router as code_sync_router
from pycore.callmodule.routers.module_call_router import module_call_router
from pycore.callmodule.routers.notebooklm_stt_router import router as notebooklm_stt_router

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
                # === Management Layer Routers ===
                status_router,           # System status endpoint
                config_router,           # System configuration endpoints
                control_router,          # System control operations
                logs_router,             # Log management endpoints
                capabilities_router,     # Local processing capabilities
                local_config_router,     # Local processing configuration
                local_stats_router,      # Local processing statistics
                local_test_router,       # Local processing test endpoint

                # === Local Processing Layer Routers (Edge Computing) ===
                screenshot_router,       # Screenshot capture with auto-OCR
                image_router,            # Image OCR and processing
                audio_router,            # Audio transcription and subtitle generation
                file_router,             # File analysis (PDF/DOCX/XLSX)
                video_router,            # Video processing (audio extraction, subtitles)

                # === Upload Layer Routers ===
                upload_router,           # Upload task management and server config

                # === Client Layer Routers ===
                client_router,           # Remote server request forwarding

                # === Legacy Routers (Still Active) ===
                mcp_router,              # MCP backend routes (file, database, codebase tools)
                code_sync_router,        # Code sync routes
                module_call_router,      # Module call API routes
                notebooklm_stt_router,   # NotebookLM STT routes
            ],
            'static_mounts': static_mounts  # Mount static files
        },
    }

    # Add UI service (voice subtitle window) - from callmodule_config/config.py
    # Note: Only on Windows for now, can be extended to other platforms
    if IS_WINDOWS:
        ui_ws = CallmoduleConfig.UI_WINDOW_SIZE
        window_size_tuple = (int(ui_ws[0]), int(ui_ws[1])) if isinstance(ui_ws, (list, tuple)) and len(ui_ws) >= 2 else (1000, 180)
        services['ui'] = {
            'app_name': CallmoduleConfig.UI_APP_NAME,
            'app_id': CallmoduleConfig.UI_APP_ID,
            'window_size': window_size_tuple,
            'webview_url': f'http://localhost:{port}/web/subtitle',
            'show_on_start': CallmoduleConfig.UI_SHOW_ON_START,
            'frameless': CallmoduleConfig.UI_FRAMELESS,
            'enable_tray': CallmoduleConfig.UI_ENABLE_TRAY,
            'enable_webview': True,
            'enable_dev_tools': debug,
            'debug': debug,
            'show_startup': CallmoduleConfig.UI_SHOW_STARTUP,
            'auto_close_startup': CallmoduleConfig.UI_AUTO_CLOSE_STARTUP
        }

    # Add Windows-specific tray service - from callmodule_config/settings.yaml
    if IS_WINDOWS:
        PYCORE_ROOT = Path(__file__).parent.parent
        icon_path = PYCORE_ROOT / CallmoduleConfig.TRAY_ICON_PATH_REL
        if not icon_path.exists():
            icon_path = None

        tray_menu = build_tray_menu(port=port, singleton_port=None)

        services['tray'] = {
            'app_name': CallmoduleConfig.TRAY_APP_NAME,
            'icon_path': str(icon_path) if icon_path else None,
            'menu_items': tray_menu,
            'trigger_shutdown_on_exit': CallmoduleConfig.TRAY_TRIGGER_SHUTDOWN_ON_EXIT
        }

        ColorPrint.blue("[ConfigBuilder] Added Windows tray service")

    # Create launcher configuration - from callmodule_config/config.py
    config = LauncherConfig(
        app_id=CallmoduleConfig.LAUNCHER_APP_ID,
        app_name=CallmoduleConfig.LAUNCHER_APP_NAME,
        singleton=True,
        shutdown_existing=True,
        singleton_port_start=CallmoduleConfig.SINGLETON_PORT_START,
        singleton_port_range=CallmoduleConfig.SINGLETON_PORT_RANGE,
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
