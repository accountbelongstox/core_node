#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - RPC v2 WebSocket Edition (Unified Heartbeat)

Simplified entry point that only organizes configuration variables.
All API routes are managed by api/main.py and registered via pylauncher.

NEW: ADB device management uses callback registration with interval interceptor.
No more periodic tasks or independent threads.

Usage:
    python pymain.py app=matrix
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.pyheartbeat import get_heartbeat_system
from pyapps.matrix.matrix_config import Config
from pyapps.matrix.adb_device_manager.adb_heartbeat_service import init_adb_heartbeat_service, get_adb_heartbeat_service


_adb_service = None
_rpc_server = None  # Global RPC server instance


def get_adb_service():
    """Get the global ADB service instance"""
    return _adb_service


def get_rpc_server():
    """Get the global RPC server instance"""
    return _rpc_server


def matrix_main_entry():
    """
    Matrix main entry point (called after native_ui initialization)

    NEW ARCHITECTURE:
    - No independent threads
    - No periodic task generation
    - Direct callback registration to unified heartbeat
    - Callbacks use tick counter interceptor (30s = skip 29 ticks, run on 30th)
    """
    global _adb_service

    # Extend i18n with Matrix app translations (uses global i18n object)
    # This allows startup window language selector to work with Matrix translations
    ColorPrint.blue("[Matrix] Extending i18n with Matrix app translations...")
    app_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(app_dir), app_name="matrix")
    ColorPrint.green("[Matrix] i18n extended successfully")

    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

    # Register Matrix event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

    ColorPrint.green("[Matrix] Event handlers registered successfully")

    # Initialize ADB Heartbeat Service (not a thread)
    ColorPrint.blue("[Matrix] Initializing ADB Heartbeat Service...")
    _adb_service = init_adb_heartbeat_service(adb_path="adb")

    # Attach RPC server if available
    if _rpc_server:
        _adb_service.set_rpc_server(_rpc_server)
        ColorPrint.green("[Matrix] RPC server attached to ADB service")

    # Register callbacks to unified heartbeat (using tick counter interceptor)
    # Note: ADBHeartbeatService is NOT a thread - it's driven by heartbeat callbacks
    heartbeat = get_heartbeat_system()

    heartbeat.register_callback(
        name='adb_network_scan',
        callback=lambda: _adb_service._network_scan_task(),
        interval=30  # 30 seconds (30 ticks)
    )

    heartbeat.register_callback(
        name='adb_usb_scan',
        callback=lambda: _adb_service._usb_scan_task(),
        interval=5  # 5 seconds (5 ticks)
    )

    heartbeat.register_callback(
        name='adb_cleanup',
        callback=lambda: _adb_service._cleanup_task(),
        interval=60  # 60 seconds (60 ticks)
    )

    heartbeat.register_callback(
        name='adb_heartbeat',
        callback=lambda: _adb_service._heartbeat_task(),
        interval=10  # 10 seconds (10 ticks)
    )

    heartbeat.register_callback(
        name='adb_push_devices',
        callback=lambda: _adb_service._push_device_updates(),
        interval=10  # 10 seconds (10 ticks)
    )

    ColorPrint.green("[Matrix] ADB callbacks registered to unified heartbeat")
    ColorPrint.blue("[Matrix] ADB Device Manager initialized (callback driven)")


def rpc_init_callback(rpc_server):
    """
    RPC v2 initialization callback

    This function is called by pylauncher after RPC v2 server is created.
    It registers all Matrix routes to the RPC v2 server instance.

    Args:
        rpc_server: RPC v2 server instance (FastAPIRPCServer)
    """
    global _rpc_server

    # Save RPC server instance for later use in matrix_main_entry
    _rpc_server = rpc_server

    from pyapps.matrix.api.main import register_all_routes
    from pyapps.matrix.api.video_websocket_routes import router as video_router

    # Register all Matrix RPC v2 routes
    register_all_routes(rpc_server)

    # Register video WebSocket routes (direct FastAPI routes, not RPC)
    ColorPrint.blue("[Matrix] Registering video WebSocket routes...")
    fastapi_app = rpc_server.app  # Get underlying FastAPI app

    ColorPrint.yellow(f"[Matrix] FastAPI app type: {type(fastapi_app)}")
    ColorPrint.yellow(f"[Matrix] Video router type: {type(video_router)}")
    ColorPrint.yellow(f"[Matrix] Video router routes: {[r.path for r in video_router.routes]}")

    fastapi_app.include_router(video_router)

    ColorPrint.yellow(f"[Matrix] After include_router, total routes: {len(fastapi_app.routes)}")
    ColorPrint.yellow(f"[Matrix] All route paths: {[r.path for r in fastapi_app.routes]}")

    ColorPrint.green("[Matrix] ✓ Video WebSocket routes registered:")
    ColorPrint.green("  - ws://localhost:48000/video/{device_id} (H.264)")
    ColorPrint.green("  - ws://localhost:48000/video/yuv/{device_id} (YUV420P)")

    ColorPrint.blue("[Matrix] RPC v2 routes registered successfully")


def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - RPC v2 WebSocket Edition")
    ColorPrint.blue("=" * 70)

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Frontend project path (Vite + React)
    frontend_app_dir = PROJECT_ROOT / "poly_apps" / "matrixui"

    # Create Native UI configuration (integrates all features)
    config = NativeUIConfig(
        # ========== Basic Configuration ==========
        app_id="matrix",
        app_name="Xingcan Media - Cloud Matrix",
        main_entry=matrix_main_entry,
        project_root=PROJECT_ROOT,
        debug=True,

        # ========== Frontend Configuration ==========
        frontend_enabled=True,
        frontend_framework="vite",  # Vite + React project
        frontend_app_dir=frontend_app_dir,
        frontend_mode=Config.FRONTEND_MODE,  # 'production' or 'dev'
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),

        # ========== RPC v2 Configuration ==========
        rpc_enabled=True,
        rpc_port=Config.WEB_PORT,
        rpc_host=Config.WEB_HOST,
        rpc_debug=True,
        rpc_routers=[],  # No FastAPI routers - using RPC v2 WebSocket routes
        rpc_init_callback=rpc_init_callback,  # Callback to register Matrix routes
        rpc_allow_origins=["*"],
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration ==========
        window_size="fullscreen",  # 全屏启动 (可选: (1400, 900) 或 "fullscreen")
        show_on_start=True,
        frameless=True,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration ==========
        enable_tray=True,  # Enable debug window tray (persists after window closes)

        # ========== Debug Window Configuration ==========
        show_debug_window=True,
        debug_window_width=650,
        debug_window_height=500,
        min_display_time=2.0,
        enable_language_selector=True,

        # ========== Advanced Options ==========
        force=False,
    )

    ColorPrint.green(f"[Matrix] Configuration created")
    ColorPrint.blue(f"  - Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {Config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {Config.WEB_PORT}")
    ColorPrint.blue(f"  - Backend protocol: RPC v2 WebSocket")
    ColorPrint.blue(f"  - WebSocket endpoint: ws://localhost:{Config.WEB_PORT}/rpc/ws")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[Matrix] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Matrix] Application exited")


def main():
    """Alias for start()"""
    start()


if __name__ == '__main__':
    main()
