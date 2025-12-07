#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Simplified with Native UI Integration

Single entry point for Matrix application using integrated native_ui.
All services managed by native_ui: frontend compilation/dev server, RPC v2, and UI.

Architecture:
- native_ui: Handles everything (frontend, RPC v2, PySide6 UI, tray, callbacks)
- Matrix: Only provides configuration and event handlers

Usage:
    python pymain.py app=matrix
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pyapps.matrix.matrix_config import Config


def matrix_main_entry():
    """
    Matrix main entry point (called after native_ui initialization)

    Used to register event handlers and perform application-specific initialization.
    """
    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

    # Register Matrix event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )


def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - Native UI Integrated")
    ColorPrint.blue("=" * 70)

    # Import Matrix API routers
    from pyapps.matrix.api import (
        health_router,
        device_router,
        screen_router,
        file_router,
        recording_router,
        group_router,
        config_router,
        unified_ws_router
    )

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Frontend project path (Vite + React)
    frontend_app_dir = PROJECT_ROOT / "poly_apps" / "matrix_ui_react"

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
        rpc_routers=[
            health_router,
            device_router,
            screen_router,
            file_router,
            recording_router,
            group_router,
            config_router,
            unified_ws_router
        ],
        rpc_allow_origins=["*"],
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration ==========
        window_size=(1400, 900),
        show_on_start=True,
        frameless=True,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration ==========
        enable_tray=False,  # Matrix uses separate tray service

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
    ColorPrint.blue(f"  - Frontend dir: {frontend_app_dir}")
    ColorPrint.blue(f"  - Frontend framework: vite (React)")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[Matrix] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Matrix] Application exited")


def main():
    """Alias for start()"""
    start()


if __name__ == '__main__':
    main()
