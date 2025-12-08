#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - RPC v2 WebSocket Edition

Simplified entry point that only organizes configuration variables.
All API routes are managed by api/main.py and registered via pylauncher.

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
from pyapps.matrix.matrix_config import Config
from pyapps.matrix.adb_device_manager import ADBHeartbeatThread


_adb_heartbeat_thread = None
_rpc_server = None  # Global RPC server instance


def get_adb_heartbeat_thread():
    """Get the global ADB heartbeat thread instance"""
    return _adb_heartbeat_thread


def get_rpc_server():
    """Get the global RPC server instance"""
    return _rpc_server


def matrix_main_entry():
    """
    Matrix main entry point (called after native_ui initialization)

    Used to register event handlers and perform application-specific initialization.
    """
    global _adb_heartbeat_thread

    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

    # Register Matrix event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

    ColorPrint.green("[Matrix] Event handlers registered successfully")

    # Start ADB Device Management Heartbeat
    ColorPrint.blue("[Matrix] Starting ADB Device Management Heartbeat...")
    _adb_heartbeat_thread = ADBHeartbeatThread(
        adb_path="adb",
        tick_interval=1.0,
        network_scan_interval=30.0,
        usb_scan_interval=5.0,
        cleanup_interval=60.0,
        heartbeat_interval=10.0,
        daemon=True
    )
    _adb_heartbeat_thread.start()
    ColorPrint.green("[Matrix] ADB Heartbeat Thread started")

    # Register shutdown handler for ADB heartbeat
    def stop_adb_heartbeat():
        ColorPrint.blue("[Matrix] Stopping ADB Heartbeat Thread...")
        if _adb_heartbeat_thread and _adb_heartbeat_thread.is_running():
            _adb_heartbeat_thread.stop()
            _adb_heartbeat_thread.join(timeout=5.0)
            ColorPrint.green("[Matrix] ADB Heartbeat Thread stopped")

    THREAD_BUS.register_shutdown_handler(
        handler=stop_adb_heartbeat,
        priority=90,
        name="adb_heartbeat"
    )

    ColorPrint.blue("[Matrix] ADB Device Manager initialized")

    # Initialize Device Push Service (now that ADB heartbeat is running)
    from pyapps.matrix.adb_device_manager.device_push_service import init_device_push_service, stop_device_push_service

    if _rpc_server and _adb_heartbeat_thread:
        ColorPrint.blue("[Matrix] Starting Device Push Service...")
        device_push_service = init_device_push_service(
            adb_heartbeat_thread=_adb_heartbeat_thread,
            rpc_server=_rpc_server,
            push_interval=10.0  # Push device list every 10 seconds
        )
        ColorPrint.green(f"[Matrix] Device Push Service started (interval: 10.0s)")

        # Register shutdown handler for device push service
        def stop_device_push():
            ColorPrint.blue("[Matrix] Stopping Device Push Service...")
            stop_device_push_service()
            ColorPrint.green("[Matrix] Device Push Service stopped")

        THREAD_BUS.register_shutdown_handler(
            handler=stop_device_push,
            priority=85,  # Stop before ADB heartbeat (priority 90)
            name="device_push_service"
        )
    else:
        if not _rpc_server:
            ColorPrint.yellow("[Matrix] Warning: RPC server not available, device push service not started")
        elif not _adb_heartbeat_thread:
            ColorPrint.yellow("[Matrix] Warning: ADB heartbeat not running, device push service not started")


def rpc_init_callback(rpc_server):
    """
    RPC v2 initialization callback

    This function is called by pylauncher after RPC v2 server is created.
    It registers all Matrix routes to the RPC v2 server instance.
    The Device Push Service will be initialized later in matrix_main_entry()
    after ADB heartbeat is running.

    Args:
        rpc_server: RPC v2 server instance (FastAPIRPCServer)
    """
    global _rpc_server

    # Save RPC server instance for later use in matrix_main_entry
    _rpc_server = rpc_server

    from pyapps.matrix.api.main import register_all_routes

    # Register all Matrix RPC v2 routes
    register_all_routes(rpc_server)


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
