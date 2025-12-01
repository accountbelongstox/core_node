#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Unified Entry Point

Uses pylauncher to manage all services:
- heartbeat: System heartbeat
- matrix_service: Custom service for frontend + backend lifecycle
- rpc_v2: FastAPI backend API
- ui: PySide6 webview
- tray: System tray

Usage:
    python pymain.py app=matrix
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher.launcher import ServiceLauncher
from pycore.pythreadpool import SERVICE_STARTERS
from pyapps.matrix.config import Config
from pyapps.matrix.launcher_config import build_matrix_launcher_config
from pyapps.matrix.matrix_service_starter import start_matrix_service
from pyapps.matrix.event_handlers import register_matrix_event_handlers


def start():
    """Standard entry point for pymain.py launcher"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION")
    ColorPrint.blue("=" * 70)

    # Register custom matrix_service starter (dynamically, not in pycore)
    SERVICE_STARTERS['matrix_service'] = start_matrix_service
    ColorPrint.blue("[Matrix] Registered custom matrix_service starter")

    # Build launcher configuration
    launcher_config = build_matrix_launcher_config(
        project_root=PROJECT_ROOT,
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST
    )

    # Add matrix_service to services (before launcher starts)
    launcher_config.services['matrix_service'] = {
        'project_root': PROJECT_ROOT,
        'frontend_port': Config.FRONTEND_PORT,
        'frontend_timeout': 120,
        'backend_host': Config.WEB_HOST,
        'backend_port': Config.WEB_PORT,
        'backend_mode': Config.MODE,
    }

    ColorPrint.blue(f"[Matrix] Final services: {', '.join(launcher_config.services.keys())}")

    # Create and start launcher
    launcher = ServiceLauncher(launcher_config)
    success = launcher.start()

    if not success:
        ColorPrint.red("[Matrix] Failed to start services")
        return

    # Register event handlers (after launcher starts)
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST
    )

    # Keep application running
    ColorPrint.green("[Matrix] Application running. Press Ctrl+C to stop.")

    try:
        # Keep main thread alive (services run in background)
        import time
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
