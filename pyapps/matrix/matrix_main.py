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
from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig

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

        # Register custom UI service with webview
        ColorPrint.blue("\nRegistering custom UI service with webview...")

        def custom_ui_entry(ui_config):
            """Custom UI service entry point"""
            ColorPrint.green("[MatrixUI] Starting UI thread with webview")

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
                on_ready=lambda: ColorPrint.green("[MatrixUI] UI is ready!"),
                on_close=lambda: ColorPrint.yellow("[MatrixUI] UI is closing...")
            )

            # Create and start UI thread
            ui_thread = NativeUIThread(
                config=ui_thread_config,
                thread_name="MatrixUIThread"
            )

            ui_thread.start()
            ui_thread.wait_until_ready()

            ColorPrint.green("[MatrixUI] UI thread ready")

            # Keep thread running
            try:
                while ui_thread.is_running():
                    time.sleep(0.1)
            except Exception as e:
                ColorPrint.red(f"[MatrixUI] Thread error: {e}")

            return ui_thread

        # Register custom UI service
        launcher.register_custom_service(
            service_name='matrix_ui',
            entry_point=custom_ui_entry,
            config=UIServiceConfig(),  # Pass empty config (we use NativeUIThreadConfig instead)
            daemon=True
        )

        # Start UI service
        ColorPrint.blue("Starting native UI with webview...")
        launcher.start_service('matrix_ui')

        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.green(" MATRIX APPLICATION FULLY INITIALIZED")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")
        ColorPrint.green("Services:")
        ColorPrint.white(f"  - Matrix Service: Running")
        ColorPrint.white(f"  - Native UI: Running")
        ColorPrint.white(f"  - Frontend: http://localhost:{matrix_config.frontend_port}")
        ColorPrint.white(f"  - Backend API: http://{matrix_config.backend_host}:{matrix_config.backend_port}")
        ColorPrint.white("")
        ColorPrint.yellow("Press Ctrl+C to stop all services")
        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")

        # Wait for services
        launcher.wait()

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
