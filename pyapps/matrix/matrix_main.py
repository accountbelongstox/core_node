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
from pycore.pylauncher import UnifiedLauncher, LauncherConfig
from pycore.pyutils.native_ui import launch_app_with_startup, StartupWindow

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


def main_app_entry():
    """
    Main application entry point (called after startup window closes)

    This function is called by launch_app_with_startup after:
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

    # Store launcher reference for cleanup
    launcher_ref = [None]

    try:
        # Import PySide6 components (after dependencies are installed)
        from pycore.pyutils.native_ui.pyside6 import (
            PySide6Framework,
            PySide6UIConfig,
            PySide6TrayMenuItem,
            create_default_tray_menu
        )
        # Create launcher configuration
        ColorPrint.blue("Creating launcher configuration...")
        launcher_config = create_launcher_config()
        launcher = UnifiedLauncher(launcher_config)
        launcher_ref[0] = launcher  # Store for cleanup

        # Create Matrix service configuration
        ColorPrint.blue("Creating Matrix service configuration...")
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
        ColorPrint.green("Starting Matrix service (Frontend + Backend)...")
        launcher.start_service('matrix_service')

        # Wait for Matrix service to initialize
        ColorPrint.yellow("Waiting for services to start...")
        time.sleep(5)

        # Create PySide6 UI
        ColorPrint.blue("\nCreating PySide6 UI...")

        # Helper function for opening browser
        def _open_browser(url):
            """Open URL in default browser"""
            import webbrowser
            webbrowser.open(url)
            ColorPrint.blue(f"[Matrix] Opened in browser: {url}")

        # Custom tray menu items
        def _tray_open_frontend():
            _open_browser(f"http://localhost:{matrix_config.frontend_port}")

        def _tray_open_api_docs():
            _open_browser(f"http://{matrix_config.backend_host}:{matrix_config.backend_port}/docs")

        tray_menu_items = [
            PySide6TrayMenuItem(
                text="打开前端页面",
                callback=_tray_open_frontend
            ),
            PySide6TrayMenuItem(
                text="打开API文档",
                callback=_tray_open_api_docs
            ),
        ]

        # Cleanup callback when app closes
        def on_closing():
            """Called before window closes"""
            ColorPrint.yellow("[Matrix] Closing - stopping all services...")
            if launcher_ref[0]:
                launcher_ref[0].stop_all()

        # Icon and logo paths
        icon_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")
        logo_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")

        # Create PySide6 UI configuration
        ui_config = PySide6UIConfig(
            app_name="星灿传媒科技-云矩阵",
            window_size=(1280, 900),

            # Icons
            icon_path=icon_path,
            logo_path=logo_path,
            logo_size=24,

            # Window settings
            frameless=True,
            show_on_start=True,

            # WebView settings
            enable_webview=True,
            webview_url=f"http://localhost:{matrix_config.frontend_port}",
            enable_loading_page=True,
            loading_style=1,  # Loading animation style
            loading_text="加载中...",

            # System tray
            enable_tray=True,
            tray_icon_path=icon_path,
            tray_menu_items=tray_menu_items,
            minimize_to_tray=True,

            # Tick timer
            enable_tick_timer=True,
            tick_interval=1.0,

            # Callbacks
            on_ready=lambda: ColorPrint.green("[Matrix] UI is ready!"),
            on_closing=on_closing,
            on_closed=lambda: ColorPrint.yellow("[Matrix] UI closed"),

            # Debug
            debug=False
        )

        # Create PySide6 framework
        ColorPrint.blue("Creating PySide6 framework...")
        app = PySide6Framework(ui_config)

        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.green(" MATRIX APPLICATION READY")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")
        ColorPrint.green("Services:")
        ColorPrint.white(f"  - Matrix Service: Running")
        ColorPrint.white(f"  - Frontend: http://localhost:{matrix_config.frontend_port}")
        ColorPrint.white(f"  - Backend API: http://{matrix_config.backend_host}:{matrix_config.backend_port}")
        ColorPrint.white("")
        ColorPrint.yellow("Close window to stop")
        ColorPrint.white("")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")

        # Start PySide6 app (blocking)
        ColorPrint.green("[Matrix] Starting PySide6 UI...")
        app.start()  # Blocks until window is closed

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received, shutting down...")
        if launcher_ref[0]:
            launcher_ref[0].stop_all()
    except Exception as e:
        ColorPrint.red(f"\n[ERROR] Application error: {e}")
        import traceback
        traceback.print_exc()
        if launcher_ref[0]:
            launcher_ref[0].stop_all()


def start():
    """
    Standard entry point for pymain.py launcher

    Workflow:
    1. Shows startup window (tkinter - Python native)
    2. Checks/installs dependencies
    3. Closes startup window
    4. Calls main_app_entry() to start PySide6 UI
    """
    # Filter out app=xxx arguments
    original_argv = sys.argv.copy()
    sys.argv = [arg for arg in sys.argv if not arg.startswith('app=')]

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - STARTING")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    # Icon and logo paths
    icon_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")
    logo_path = str(PROJECT_ROOT / "pyapps" / "matrix" / "icon.png")

    # Initialize i18n manager for Matrix application
    from pycore.pyutils.native_ui.i18n import I18nManager
    i18n_manager = I18nManager()

    # Initialize with Matrix's i18n directory (if exists)
    matrix_i18n_dir = PROJECT_ROOT / "pyapps" / "matrix" / "i18n"
    if matrix_i18n_dir.exists():
        i18n_manager.initialize(
            config_dir=str(matrix_i18n_dir),
            use_system_language=True  # Auto-detect system language
        )
        ColorPrint.blue(f"[Matrix] Initialized i18n with language: {i18n_manager.get_current_language()}")
    else:
        # Fallback to native_ui i18n
        native_ui_i18n_dir = PROJECT_ROOT / "pycore" / "pyutils" / "native_ui" / "i18n" / "translations"
        if native_ui_i18n_dir.exists():
            i18n_manager.initialize(
                config_dir=str(native_ui_i18n_dir),
                use_system_language=True
            )
            ColorPrint.yellow(f"[Matrix] Using native_ui i18n (Matrix i18n not found)")

    try:
        # Launch with startup window
        launch_app_with_startup(
            app_name="星灿传媒科技-云矩阵",
            main_entry=main_app_entry,
            startup_width=650,
            startup_height=500,
            min_display_time=2.0,
            icon_path=icon_path,
            logo_path=logo_path,
            enable_language_selector=True,
            i18n_manager=i18n_manager
        )

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received, shutting down...")
    except Exception as e:
        ColorPrint.red(f"\n[ERROR] Startup error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Restore original argv
        sys.argv = original_argv


def main():
    """Alias for start() - supports both entry point patterns"""
    start()


if __name__ == '__main__':
    main()
