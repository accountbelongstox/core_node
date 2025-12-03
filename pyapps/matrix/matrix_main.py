#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Main Entry Point

Single entry point for Matrix application.
All services managed by pylauncher, using shared RPC v2.

Architecture:
- RPC v2: Unified FastAPI backend (serves Matrix API + frontend static files)
- UI: PySide6 webview
- Tray: System tray
- Heartbeat: Global heartbeat system

Usage:
    python pymain.py app=matrix
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher.launcher import ServiceLauncher
from pyapps.matrix.matrix_config import Config
from pyapps.matrix.controller import (
    build_matrix_launcher_config,
    register_matrix_event_handlers,
    compile_frontend_if_needed
)


def start():
    """Standard entry point for pymain.py launcher"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION")
    ColorPrint.blue("=" * 70)

    # Step 1: Compile frontend if needed (production mode only)
    if Config.FRONTEND_MODE == 'production':
        compile_frontend_if_needed(
            project_root=PROJECT_ROOT,
            skip_build=Config.FRONTEND_SKIP_BUILD,
            force_rebuild=Config.FRONTEND_FORCE_REBUILD
        )
    else:
        ColorPrint.yellow("[Matrix] Dev mode: frontend compilation skipped")
        ColorPrint.yellow("[Matrix] Make sure to run 'npm run dev' manually")

    # Step 2: Build launcher configuration
    launcher_config = build_matrix_launcher_config(
        project_root=PROJECT_ROOT,
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

    ColorPrint.blue(f"[Matrix] Services: {', '.join(launcher_config.services.keys())}")

    # Step 3: Create and start launcher
    launcher = ServiceLauncher(launcher_config)
    success = launcher.start()

    if not success:
        ColorPrint.red("[Matrix] Failed to start services")
        return

    # Step 4: Register event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

    # Keep application running
    ColorPrint.green("[Matrix] Application running. Press Ctrl+C to stop.")

    try:
        while not THREAD_BUS.is_shutdown_requested():
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[Matrix] Keyboard interrupt received")

    ColorPrint.yellow("[Matrix] Shutting down...")
    launcher.stop()


def main():
    """Alias for start()"""
    start()


if __name__ == '__main__':
    main()
