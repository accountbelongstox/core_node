#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Launcher with Startup Window (THREAD_BUS Version)

Refactored to follow project multi-threading standards:
- Uses TkinterStartupThread (direct Thread inheritance)
- Uses THREAD_BUS for all communication
- No parameter passing between threads
- Main thread stays alive and manages child threads

Workflow:
1. Main thread starts TkinterStartupThread
2. Main thread registers ColorPrint callback immediately
3. Main thread waits for 'TkinterStartup_ready' signal via THREAD_BUS
4. Main thread performs initialization (dependencies, etc.)
5. Main thread ensures minimum display time
6. Main thread requests startup window to close
7. Main thread waits for 'TkinterStartup_closed' signal
8. Main thread calls main_entry() to start PySide6 application

Usage:
    from pycore.pyutils.native_ui.launcher_with_startup import launch_app_with_startup

    def main_app_entry():
        # Your PySide6 application code
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

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.startup_window_thread import TkinterStartupThread


def launch_app_with_startup(
    app_name: str,
    main_entry: Callable,
    startup_width: int = 600,
    startup_height: int = 500,
    min_display_time: float = 2.0,
    icon_path: Optional[str] = None,
    logo_path: Optional[str] = None,
    enable_language_selector: bool = True,
    enable_tray: bool = False
):
    """
    Launch application with startup window (THREAD_BUS version)

    Follows project multi-threading standards:
    - Main thread always exists
    - TkinterStartupThread directly inherits Thread
    - All communication via THREAD_BUS
    - No parameter passing

    Args:
        app_name: Application name
        main_entry: Main application entry function
        startup_width: Startup window width
        startup_height: Startup window height
        min_display_time: Minimum time to display startup window
        icon_path: Path to window icon (.ico or .png)
        logo_path: Path to logo image (.png)
        enable_language_selector: Enable language selector
        enable_tray: Enable system tray (persists after debug window closes)
    """
    start_time = time.time()

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f" {app_name.upper()} - INITIALIZATION")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    # ========== Step 1: Start TkinterStartupThread ==========
    ColorPrint.blue("Starting startup window thread...")

    # Add "- Debug Log" suffix to clearly identify the window as a debug log viewer
    debug_log_title = f"{app_name} - Debug Log"

    startup_thread = TkinterStartupThread(
        app_name=debug_log_title,
        width=startup_width,
        height=startup_height,
        icon_path=icon_path,
        logo_path=logo_path,
        enable_language_selector=enable_language_selector,
        enable_tray=enable_tray
    )
    startup_thread.start()

    # ========== Step 2: Register ColorPrint callback IMMEDIATELY ==========
    # Register callback RIGHT AFTER thread starts so ALL messages are captured
    # This ensures debug messages during initialization appear in tk window
    ColorPrint.register_callback(startup_thread._colorprint_callback)

    # ========== Step 3: Wait for startup window ready ==========
    ColorPrint.yellow("Waiting for startup window to be ready...")

    if not THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=5.0):
        ColorPrint.red("ERROR: Startup window failed to start!")
        # Unregister callback on error
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)
        return

    ColorPrint.green("✓ Startup window is ready")
    startup_thread.log(f"Starting {app_name}...", "info")
    startup_thread.set_status("Initializing...")

    # ========== Step 4: Check and install dependencies ==========
    startup_thread.log("Checking dependencies...", "info")
    startup_thread.set_status("Checking dependencies...")

    from pycore import check_and_install_dependencies
    check_and_install_dependencies()

    startup_thread.log("Dependencies ready", "success")
    startup_thread.set_status("Dependencies ready")

    # ========== Step 5: Ensure minimum display time ==========
    elapsed = time.time() - start_time
    remaining = min_display_time - elapsed
    if remaining > 0:
        startup_thread.log("Initialization complete", "success")
        startup_thread.set_status("Ready to launch...")
        time.sleep(remaining)

    # ========== Step 6: Close startup window ==========
    ColorPrint.blue("\nLaunching main application...")
    startup_thread.log("Launching main application...", "info")
    startup_thread.set_status("Closing debug window...")
    time.sleep(0.5)

    # Unregister ColorPrint callback before closing
    ColorPrint.unregister_callback(startup_thread._colorprint_callback)

    # Request close via public API (thread-safe)
    startup_thread.request_close()

    # Wait for window to actually close
    ColorPrint.yellow("Waiting for debug window to close...")
    if THREAD_BUS.wait_signal('TkinterStartup_closed', timeout=5.0):
        ColorPrint.green("✓ Debug window closed")
    else:
        ColorPrint.yellow("WARNING: Debug window close timeout (continuing anyway)")

    # ========== Step 7: Launch main application ==========
    ColorPrint.white("")
    ColorPrint.green("=" * 70)
    ColorPrint.green(f" {app_name.upper()} - STARTING MAIN APPLICATION")
    ColorPrint.green("=" * 70)
    ColorPrint.white("")

    try:
        # Call main entry point (PySide6 application)
        main_entry()

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received")
    except Exception as e:
        ColorPrint.red(f"\nERROR: Main application failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        # Cleanup: Unregister ColorPrint callback and close log window
        ColorPrint.blue("\nCleaning up...")
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)
        startup_thread.request_close()

        # Wait for startup thread to fully stop
        if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
            ColorPrint.blue("✓ Log window closed")

        ColorPrint.white("")
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(f" {app_name.upper()} - SHUTDOWN COMPLETE")
        ColorPrint.blue("=" * 70)


# Test
if __name__ == "__main__":
    def test_main_entry():
        """Test main entry"""
        from pycore import ColorPrint
        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green(" TEST MAIN APPLICATION STARTED")
        ColorPrint.green("=" * 70)
        ColorPrint.white("\nThis is where your PySide6 application would run...")
        ColorPrint.white("\nPress Enter to exit...")
        input()

    launch_app_with_startup(
        app_name="Test Application",
        main_entry=test_main_entry,
        min_display_time=3.0
    )
