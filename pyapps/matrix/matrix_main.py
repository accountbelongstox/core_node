#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Standard Entry Point (Refactored with pylauncher)

Entry point for pymain.py launcher system.
Uses pylauncher for unified service management with native UI and system tray.

Usage:
    python pymain.py app=matrix
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pylauncher import UnifiedLauncher, LauncherConfig, UIServiceConfig
from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig, TrayMenuItem, ActionType, ActionContext

# Import matrix controllers
from pyapps.matrix.controller import (
    MatrixService,
    MatrixServiceConfig
)


def create_launcher_config() -> LauncherConfig:
    """
    Create launcher configuration for Matrix application

    Returns:
        Configured LauncherConfig instance
    """
    # Create launcher configuration with all default services disabled
    config = LauncherConfig(
        project_root=PROJECT_ROOT,
        auto_start_all=False,  # We'll start services manually
        startup_delay=0.5
    )

    # Disable all default services (we're using custom services)
    config.web_service.enabled = False
    config.mcp_service.enabled = False
    config.ui_service.enabled = False  # Don't use default UI service
    config.selenium_service.enabled = False

    return config


def create_matrix_service_config() -> MatrixServiceConfig:
    """
    Create Matrix service configuration

    Returns:
        Configured MatrixServiceConfig instance
    """
    from pyapps.matrix.config import Config

    return MatrixServiceConfig(
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


def start():
    """
    Standard entry point for pymain.py launcher

    Starts Matrix application with:
    - Frontend (Nuxt dev server)
    - Backend (FastAPI server)
    - Native UI (webview showing frontend)
    - System tray menu
    """
    # Filter out app=xxx arguments
    original_argv = sys.argv.copy()
    sys.argv = [arg for arg in sys.argv if not arg.startswith('app=')]

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - UNIFIED LAUNCHER")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    try:
        # Create launcher configuration
        launcher_config = create_launcher_config()
        launcher = UnifiedLauncher(launcher_config)

        # Create Matrix service configuration
        matrix_config = create_matrix_service_config()

        # Register Matrix service
        from pyapps.matrix.controller.matrix_service import matrix_service_entry

        ColorPrint.blue("Registering Matrix service...")
        launcher.register_custom_service(
            service_name='matrix_service',
            entry_point=matrix_service_entry,
            config=matrix_config,
            daemon=True
        )

        # Start Matrix service
        ColorPrint.blue("Starting Matrix service (Frontend + Backend)...")
        launcher.start_service('matrix_service')

        # Wait a moment for Matrix service to initialize
        ColorPrint.yellow("Waiting for Matrix service to initialize...")
        time.sleep(5)

        # Create UI in main thread (not as a service)
        ColorPrint.blue("\nStarting native UI in main thread...")

        # Reference to UI thread for tray menu callbacks
        ui_thread_ref = [None]  # Use list to allow mutation in closures

        # Helper function for opening browser
        def _open_browser(url):
            """Open URL in default browser"""
            import webbrowser
            webbrowser.open(url)
            ColorPrint.blue(f"[MatrixUI] Opened in browser: {url}")

        # Helper functions for custom tray menu (executed in tray thread)
        def _tray_open_frontend():
            """Open frontend in browser (safe cross-thread call)"""
            _open_browser(f"http://localhost:{matrix_config.frontend_port}")

        def _tray_open_api_docs():
            """Open API docs in browser (safe cross-thread call)"""
            _open_browser(f"http://{matrix_config.backend_host}:{matrix_config.backend_port}/docs")

        # Create custom tray menu items for Matrix
        # Note: Do NOT set default=True here, as the native "Show Window" is already default
        tray_menu_items = [
            TrayMenuItem(
                text="打开前端页面",
                callback=_tray_open_frontend  # Direct call OK for browser opening
            ),
            TrayMenuItem(
                text="打开API文档",
                callback=_tray_open_api_docs  # Direct call OK for browser opening
            ),
        ]

        # Create UI thread configuration with ui_source (URL for webview)
        ui_thread_config = NativeUIThreadConfig(
            app_name="Matrix - Android Device Control",
            width=1280,
            height=900,
            show_on_start=True,
            resizable=True,
            frameless=True,
            theme="dark",
            debug=False,
            # Pass frontend URL to native_ui for webview creation
            ui_source=f"http://localhost:{matrix_config.frontend_port}",
            # Enable system tray with menu items
            enable_tray=True,
            tray_menu_items=tray_menu_items,
            tray_tooltip="Matrix - Android Device Control",
            on_ready=lambda: ColorPrint.green("[MatrixUI] UI is ready!"),
            on_close=lambda: ColorPrint.yellow("[MatrixUI] UI is closing...")
        )

        # Create UI thread (will run in main thread)
        ui_thread = NativeUIThread(
            config=ui_thread_config,
            thread_name="MatrixUIThread"
        )

        # Store reference for tray menu callbacks
        ui_thread_ref[0] = ui_thread

        # Register action callbacks
        ColorPrint.blue("[MatrixUI] Registering action callbacks...")

        def cleanup_matrix_services(context: ActionContext):
            """
            Cleanup Matrix services before UI closes

            Args:
                context: ActionContext providing access to native implementation
            """
            ColorPrint.yellow("[MatrixUI] Cleanup callback: Stopping all Matrix services...")
            launcher.stop_all()

            # Call native close implementation (stop UI thread, destroy window, cleanup)
            ColorPrint.yellow("[MatrixUI] Calling native close implementation...")
            context.call_native()

        # Register cleanup callback for close action
        # When close is triggered:
        # 1. cleanup_matrix_services() is called
        # 2. Inside callback, we stop services
        # 3. Then we call context.call_native() to execute native close
        ui_thread.register_action_callback(ActionType.CLOSE, cleanup_matrix_services)

        ColorPrint.green("[MatrixUI] Action callbacks registered")

        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.green(" MATRIX APPLICATION FULLY INITIALIZED")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")
        ColorPrint.green("Services:")
        ColorPrint.white(f"  - Matrix Service: Running")
        ColorPrint.white(f"  - Native UI: Starting in main thread...")
        ColorPrint.white(f"  - Frontend: http://localhost:{matrix_config.frontend_port}")
        ColorPrint.white(f"  - Backend API: http://{matrix_config.backend_host}:{matrix_config.backend_port}")
        ColorPrint.white("")
        ColorPrint.yellow("Press Ctrl+C or close window to stop")
        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")

        # Run UI directly in main thread (blocking)
        # Note: Calling run() instead of start() to run in current thread
        # When UI closes:
        # 1. cleanup_matrix_services() is called (stops all services)
        # 2. Native close implementation is called (destroys UI, stops threads)
        ColorPrint.green("[MatrixUI] Starting UI in main thread (blocking)...")
        ui_thread.run()  # This will block until UI is closed

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received, shutting down...")
        if 'launcher' in locals():
            launcher.stop_all()
    except Exception as e:
        ColorPrint.red(f"\n[ERROR] Application error: {e}")
        import traceback
        traceback.print_exc()
        if 'launcher' in locals():
            launcher.stop_all()
    finally:
        # Restore original argv
        sys.argv = original_argv


def main():
    """Alias for start() - supports both entry point patterns"""
    start()


if __name__ == '__main__':
    main()
