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
from pycore.pyutils.shortcut_manager import ShortcutManager
from pycore.pyutils.appusermodelid_manager import set_app_user_model_id, get_recommended_app_id
from pyapps.matrix.matrix_config import Config
from pyapps.matrix.adb_device_manager.adb_heartbeat_service import get_adb_heartbeat_service


_adb_service = None
_rpc_server = None  # Global RPC server instance

# Matrix AppUserModelID (prevents duplicate taskbar icons when running as admin)
# Format: CompanyName.ProductName.SubProduct
# Must be consistent across shortcut and application
MATRIX_APP_USER_MODEL_ID = "XingcanMedia.Matrix.Cloud"


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
    - Three-phase initialization pattern (prerequisite-based)
    - No independent threads
    - No periodic task generation
    - Direct callback registration to unified heartbeat
    - Callbacks use tick counter interceptor (30s = skip 29 ticks, run on 30th)

    Note: i18n is already extended in start() function before this is called
    """
    global _adb_service

    # i18n is already extended in start() function
    # No need to extend again here

    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers
    from pyapps.matrix.core.initialization_manager import get_initialization_manager

    # ========== Get Initialization Manager ==========
    init_manager = get_initialization_manager()

    # ========== PHASE 1: Global Tools Initialization ==========
    # Initialize scrcpy, adb, and scrcpy-server.jar BEFORE any device scanning
    phase1_result = init_manager.initialize_phase1_global_tools()
    paths = phase1_result['scrcpy_paths']

    # Register Matrix event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )
    ColorPrint.green("[Matrix] Event handlers registered successfully")

    # ========== PHASE 2: Core Services Initialization ==========
    # Force instantiate all lazy-loaded singletons and establish service coordination
    services = init_manager.initialize_phase2_core_services(rpc_server=_rpc_server)

    # ========== PHASE 3: ADB Service Initialization ==========
    # Initialize ADB Heartbeat Service (callback driven, not a thread)
    adb_path = str(paths['adb']) if paths['adb'] else Config.get_adb_path()
    ColorPrint.blue(f"[Matrix] Using ADB path: {adb_path}")
    _adb_service = init_manager.initialize_phase3_adb_service(
        adb_path=adb_path,
        rpc_server=_rpc_server
    )

    # ========== PHASE 4: Register Heartbeat Callbacks ==========
    # Register callbacks to unified heartbeat (using tick counter interceptor)
    # Note: ADBHeartbeatService is NOT a thread - it's driven by heartbeat callbacks
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[Matrix] Phase 4: Registering heartbeat callbacks...")
    ColorPrint.blue("=" * 80)

    heartbeat = get_heartbeat_system()

    # ADB service callbacks
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

    # Video stream health check callback
    heartbeat.register_callback(
        name='video_stream_health_check',
        callback=lambda: services['video_health'].check_all_devices(),
        interval=10  # 10 seconds (10 ticks)
    )

    ColorPrint.green("[Matrix] ✓ ADB callbacks registered to unified heartbeat")
    ColorPrint.green("[Matrix] ✓ Video stream health check registered to unified heartbeat")
    ColorPrint.green("=" * 80)
    ColorPrint.green("[Matrix] ✓ All initialization complete - System ready")
    ColorPrint.green("=" * 80)


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


def ensure_desktop_shortcut():
    """
    Ensure Matrix desktop shortcut exists with localized name

    Shortcut name is automatically localized based on system language:
    - English (en): "Matrix Cloud"
    - Chinese (zh): "星灿传媒云矩阵"

    Old shortcuts with different names will be automatically cleaned up.

    AppUserModelID is set to prevent duplicate taskbar icons when
    running as administrator.
    """
    try:
        ColorPrint.blue("[Matrix] Checking desktop shortcut...")
        manager = ShortcutManager()

        # Get paths
        app_dir = Path(__file__).parent
        resources_dir = app_dir / "resources"

        # Define all possible shortcut names (for cleanup)
        # This includes all language variations to clean up old shortcuts
        ALL_POSSIBLE_NAMES = [
            "Matrix Cloud",           # English
            "星灿传媒云矩阵",          # Chinese (simplified)
            "Xingcan Media - Cloud Matrix",  # Old English variant
        ]

        # Create/update shortcut with i18n support, cleanup, and AppUserModelID
        # The shortcut name and description will be automatically localized
        # based on the current language setting in i18n manager
        # Old shortcuts with different names will be removed
        # AppUserModelID prevents duplicate taskbar icons when running as admin
        manager.ensure_shortcut(
            name="Matrix Cloud",  # Fallback name (if i18n not available)
            command=f'python "{PROJECT_ROOT / "pymain.py"}" app=matrix',
            icon_search_dir=resources_dir,
            working_dir=PROJECT_ROOT,
            description="Launch Matrix Cloud - Android Device Manager",  # Fallback description
            i18n_name_key="matrix.shortcut.name",  # Localized name key
            i18n_description_key="matrix.shortcut.description",  # Localized description key
            cleanup_old_names=ALL_POSSIBLE_NAMES,  # Clean up old language versions
            app_user_model_id=MATRIX_APP_USER_MODEL_ID  # Prevent duplicate taskbar icons
        )
        ColorPrint.green("[Matrix] ✓ Desktop shortcut ready")
    except Exception as e:
        ColorPrint.yellow(f"[Matrix] Warning: Could not create desktop shortcut: {e}")


def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - RPC v2 WebSocket Edition")
    ColorPrint.blue("=" * 70)

    # Check multimedia environment (FFmpeg) FIRST
    from pyapps.matrix.matrix_config.multimedia_check import check_multimedia_environment
    check_multimedia_environment()

    # Set AppUserModelID for current process
    # This must match the AppUserModelID set on desktop shortcut
    # Prevents duplicate taskbar icons when running as administrator
    ColorPrint.blue(f"[Matrix] Setting AppUserModelID: {MATRIX_APP_USER_MODEL_ID}")
    if set_app_user_model_id(MATRIX_APP_USER_MODEL_ID):
        ColorPrint.green("[Matrix] ✓ AppUserModelID set for current process")
    else:
        ColorPrint.yellow("[Matrix] ⚠ Failed to set AppUserModelID (non-Windows or error)")

    # Extend i18n with Matrix app translations BEFORE creating shortcut
    # This ensures the shortcut name is localized based on system language
    ColorPrint.blue("[Matrix] Extending i18n for shortcut localization...")
    app_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(app_dir), app_name="matrix")
    current_lang = i18n.get_current_language()
    ColorPrint.green(f"[Matrix] i18n extended successfully (current language: {current_lang})")

    # Ensure desktop shortcut exists (now with localized name and AppUserModelID)
    ensure_desktop_shortcut()

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
        rpc_debug=True,  # ⚡ ENABLED for debugging batch startup issue
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

        # ========== QtWebEngine Configuration ==========
        webengine_enable_config=True,  # Enable multi-tier Chromium flags configuration
        webengine_disable_gpu_sandbox=True,  # Required for Windows hardware acceleration
        webengine_enable_webcodecs=True,  # Enable WebCodecs API for H.264 video decoding
        webengine_enable_hardware_acceleration=True,  # Enable GPU hardware acceleration
        webengine_enable_remote_debugging=True,  # Enable remote debugging (F12 dev tools)
        webengine_remote_debugging_port=9222,  # Dev tools at http://localhost:9222
        webengine_print_diagnostics=True,  # Print detailed diagnostic info on startup

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
