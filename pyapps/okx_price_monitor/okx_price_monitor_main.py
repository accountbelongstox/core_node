#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor - Pylauncher Edition

Unified entry point using pycore.pylauncher for frontend management

Usage:
    python pymain.py app=okx_price_monitor
    python pymain.py app=okx
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.pyutils.native_ui.step0_i18n import i18n
from pyapps.okx_price_monitor.core.monitor_config import monitor_config
from pyapps.okx_price_monitor.okx_frontend_config import frontend_config


_rpc_server = None  # Global RPC server instance


def get_rpc_server():
    """Get the global RPC server instance"""
    return _rpc_server


def okx_main_entry():
    """
    OKX main entry point (called after native_ui initialization)

    This is where you can initialize your business logic,
    register event handlers, start background services, etc.
    """
    from pyapps.okx_price_monitor.services.monitor_manager import get_monitor_manager

    ColorPrint.green("[OKX] Initializing price monitoring system...")

    # Get monitor manager
    manager = get_monitor_manager()

    # Initialize all coins
    ColorPrint.blue("[OKX] Loading coin data...")
    init_results = manager.initialize_all_coins()

    ColorPrint.green("[OKX] Initialization complete")
    ColorPrint.green(f"  Total Coins: {init_results['total_coins']}")
    ColorPrint.green(f"  Trackers Initialized: {init_results['trackers_initialized']}")

    # Start background monitoring
    ColorPrint.blue("[OKX] Starting background monitoring...")
    manager.start_monitoring()
    ColorPrint.green("[OKX] Background monitoring started")


def rpc_init_callback(rpc_server):
    """
    RPC v2 initialization callback

    This function is called by pylauncher after RPC v2 server is created.
    It registers all OKX routes to the RPC v2 server instance.

    Args:
        rpc_server: RPC v2 server instance (FastAPIRPCServer)
    """
    global _rpc_server

    # Save RPC server instance
    _rpc_server = rpc_server

    from pyapps.okx_price_monitor.api import register_monitor_routes
    from pyapps.okx_price_monitor.api.log_websocket import router as log_router

    # Register all OKX RPC v2 routes
    ColorPrint.blue("[OKX] Registering API routes...")
    register_monitor_routes(rpc_server)
    ColorPrint.green("[OKX] API routes registered successfully")

    # Register WebSocket routes for log streaming
    ColorPrint.blue("[OKX] Registering log WebSocket routes...")
    fastapi_app = rpc_server.app  # Get underlying FastAPI app
    fastapi_app.include_router(log_router)
    ColorPrint.green("[OKX] Log WebSocket routes registered:")
    ColorPrint.green("  - ws://localhost:58888/ws/logs")


def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" OKX PRICE MONITOR - Pylauncher Edition")
    ColorPrint.blue("=" * 70)

    # Extend i18n with OKX app translations
    ColorPrint.blue("[OKX] Extending i18n...")
    app_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(app_dir), app_name="okx_price_monitor")
    current_lang = i18n.get_current_language()
    ColorPrint.green(f"[OKX] i18n extended successfully (current language: {current_lang})")

    # Print frontend configuration
    frontend_config.print_info()

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Frontend project path (Vite + React)
    frontend_app_dir = frontend_config.FRONTEND_DIR

    # Create Native UI configuration
    config = NativeUIConfig(
        # ========== Basic Configuration ==========
        app_id="okx",
        app_name="OKX Price Monitor",
        main_entry=okx_main_entry,
        project_root=PROJECT_ROOT,
        debug=True,

        # ========== Frontend Configuration ==========
        frontend_enabled=True,
        frontend_framework="vite",  # Vite + React project
        frontend_app_dir=frontend_app_dir,
        frontend_mode=frontend_config.FRONTEND_MODE,  # 'production' or 'dev'
        frontend_port=frontend_config.FRONTEND_PORT,
        frontend_auto_install=frontend_config.FRONTEND_AUTO_INSTALL,
        frontend_skip_build=frontend_config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=(frontend_config.FRONTEND_MODE == "dev"),  # Wait for dev server in dev mode

        # ========== RPC v2 Configuration ==========
        rpc_enabled=True,
        rpc_port=monitor_config.WEB_PORT,  # 58888
        rpc_host=monitor_config.WEB_HOST,  # 0.0.0.0
        rpc_debug=monitor_config.DEBUG_MODE,
        rpc_routers=[],  # No FastAPI routers - using RPC v2 routes
        rpc_init_callback=rpc_init_callback,  # Callback to register OKX routes
        rpc_allow_origins=["*"],
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration ==========
        window_size=(1400, 900),  # Default window size
        show_on_start=True,
        frameless=False,  # Regular window with title bar
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration ==========
        enable_tray=True,  # Enable system tray

        # ========== Debug Window Configuration ==========
        show_debug_window=True,
        debug_window_width=650,
        debug_window_height=500,
        min_display_time=2.0,
        enable_language_selector=True,

        # ========== QtWebEngine Configuration ==========
        webengine_enable_config=True,
        webengine_disable_gpu_sandbox=True,
        webengine_enable_hardware_acceleration=True,
        webengine_enable_remote_debugging=True,
        webengine_remote_debugging_port=9223,  # Different from matrix
        webengine_print_diagnostics=True,

        # ========== Advanced Options ==========
        force=False,
    )

    ColorPrint.green(f"[OKX] Native UI configuration created")
    ColorPrint.blue(f"  - Frontend mode: {frontend_config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {frontend_config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {monitor_config.WEB_PORT}")
    ColorPrint.blue(f"  - Backend protocol: RPC v2")
    ColorPrint.blue(f"  - Window URL: {frontend_config.get_window_url()}")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[OKX] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[OKX] Application exited")


def main():
    """Alias for start()"""
    start()


if __name__ == '__main__':
    main()
