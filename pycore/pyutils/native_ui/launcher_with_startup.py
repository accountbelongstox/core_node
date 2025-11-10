#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Launcher with Startup Window

Provides a wrapper function that:
1. Shows Python native startup window (tkinter) BEFORE dependencies are installed
2. Checks and installs dependencies with real-time progress in startup window
3. Closes startup window and launches main application (PySide6)

This follows the refactoring requirement:
- Startup window: Python native (tkinter, no external dependencies)
- Main application: PySide6

Usage:
    from pycore.pyutils.native_ui.launcher_with_startup import launch_app_with_startup

    def main_app_entry():
        # Your main application code here
        # Can use PySide6, NativeUIThread, etc.
        pass

    launch_app_with_startup(
        app_name="My Application",
        main_entry=main_app_entry
    )
"""

import sys
import time
from pathlib import Path
from typing import Callable, Optional, Any

# Import startup window (Python native, no dependencies required)
from pycore.pyutils.native_ui.startup_window import StartupWindow, ColorPrintCapture


def launch_app_with_startup(
    app_name: str,
    main_entry: Callable,
    startup_width: int = 600,
    startup_height: int = 500,
    min_display_time: float = 2.0,
    icon_path: Optional[str] = None,
    logo_path: Optional[str] = None,
    enable_language_selector: bool = True,
    i18n_manager: Optional[Any] = None
):
    """
    Launch application with startup window

    Workflow:
    1. Display startup window (tkinter, Python native)
    2. Check and install dependencies (show progress in startup window)
    3. Close startup window
    4. Call main_entry() to start main application (PySide6)

    Args:
        app_name: Application name
        main_entry: Main application entry function (called after dependencies installed)
        startup_width: Startup window width
        startup_height: Startup window height
        min_display_time: Minimum time to display startup window (seconds)
        icon_path: Path to window icon (.ico or .png) (optional)
        logo_path: Path to logo image displayed before title (.png) (optional)
        enable_language_selector: Enable language selector in startup window (default: True)
        i18n_manager: I18nManager instance for multi-language support (optional)
    """
    # Track startup time
    start_time = time.time()

    # Create startup window
    startup = StartupWindow(
        app_name=app_name,
        width=startup_width,
        height=startup_height,
        icon_path=icon_path,
        logo_path=logo_path,
        enable_language_selector=enable_language_selector,
        i18n_manager=i18n_manager
    )

    # Show startup window
    startup.show()
    time.sleep(0.3)  # Allow window to initialize

    # Log startup
    startup.log(f"Starting {app_name}...", "info")
    startup.set_status("Initializing...")

    # Capture ColorPrint output to startup window
    capture = ColorPrintCapture(startup)
    capture.start()

    # Check and install dependencies
    startup.log("Checking dependencies...", "info")
    startup.set_status("Checking dependencies...")

    from pycore import check_and_install_dependencies
    check_and_install_dependencies()

    startup.log("All dependencies installed", "success")
    startup.set_status("Dependencies ready")

    # Stop capture
    capture.stop()

    # Ensure minimum display time
    elapsed = time.time() - start_time
    remaining = min_display_time - elapsed
    if remaining > 0:
        startup.log(f"Initialization complete", "success")
        startup.set_status("Ready to launch...")
        time.sleep(remaining)

    # Close startup window
    startup.log("Launching main application...", "info")
    time.sleep(0.5)

    print("[DEBUG] About to close startup window...")
    startup.close()

    # Wait for startup window to be fully closed using event
    print("[DEBUG] Waiting for startup window to be fully closed...")
    if startup._closed_event.wait(timeout=3.0):
        print("[DEBUG] Startup window closed successfully")
    else:
        print("[DEBUG] WARNING: Startup window close timeout")

    # Launch main application
    print("[DEBUG] Calling main_entry()...")
    try:
        main_entry()
        print("[DEBUG] main_entry() completed")
    except Exception as e:
        print(f"[ERROR] main_entry() failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def launch_matrix_with_startup():
    """
    Convenience function to launch matrix application with startup window

    This function:
    1. Shows startup window
    2. Installs dependencies
    3. Dynamically imports and launches matrix_main
    """
    def matrix_main_entry():
        """Dynamic import and launch matrix main"""
        # Import here to avoid triggering dependency checks too early
        from pyapps.matrix import matrix_main
        matrix_main.start()

    launch_app_with_startup(
        app_name="Matrix - Android Device Control",
        main_entry=matrix_main_entry,
        startup_width=600,
        startup_height=500,
        min_display_time=2.0
    )


# Example usage
if __name__ == "__main__":
    # Test with a simple main entry
    def test_main_entry():
        from pycore import ColorPrint
        ColorPrint.green("Main application started!")
        ColorPrint.white("This is where your PySide6 app would launch...")
        input("Press Enter to exit...")

    launch_app_with_startup(
        app_name="Test Application",
        main_entry=test_main_entry,
        min_display_time=3.0
    )
