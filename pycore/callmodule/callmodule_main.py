#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pycore callmodule native UI launcher composition."""

import argparse
from pathlib import Path

import pycore.pylauncher.register_providers  # noqa: F401
from pycore.pyctl.runtime.callmodule_config import Config
from pycore.pyctl.runtime.event_handlers import register_runtime_workers
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import HTTP_BIND_HOST, PYCORE_HTTP_PORT
from pycore.pyutils.native_ui.platform_adapter import get_platform_adapter
from pycore.pyutils.native_ui.step1_config.app_config import NativeUIConfig
from pycore.pyutils.native_ui.step2_port_url.port_allocator import register_port_range
from pycore.pyutils.native_ui.step3_launcher.launch_native_app import launch_native_app


PROJECT_ROOT = Path(__file__).parent.parent.parent


def callmodule_main_entry() -> None:
    """Register the shared Pyctl runtime workers."""
    ColorPrint.green("[Callmodule] Main entry initialized")
    register_runtime_workers()


def start(
    host: str = HTTP_BIND_HOST,
    port: int = PYCORE_HTTP_PORT,
    debug: bool = False,
):
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

    ColorPrint.green("[Callmodule] RPC v2 HTTP controllers via register_http_routes")

    # Register singleton port range (callmodule_config/config.py)
    # Same as pylauncher so only one instance runs via pycore_module_caller.py or callmodule_main.
    register_port_range(Config.APP_ID, Config.SINGLETON_PORT_START, Config.SINGLETON_PORT_RANGE)
    ColorPrint.blue(f"[Callmodule] Registered singleton port range: {Config.SINGLETON_PORT_START}-{Config.SINGLETON_PORT_START + Config.SINGLETON_PORT_RANGE - 1} (shared with pylauncher)")

    # Singleton: callmodule_main uses launch_native_app which runs SingletonDetector
    # with Config.APP_ID and port range 59100-59199 (see register_port_range below).
    # That matches pylauncher (root pycore_module_caller.py) so only one instance runs
    # regardless of entry (root script vs python -m pycore.callmodule.callmodule_main).
    # Get platform adapter for cross-platform configuration
    adapter = get_platform_adapter()
    adapter.print_platform_info()

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
    frontend_app_dir = Config.FRONTEND_DIR

    # Platform-specific configuration (using adapter)
    IS_WINDOWS = adapter.is_windows
    IS_LINUX = adapter.is_linux
    HAS_X11_DISPLAY = adapter.has_x11  # True if X11 display available (desktop mode)

    # Desktop vs Server mode detection
    # Desktop mode: Has GUI (X11 on Linux, always on Windows)
    # Server mode: No GUI (Linux without X11 display)
    IS_DESKTOP_MODE = adapter.has_gui
    IS_SERVER_MODE = not adapter.has_gui

    ColorPrint.blue(f"[Callmodule] Platform: {adapter.platform.value}")
    ColorPrint.blue(f"[Callmodule] Mode: {'DESKTOP' if IS_DESKTOP_MODE else 'SERVER (Background Only)'}")
    if IS_LINUX:
        ColorPrint.blue(f"[Callmodule] X11 Display: {HAS_X11_DISPLAY}")
        ColorPrint.yellow(f"[Callmodule] Linux: Running in BACKGROUND-ONLY mode (no GUI, no tray)")
    ColorPrint.blue(f"[Callmodule] Frontend: {frontend_app_dir}")
    ColorPrint.blue(f"[Callmodule] Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"[Callmodule] Show UI window: {IS_WINDOWS and IS_DESKTOP_MODE}")

    # Get platform-specific QtWebEngine flags (handles root/sandbox automatically)
    qtwebengine_flags = adapter.get_qtwebengine_flags(
        enable_webcodecs=True,
        enable_hardware_acceleration=True
    )
    ColorPrint.blue(f"[Callmodule] QtWebEngine flags configured (sandbox: {'disabled' if adapter.needs_sandbox_disable() else 'enabled'})")

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
        # Legacy FastAPI routers retired; RPC v2 HTTP controllers register in config.
        rpc_routers=[],
        rpc_allow_origins=Config.CORS_ALLOW_ORIGINS,
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration (Platform-specific) ==========
        # Windows: Show window (desktop mode)
        # Linux: No window (background/server mode only)
        window_size=(Config.WINDOW_WIDTH, Config.WINDOW_HEIGHT) if IS_DESKTOP_MODE else (1280, 800),
        show_on_start=IS_WINDOWS and IS_DESKTOP_MODE,  # Only show window on Windows
        frameless=Config.FRAMELESS if (IS_WINDOWS and IS_DESKTOP_MODE) else False,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration (Auto-detect based on platform and mode) ==========
        # Windows: Enable tray (desktop mode)
        # Linux: Disable tray (background/server mode only, no GUI)
        # Note: Linux runs in pure backend mode - no tray, no desktop window
        enable_tray=IS_WINDOWS,  # Only enable on Windows
        tray_type="pyside6",  # Use PySide6 backend (Windows only)

        # ========== Debug Window Configuration (from settings.yaml) ==========
        show_debug_window=IS_WINDOWS and IS_DESKTOP_MODE,
        debug_window_width=Config.DEBUG_WINDOW_WIDTH,
        debug_window_height=Config.DEBUG_WINDOW_HEIGHT,
        min_display_time=Config.MIN_DISPLAY_TIME,
        enable_language_selector=Config.ENABLE_LANGUAGE_SELECTOR,

        # ========== Advanced Options ==========
        force=False,
    )

    ColorPrint.green(f"[Callmodule] Configuration created")
    ColorPrint.blue(f"  - Platform: {'Windows' if IS_WINDOWS else 'Linux'}")
    ColorPrint.blue(f"  - Mode: {'DESKTOP' if IS_DESKTOP_MODE else 'SERVER (Background Only)'}")
    ColorPrint.blue(f"  - Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {Config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {port}")
    ColorPrint.blue(f"  - Backend host: {host}")
    ColorPrint.blue(f"  - Frontend dir: {frontend_app_dir}")
    ColorPrint.blue(f"  - Frontend framework: vite (React)")
    ColorPrint.blue(f"  - Show UI window: {IS_WINDOWS and IS_DESKTOP_MODE}")
    ColorPrint.blue(f"  - Show debug window: {IS_WINDOWS and IS_DESKTOP_MODE}")
    ColorPrint.blue(f"  - Enable tray: {IS_WINDOWS}")
    if IS_WINDOWS:
        native_tray_type = "tk" if adapter.get_recommended_tray_backend().value == "pystray" else "pyside6"
        ColorPrint.blue(f"  - Tray backend: {native_tray_type} (recommended: {adapter.get_recommended_tray_backend().value})")
    ColorPrint.blue("  - HTTP controllers: register_http_routes")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[Callmodule] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Callmodule] Application exited")


def main():
    """Alias for start() with defaults"""
    start()


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description="Pycore Callmodule with Native UI")
    parser.add_argument('--host', default=HTTP_BIND_HOST, help='Host to bind')
    parser.add_argument('--port', type=int, default=PYCORE_HTTP_PORT, help='Port to bind')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()
    start(host=args.host, port=args.port, debug=args.debug)

