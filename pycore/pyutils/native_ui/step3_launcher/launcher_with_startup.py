#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Launcher with Startup Window (THREAD_BUS Version)

Refactored to follow project multi-threading standards:
- Uses TkinterStartupThread (direct Thread inheritance)
- Uses THREAD_BUS for all communication
- No parameter passing between threads
- Main thread stays alive and manages child threads

New Architecture (2025-12-07):
- Debug window starts BEFORE all services (in launch_native_app.py Phase 0)
- This ensures all logs are captured and frontend.ready event is received
- Provides _start_debug_window() and _cleanup_debug_window() helpers

Usage:
    from pycore.pyutils.native_ui.launcher_with_startup import _start_debug_window, _cleanup_debug_window

    # Phase 0: Start debug window
    context = _start_debug_window(app_name="My App", ...)

    # ... other services ...

    # Phase N: Cleanup
    _cleanup_debug_window(context)
"""

import sys
import time
from pathlib import Path
from typing import Callable, Optional, Any, Dict

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread


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

    ColorPrint.print_info("=" * 70)
    ColorPrint.print_info(f" {app_name.upper()} - INITIALIZATION")
    ColorPrint.print_info("=" * 70)
    ColorPrint.print_info("")

    # ========== Step 1: Start TkinterStartupThread ==========
    ColorPrint.print_info("Starting startup window thread...")

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

    # ========== Step 2.5: Register THREAD_BUS event handler for frontend.ready ==========
    # Auto-close debug window when frontend is ready (both dev and production modes)
    # Use closure variable to prevent duplicate execution
    _frontend_ready_executed = [False]

    def handle_frontend_ready(event_data):
        """
        Handle frontend.ready event - auto-close debug window

        Triggered by:
        - Dev mode: HTTP health check passes (frontend_thread.py)
        - Production mode: RPC v2 started with static files mounted (launch_native_app.py)
        """
        # Prevent duplicate execution
        if _frontend_ready_executed[0]:
            ColorPrint.gray("[DebugLog] Frontend ready handler already executed, skipping")
            return

        _frontend_ready_executed[0] = True
        ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
        startup_thread.log("Frontend ready, closing debug window...", "success")
        startup_thread.set_status("Frontend ready, closing...")
        time.sleep(1.0)  # Brief delay to show message

        # Unregister ColorPrint callback
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)

        # Close debug window
        startup_thread.request_close()

    THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready, priority=100)

    # ========== Step 3: Wait for startup window ready ==========
    ColorPrint.yellow("Waiting for startup window to be ready...")

    if not THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=5.0):
        ColorPrint.print_error("ERROR: Startup window failed to start!")
        # Unregister callback on error
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)
        return

    ColorPrint.print_success("✓ Startup window is ready")
    startup_thread.log(f"Starting {app_name}...", "info")
    startup_thread.set_status("Initializing...")

    # ========== Step 4: Dependencies are auto-checked by third_party module ==========
    # Dependencies are automatically checked when third_party module is imported
    # No need to call check_and_install_dependencies() explicitly
    startup_thread.log("Dependencies ready", "success")
    startup_thread.set_status("Dependencies ready")

    # ========== Step 5: Ensure minimum display time ==========
    elapsed = time.time() - start_time
    remaining = min_display_time - elapsed
    if remaining > 0:
        startup_thread.log("Initialization complete", "success")
        startup_thread.set_status("Ready to launch...")
        time.sleep(remaining)

    # ========== Step 6: Launch main application (Debug window will auto-close on frontend.ready) ==========
    ColorPrint.print_info("\nLaunching main application...")
    ColorPrint.print_info("Note: Debug window will auto-close when frontend is ready...")

    # ========== Step 7: Start main application ==========
    ColorPrint.print_info("")
    ColorPrint.print_success("=" * 70)
    ColorPrint.print_success(f" {app_name.upper()} - STARTING MAIN APPLICATION")
    ColorPrint.print_success("=" * 70)
    ColorPrint.print_info("")

    try:
        # Call main entry point (PySide6 application)
        main_entry()

    except KeyboardInterrupt:
        ColorPrint.yellow("\nKeyboard interrupt received")
    except Exception as e:
        ColorPrint.print_error(f"\nERROR: Main application failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        # Cleanup: Unregister ColorPrint callback and close log window
        ColorPrint.print_info("\nCleaning up...")
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)
        startup_thread.request_close()

        # Wait for startup thread to fully stop
        if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
            ColorPrint.print_info("✓ Log window closed")

        ColorPrint.print_info("")
        ColorPrint.print_info("=" * 70)
        ColorPrint.print_info(f" {app_name.upper()} - SHUTDOWN COMPLETE")
        ColorPrint.print_info("=" * 70)


def _start_debug_window(
    app_name: str,
    startup_width: int = 600,
    startup_height: int = 500,
    icon_path: Optional[str] = None,
    logo_path: Optional[str] = None,
    enable_language_selector: bool = True,
    enable_tray: bool = False
) -> Dict[str, Any]:
    """
    Start debug window (Phase 0 helper for launch_native_app)

    Returns context dict with:
    - startup_thread: TkinterStartupThread instance
    - frontend_ready_executed: Flag for preventing duplicate execution

    This function should be called BEFORE any services start to ensure:
    1. All ColorPrint output is captured
    2. frontend.ready event handler is registered before event is triggered
    """
    ColorPrint.print_info("=" * 70)
    ColorPrint.print_info(f" {app_name.upper()} - INITIALIZATION")
    ColorPrint.print_info("=" * 70)
    ColorPrint.print_info("")

    # ========== Step 1: Start TkinterStartupThread ==========
    ColorPrint.print_info("Starting debug window thread...")

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
    ColorPrint.register_callback(startup_thread._colorprint_callback)

    # ========== Step 2.5: Register THREAD_BUS event handler for frontend.ready ==========
    _frontend_ready_executed = [False]

    def handle_frontend_ready(event_data):
        """
        Handle frontend.ready event - auto-close debug window

        Triggered by:
        - Dev mode: HTTP health check passes (frontend_thread.py)
        - Production mode: RPC v2 started with static files mounted (launch_native_app.py)
        """
        if _frontend_ready_executed[0]:
            ColorPrint.gray("[DebugLog] Frontend ready handler already executed, skipping")
            return

        _frontend_ready_executed[0] = True
        ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
        startup_thread.log("Frontend ready, closing debug window...", "success")
        startup_thread.set_status("Frontend ready, closing...")
        time.sleep(1.0)  # Brief delay to show message

        # Unregister ColorPrint callback
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)

        # Close debug window
        startup_thread.request_close()

    THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready, priority=100)

    # ========== Step 3: Wait for startup window ready ==========
    ColorPrint.yellow("Waiting for debug window to be ready...")

    if not THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=5.0):
        ColorPrint.print_error("ERROR: Debug window failed to start!")
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)
        return None

    ColorPrint.print_success("✓ Debug window is ready")
    startup_thread.log(f"Starting {app_name}...", "info")
    startup_thread.set_status("Initializing...")

    # Return context for cleanup
    return {
        'startup_thread': startup_thread,
        'frontend_ready_executed': _frontend_ready_executed
    }


def _cleanup_debug_window(context: Optional[Dict[str, Any]]):
    """
    Cleanup debug window (Phase 7 helper for launch_native_app)

    Called after main application exits to ensure proper cleanup.
    """
    if not context:
        return

    startup_thread = context.get('startup_thread')
    if not startup_thread:
        return

    ColorPrint.print_info("\nCleaning up debug window...")

    # Unregister ColorPrint callback
    ColorPrint.unregister_callback(startup_thread._colorprint_callback)

    # Request close
    startup_thread.request_close()

    # Wait for startup thread to fully stop
    if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
        ColorPrint.print_info("✓ Debug window closed")


# Test
if __name__ == "__main__":
    def test_main_entry():
        """Test main entry"""
        from pycore import ColorPrint
        ColorPrint.print_success("\n" + "=" * 70)
        ColorPrint.print_success(" TEST MAIN APPLICATION STARTED")
        ColorPrint.print_success("=" * 70)
        ColorPrint.print_info("\nThis is where your PySide6 application would run...")
        ColorPrint.print_info("\nPress Enter to exit...")
        input()

    launch_app_with_startup(
        app_name="Test Application",
        main_entry=test_main_entry,
        min_display_time=3.0
    )
