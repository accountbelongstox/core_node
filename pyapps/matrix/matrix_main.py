#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Simplified Entry Point

Usage:
    python pymain.py app=matrix
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app, TrayMenuItem
from pyapps.matrix.controller import MatrixService, MatrixServiceConfig
from pyapps.matrix.config import Config


# Matrix service reference for cleanup
matrix_service_ref = [None]


def main_app_entry():
    """Start Matrix services (Frontend + Backend)"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX - STARTING SERVICES")
    ColorPrint.blue("=" * 70)

    # Create Matrix service configuration
    matrix_config = MatrixServiceConfig(
        project_root=PROJECT_ROOT,
        frontend_port=Config.FRONTEND_PORT,
        frontend_timeout=120,
        backend_host=Config.WEB_HOST,
        backend_port=Config.WEB_PORT,
        backend_mode=Config.MODE,
        enable_ui=True,
        enable_tray=True,
        enabled=True
    )

    # Create and start Matrix service
    ColorPrint.green("Starting Matrix service...")
    matrix_service = MatrixService(matrix_config)
    matrix_service_ref[0] = matrix_service

    matrix_service.start()
    ColorPrint.yellow("Waiting for services to initialize...")
    time.sleep(5)


def on_closing():
    """Cleanup callback when app closes"""
    from pycore.pyutils.native_ui import get_i18n_manager
    i18n = get_i18n_manager()
    ColorPrint.yellow(f"[Matrix] {i18n.get('matrix.closing')}")
    if matrix_service_ref[0]:
        matrix_service_ref[0].stop()


def _open_browser(url):
    """Open URL in default browser"""
    import webbrowser
    webbrowser.open(url)
    ColorPrint.blue(f"[Matrix] Opened in browser: {url}")


def start():
    """Standard entry point for pymain.py launcher"""
    # Icon and logo paths
    icon_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")

    # Get i18n manager for tray menu text
    from pycore.pyutils.native_ui import get_i18n_manager
    i18n = get_i18n_manager()

    # Tray menu items
    tray_menu = [
        {"text": i18n.get("matrix.tray.open_frontend"),
         "callback": lambda: _open_browser(f"http://localhost:{Config.FRONTEND_PORT}")},
        {"text": i18n.get("matrix.tray.open_api_docs"),
         "callback": lambda: _open_browser(f"http://{Config.WEB_HOST}:{Config.WEB_PORT}/docs")},
    ]

    # Create simplified configuration
    config = NativeUIConfig(
        app_id="matrix",
        app_name=i18n.get("matrix.app_name"),
        main_entry=main_app_entry,
        url=f"http://localhost:{Config.FRONTEND_PORT}",
        project_root=PROJECT_ROOT,
        icon_path=icon_path,
        enable_tray=True,
        enable_timer=False,
        tray_menu_items=tray_menu,
        on_closing_callbacks=[on_closing],
        debug_window_width=650,
        debug_window_height=500,
        window_size=(1400, 900),
        enable_language_selector=True
    )

    # Launch with simplified API
    launch_native_app(config)


def main():
    """Alias for start() - supports both entry point patterns"""
    start()


if __name__ == '__main__':
    main()
