#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Callmodule - Native UI Integration

Unified startup entry using NativeUIConfig pattern (same as Matrix).

Architecture:
- native_ui: Handles everything (frontend, RPC v2, PySide6 UI, tray, callbacks)
- Callmodule: Only provides configuration and event handlers

Platform-specific behavior:
- Windows: PySide6 UI window + system tray + frontend
- Linux: Background mode (frontend only, no UI window)

Usage:
    # Via pycore_module_caller.py (recommended)
    python pycore_module_caller.py

    # Direct
    python -m pycore.callmodule.callmodule_main
"""

import sys
import platform
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.callmodule.callmodule_config import Config

# Import all routers
# Management Layer (8 routers)
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

# Local Processing Layer (5 routers)
from pycore.callmodule.routers.local import (
    screenshot_router,
    image_router,
    audio_router,
    file_router,
    video_router,
)

# Upload Layer (1 router)
from pycore.callmodule.routers.upload import router as upload_router

# Client Layer (1 router)
from pycore.callmodule.routers.client import router as client_router

# Legacy Routers (4 routers)
from pycore.callmodule.routers.mcp_router import mcp_router
from pycore.callmodule.routers.code_sync_router import router as code_sync_router
from pycore.callmodule.routers.module_call_router import module_call_router
from pycore.callmodule.routers.notebooklm_stt_router import router as notebooklm_stt_router


def callmodule_main_entry():
    """
    Callmodule main entry point (called after native_ui initialization)

    Used to register event handlers and perform application-specific initialization.
    """
    ColorPrint.green("[Callmodule] Main entry initialized")

    # Register event handlers (from existing event_handlers.py)
    # Note: Event handlers will be registered via on_ready_callbacks instead


def start(host='0.0.0.0', port=59000, debug=False):
    """
    Unified startup entry point

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" PYCORE CALLMODULE - Native UI Integrated")
    ColorPrint.blue("=" * 70)

    # Update config with runtime parameters
    Config.RPC_HOST = host
    Config.RPC_PORT = port

    ColorPrint.green("[Callmodule] 19 routers available")

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Fallback icon if not found
    if not icon_path.exists():
        fallback_icon = PROJECT_ROOT / "pycore" / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
        if fallback_icon.exists():
            icon_path = fallback_icon
            ColorPrint.yellow(f"[Callmodule] Using fallback icon: {icon_path}")

    # Frontend project path
    frontend_app_dir = PROJECT_ROOT / "poly_apps" / "pycore-management"

    # Platform-specific configuration
    IS_WINDOWS = platform.system() == 'Windows'
    IS_LINUX = platform.system() == 'Linux'

    ColorPrint.blue(f"[Callmodule] Platform: {platform.system()}")
    ColorPrint.blue(f"[Callmodule] Frontend: {frontend_app_dir}")
    ColorPrint.blue(f"[Callmodule] Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"[Callmodule] Show UI window: {IS_WINDOWS}")

    # Create Native UI configuration
    config = NativeUIConfig(
        # ========== Basic Configuration ==========
        app_id=Config.APP_ID,
        app_name=Config.APP_DISPLAY_NAME,
        main_entry=callmodule_main_entry,
        project_root=PROJECT_ROOT,
        debug=debug,

        # ========== Frontend Configuration ==========
        frontend_enabled=True,
        frontend_framework="vite",  # Vite + React project
        frontend_app_dir=frontend_app_dir,
        frontend_mode=Config.FRONTEND_MODE,  # 'production' or 'dev'
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),  # Block in dev mode

        # ========== RPC v2 Configuration ==========
        rpc_enabled=True,
        rpc_port=port,
        rpc_host=host,
        rpc_debug=debug,
        rpc_routers=[
            # === Management Layer (8 routers) ===
            status_router,
            config_router,
            control_router,
            logs_router,
            capabilities_router,
            local_config_router,
            local_stats_router,
            local_test_router,
            # === Local Processing Layer (5 routers) ===
            screenshot_router,
            image_router,
            audio_router,
            file_router,
            video_router,
            # === Upload Layer (1 router) ===
            upload_router,
            # === Client Layer (1 router) ===
            client_router,
            # === Legacy Routers (4 routers) ===
            mcp_router,
            code_sync_router,
            module_call_router,
            notebooklm_stt_router,
        ],
        rpc_allow_origins=Config.CORS_ALLOW_ORIGINS,
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration (Platform-specific) ==========
        window_size=(Config.WINDOW_WIDTH, Config.WINDOW_HEIGHT) if IS_WINDOWS else (1280, 800),
        show_on_start=IS_WINDOWS,  # Windows: show window, Linux: background
        frameless=Config.FRAMELESS,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration (Windows only) ==========
        enable_tray=IS_WINDOWS,

        # ========== Debug Window Configuration ==========
        show_debug_window=True,
        debug_window_width=650,
        debug_window_height=500,
        min_display_time=2.0,
        enable_language_selector=True,

        # ========== Advanced Options ==========
        force=False,
    )

    ColorPrint.green(f"[Callmodule] Configuration created")
    ColorPrint.blue(f"  - Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {Config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {port}")
    ColorPrint.blue(f"  - Backend host: {host}")
    ColorPrint.blue(f"  - Frontend dir: {frontend_app_dir}")
    ColorPrint.blue(f"  - Frontend framework: vite (React)")
    ColorPrint.blue(f"  - Enable tray: {IS_WINDOWS}")
    ColorPrint.blue(f"  - Total routers: 19")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[Callmodule] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Callmodule] Application exited")


def main():
    """Alias for start() with defaults"""
    start()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Pycore Callmodule with Native UI")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind (default: 59000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()
    start(host=args.host, port=args.port, debug=args.debug)
