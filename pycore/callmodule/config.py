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
from pycore.callmodule.tray_menu import build_tray_menu, tray_menu_to_dicts
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

# Web UI routes (homepage, /web, /web/subtitle redirect, favicon)
from pycore.callmodule.routers.web_router import router as web_router

# Voice subtitle API (queue, add-text/image/voice, audio, categories, tasks,
# clipboard/screenshot monitors) — consumed by the desktop UI at /voice-subtitle/*
from pycore.callmodule.routers.voice_subtitle_router import router as voice_subtitle_router

IS_WINDOWS = platform.system() == 'Windows'


def _resolve_tray_icon_path():
    """Resolve the tray icon absolute path, or None if the file is missing."""
    pycore_root = Path(__file__).parent.parent
    icon_path = pycore_root / CallmoduleConfig.TRAY_ICON_PATH_REL
    return str(icon_path) if icon_path.exists() else None


def build_tray_service_config(port: int, singleton_port: int = None) -> dict:
    """
    Build the pystray tray service config dict.

    The native Qt tray (in the UI thread) is the default; this config is only
    used for the pystray fallback, started on demand when no system tray is
    available (THREAD_BUS event 'tray.native_unavailable').
    """
    return {
        'app_name': CallmoduleConfig.TRAY_APP_NAME,
        'app_id': CallmoduleConfig.UI_APP_ID,
        'icon_path': _resolve_tray_icon_path(),
        'menu_items': build_tray_menu(port=port, singleton_port=singleton_port),
        'trigger_shutdown_on_exit': CallmoduleConfig.TRAY_TRIGGER_SHUTDOWN_ON_EXIT,
        # Selects the independent native backend: win32 (Windows) / AppIndicator
        # (Ubuntu). "pystray" forces the cross-platform fallback.
        'backend': CallmoduleConfig.TRAY_BACKEND,
    }


def _init_rpc_routes(server):
    """
    Register the RPC routes/listeners the desktop UI needs over WebSocket.

    Restores the WS bridge the original create_rpc_server() provided: the web UI
    issues `rpcClient.call('thread_bus.trigger_event', {event_name, event_data})`
    (e.g. for subtitle fullscreen mode), which must be turned into a real
    THREAD_BUS event server-side. Also broadcasts voice-subtitle state changes to
    connected WS clients for real-time UI refresh.

    Called by start_rpc_v2 with the FastAPIRPCServer instance after start.
    """
    async def thread_bus_trigger_event(params, request_id, context):
        params = params or {}
        event_name = params.get('event_name')
        event_data = params.get('event_data', {})
        if not event_name:
            return {'success': False, 'error': 'event_name required'}
        THREAD_BUS.trigger_event(event_name, event_data)
        return {'success': True, 'event': event_name}

    try:
        server.route(
            name='thread_bus.trigger_event',
            handler=thread_bus_trigger_event,
            sync=False,
            description='Trigger a THREAD_BUS event from the web UI',
        )
        for ev in ('voice_subtitle_update', 'voice_subtitle_ui_show', 'voice_subtitle_ui_hide'):
            server.register_thread_bus_listener(ev)
        ColorPrint.green("[ConfigBuilder] Registered RPC WS bridge (thread_bus.trigger_event + broadcasts)")
    except Exception as e:
        ColorPrint.yellow(f"[ConfigBuilder] Failed to register RPC WS bridge: {e}")


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

    # RPC v2 JavaScript client (defines FastAPIWsRpcClient used by the desktop UI
    # via <script src="/js/rpc/ws_rpc_client.js">)
    RPC_CLIENT_DIR = PYCORE_ROOT / "pyutils" / "rpc_v2" / "client"
    if RPC_CLIENT_DIR.exists():
        static_mounts.append({
            'url_prefix': '/js/rpc',
            'directory': str(RPC_CLIENT_DIR),
            'name': 'rpc_client_js'
        })
        ColorPrint.blue(f"[ConfigBuilder] Added static mount: /js/rpc -> {RPC_CLIENT_DIR}")

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

                # === Web UI Routes ===
                web_router,              # Homepage, /web, /web/subtitle redirect, favicon

                # === Voice Subtitle API (desktop UI backend) ===
                voice_subtitle_router,   # /voice-subtitle/* queue, TTS add, audio, monitors
            ],
            'static_mounts': static_mounts,  # Mount static files
            'init_callback': _init_rpc_routes,  # Register WS RPC bridge (thread_bus.trigger_event)
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
            'icon_path': _resolve_tray_icon_path(),  # PY logo for window + taskbar
            # The Voice Subtitle window lives in the tray: close/minimize hide it
            # back to the tray instead of quitting (tray "Exit" is the real quit).
            'minimize_to_tray': True,
            'close_to_tray': True,
            'enable_tray': CallmoduleConfig.UI_ENABLE_TRAY,
            # PySide6 Qt tray menu (only built when TRAY_BACKEND == "pyside"; the
            # native pystray tray builds its own menu in the 'tray' service).
            # Singleton port is appended later via update_tray_menu_with_singleton().
            'tray_icon_path': _resolve_tray_icon_path() if CallmoduleConfig.UI_ENABLE_TRAY else None,
            'tray_menu_items': tray_menu_to_dicts(build_tray_menu(port=port)) if CallmoduleConfig.UI_ENABLE_TRAY else [],
            'enable_webview': True,
            'enable_dev_tools': debug,
            'debug': debug,
            'show_startup': CallmoduleConfig.UI_SHOW_STARTUP,
            'auto_close_startup': CallmoduleConfig.UI_AUTO_CLOSE_STARTUP,
            'cache_window_state': False,
        }

    # Native tray (default): independent pystray service, started before/without
    # PySide6. Used unless TRAY_BACKEND == "pyside" (then the Qt tray in the UI
    # thread is used instead). The PySide6 tray code is kept and gated by config.
    if IS_WINDOWS and not CallmoduleConfig.UI_ENABLE_TRAY:
        services['tray'] = build_tray_service_config(port=port)
        ColorPrint.blue(f"[ConfigBuilder] Added independent tray service (backend={CallmoduleConfig.TRAY_BACKEND})")
    elif IS_WINDOWS:
        ColorPrint.blue("[ConfigBuilder] Using PySide6 Qt tray (TRAY_BACKEND=pyside)")

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
    Update tray menu with singleton port info.

    Emits a 'tray.update_menu' event (canonical dict menu) that the native Qt
    tray (PySide6 framework) listens for and rebuilds in the Qt main thread.

    Args:
        launcher: ServiceLauncher instance (unused; kept for call-site compatibility)
        port: RPC v2 server port
        singleton_port: Singleton port
    """
    if not IS_WINDOWS:
        return

    # Backend-aware payload: the pystray tray consumes TrayMenuItem objects, while
    # the PySide6 Qt tray consumes canonical dicts. Both listen to 'tray.update_menu'
    # but only one backend runs at a time (selected by TRAY_BACKEND).
    menu = build_tray_menu(port=port, singleton_port=singleton_port)
    if CallmoduleConfig.UI_ENABLE_TRAY:
        payload = tray_menu_to_dicts(menu)  # PySide6 Qt tray
    else:
        payload = menu  # native pystray tray (TrayMenuItem objects)

    # Use THREAD_BUS event to update menu (thread-safe; framework marshals to Qt thread)
    THREAD_BUS.trigger_event('tray.update_menu', {'menu_items': payload})
    ColorPrint.blue("[ConfigBuilder] Tray menu update requested via THREAD_BUS")
