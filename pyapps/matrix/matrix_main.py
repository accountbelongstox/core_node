#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Standard Entry Point (Refactored with PySide6)

Entry point for pymain.py launcher system.
Uses PySide6 framework with startup window for initialization.

Usage:
    python pymain.py app=matrix

Flow:
    1. Show startup window (tkinter, Python native)
    2. Install dependencies
    3. Start services (Frontend + Backend)
    4. Launch PySide6 UI with WebView
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pylauncher import NativeUILauncher, LaunchMode

# Import matrix controllers (needed by main_app_entry)
from pyapps.matrix.controller import MatrixService, MatrixServiceConfig
from pyapps.matrix.matrix_config import create_ui_config


def main_app_entry():
    """
    Main application entry point (called after startup window closes)

    This function is called by NativeUILauncher after:
    - Startup window is shown
    - Dependencies are checked/installed
    - Startup window is closed

    Starts:
    - Frontend (Nuxt dev server)
    - Backend (FastAPI server)
    - PySide6 UI (webview showing frontend)
    - System tray menu
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX - STARTING SERVICES")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    # Store matrix service reference for cleanup
    matrix_service_ref = [None]

    try:
        # Import PySide6 components (after dependencies are installed)
        from pycore.pyutils.native_ui.pyside6 import (
            PySide6Framework,
            PySide6UIConfig,
            PySide6TrayMenuItem
        )

        # Import Matrix service
        from pyapps.matrix.controller.matrix_service import MatrixService
        from pyapps.matrix.config import Config

        # Create Matrix service configuration
        ColorPrint.blue("Creating Matrix service configuration...")
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
        ColorPrint.green("Starting Matrix service (Frontend + Backend)...")
        matrix_service = MatrixService(matrix_config)
        matrix_service_ref[0] = matrix_service  # Store for cleanup

        matrix_service.start()

        ColorPrint.yellow("Waiting for services to initialize...")
        time.sleep(5)

        # Create PySide6 UI
        ColorPrint.blue("\nCreating PySide6 UI...")

        # Helper function for opening browser
        def _open_browser(url):
            """Open URL in default browser"""
            import webbrowser
            webbrowser.open(url)
            ColorPrint.blue(f"[Matrix] Opened in browser: {url}")

        # Get i18n manager for tray menu text
        from pycore.pyutils.native_ui.i18n import get_i18n_manager
        i18n = get_i18n_manager()

        # Custom tray menu items (using i18n keys)
        def _tray_open_frontend():
            _open_browser(f"http://localhost:{matrix_config.frontend_port}")

        def _tray_open_api_docs():
            _open_browser(f"http://{matrix_config.backend_host}:{matrix_config.backend_port}/docs")

        tray_menu_items = [
            PySide6TrayMenuItem(
                text=i18n.get("matrix.tray.open_frontend"),
                callback=_tray_open_frontend
            ),
            PySide6TrayMenuItem(
                text=i18n.get("matrix.tray.open_api_docs"),
                callback=_tray_open_api_docs
            ),
        ]

        # Cleanup callback when app closes (using i18n, NO default value)
        def on_closing():
            """Called before window closes"""
            ColorPrint.yellow(f"[Matrix] {i18n.get('matrix.closing')}")
            if matrix_service_ref[0]:
                matrix_service_ref[0].stop()

        # Create PySide6 UI configuration
        ui_config = create_ui_config(
            frontend_port=matrix_config.frontend_port,
            tray_menu_items=tray_menu_items
        )

        # Set closing callback
        ui_config.on_closing = on_closing

        # Create PySide6 framework
        ColorPrint.blue("Creating PySide6 framework...")
        app = PySide6Framework(ui_config)

        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.green(f" {i18n.get('matrix.ready')}")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")
        ColorPrint.green(f"{i18n.get('matrix.services')}:")
        ColorPrint.white(f"  - {i18n.get('matrix.service_running')}: Running")
        ColorPrint.white(f"  - {i18n.get('matrix.frontend')}: http://localhost:{matrix_config.frontend_port}")
        ColorPrint.white(f"  - {i18n.get('matrix.backend_api')}: http://{matrix_config.backend_host}:{matrix_config.backend_port}")
        ColorPrint.white("")
        ColorPrint.yellow(i18n.get('matrix.close_window'))
        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")

        # Start PySide6 app (blocking)
        ColorPrint.green("[Matrix] Starting PySide6 UI...")
        app.start()  # Blocks until window is closed

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received, shutting down...")
        if matrix_service_ref[0]:
            matrix_service_ref[0].stop()
    except Exception as e:
        ColorPrint.red(f"\n[ERROR] Application error: {e}")
        import traceback
        traceback.print_exc()
        if matrix_service_ref[0]:
            matrix_service_ref[0].stop()


def start():
    """
    Standard entry point for pymain.py launcher

    Workflow:
    1. Initialize I18nManager (FIRST - before any text output)
    2. Shows startup window (tkinter - Python native)
    3. Checks/installs dependencies
    4. Closes startup window
    5. Calls main_app_entry() to start PySide6 UI
    """
    # STEP 1: Initialize i18n manager FIRST (before any UI text)
    from pycore.pyutils.native_ui.i18n import get_i18n_manager
    i18n = get_i18n_manager()

    # Initialize with Matrix's i18n directory
    matrix_i18n_dir = PROJECT_ROOT / "pyapps" / "matrix" / "matrix_i18n"
    if matrix_i18n_dir.exists():
        i18n.initialize(
            config_dir=str(matrix_i18n_dir),
            use_system_language=True  # Auto-detect system language
        )
        ColorPrint.blue(f"[Matrix] Initialized i18n with language: {i18n.get_current_language()}")
    else:
        ColorPrint.yellow(f"[Matrix] i18n directory not found: {matrix_i18n_dir}")
        # Create default config
        i18n._create_default_config()

    # STEP 2: Print startup banner (using i18n, NO default values)
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f" {i18n.get('matrix.app_name')} - STARTING")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    # Icon and logo paths
    icon_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")
    logo_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")

    try:
        # Create Native UI Launcher with singleton detection
        launcher = NativeUILauncher(
            app_id="matrix",
            port_start=54100,  # Matrix uses 54100-54199 range
            port_range=100,
            debug=True
        )

        # Launch with startup window and singleton detection (using i18n, NO default)
        result = launcher.launch(
            app_name=i18n.get("matrix.app_name"),
            main_entry=main_app_entry,
            mode=LaunchMode.DEBUG_WITH_TRAY,
            startup_width=650,
            startup_height=500,
            min_display_time=2.0,
            icon_path=icon_path,
            logo_path=logo_path,
            enable_language_selector=True,
            force=False  # Don't force shutdown existing instance
        )

        # Check launch result
        if not result.success:
            if result.existing_instance:
                ColorPrint.yellow("")
                ColorPrint.yellow("=" * 70)
                ColorPrint.yellow("Matrix is already running!")
                ColorPrint.yellow(f"Existing instance detected at port {result.existing_port}")
                ColorPrint.yellow("Please close the existing instance first.")
                ColorPrint.yellow("=" * 70)
            else:
                ColorPrint.red("")
                ColorPrint.red("=" * 70)
                ColorPrint.red(f"Failed to launch Matrix: {result.message}")
                ColorPrint.red("=" * 70)
            sys.exit(0)

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received, shutting down...")
    except Exception as e:
        ColorPrint.red(f"\n[ERROR] Startup error: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Alias for start() - supports both entry point patterns"""
    start()


if __name__ == '__main__':
    main()
