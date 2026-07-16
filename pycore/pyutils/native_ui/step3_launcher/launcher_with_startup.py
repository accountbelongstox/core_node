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
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
from pycore.pyutils.native_ui.platform_adapter import get_platform_adapter
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusSignals, get_bus_manager

import threading
from pycore.pyutils.native_ui.step1_config.tray_config import TrayConfig, TrayBackend, create_default_tray_menu
from pycore.pyutils.native_ui.step7_managers.shutdown_manager import get_shutdown_manager
import traceback



def launch_app_with_startup(
    app_name: str,
    main_entry: Callable,
    startup_width: int = 600,
    startup_height: int = 500,
    min_display_time: float = 2.0,
    icon_path: Optional[str] = None,
    logo_path: Optional[str] = None,
    enable_language_selector: bool = True,
    enable_tray: bool = False,
    startup_thread_ref: Optional[dict] = None
):
    """
    Launch application with startup window (THREAD_BUS version)

    Follows project multi-threading standards:
    - Main thread always exists
    - TkinterStartupThread directly inherits Thread
    - All communication via THREAD_BUS
    - No parameter passing

    Note: This function assumes GUI is available.
    Caller should check adapter.has_gui before calling (typically via show_debug_window=False).

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
        startup_thread_ref: Optional dict to store startup thread reference (for early event handlers)
    """
    # Safety check: Verify GUI is available before creating Tkinter window
    # Server mode (Linux without X11 display) should not call this function
    adapter = get_platform_adapter()
    if not adapter.has_gui:
        ColorPrint.yellow(f"[{app_name}] GUI not available (server mode), skipping startup window...")
        ColorPrint.yellow("[Launcher] Launching main application directly without debug window...")

        # Launch directly without startup window
        try:
            main_entry()
        except KeyboardInterrupt:
            ColorPrint.yellow("\nKeyboard interrupt received")
        except Exception as e:
            ColorPrint.print_error(f"\nERROR: Main application failed: {e}")
            traceback.print_exc()
            raise
        return

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

    # ========== Step 1.5: Populate startup_thread_ref (if provided) ==========
    # This allows early-registered event handlers (Phase 4.55) to access the thread
    if startup_thread_ref is not None:
        startup_thread_ref['thread'] = startup_thread
        ColorPrint.blue("[DebugLog] Populated startup_thread_ref for early event handlers")

        # Check if frontend.ready was already triggered before thread was created
        if startup_thread_ref.get('frontend_ready', False):
            ColorPrint.green("[DebugLog] Frontend was already ready, closing debug window after brief delay...")

            # Schedule close after allowing window to show for min_display_time
            def delayed_close():
                time.sleep(min_display_time)  # Wait for minimum display time
                ColorPrint.green("[DebugLog] Closing debug window (frontend already ready)...")
                startup_thread.log("Frontend ready, closing debug window...", "success")
                startup_thread.set_status("Frontend ready, closing...")
                time.sleep(1.0)  # Brief delay to show message
                ColorPrint.unregister_callback(startup_thread._colorprint_callback)

                # Close debug window via THREAD_BUS
                THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': 'frontend.ready'}, async_mode=False)

            close_thread = threading.Thread(target=delayed_close, daemon=True)
            close_thread.start()

    # ========== Step 2: Register ColorPrint callback IMMEDIATELY ==========
    # Register callback RIGHT AFTER thread starts so ALL messages are captured
    # This ensures debug messages during initialization appear in tk window
    ColorPrint.register_callback(startup_thread._colorprint_callback)

    # ========== Step 2.5: Setup TrayConfig and register handlers (if tray enabled) ==========
    if enable_tray:
        # Create TrayConfig and store in THREAD_BUS for startup_window_thread to access
        # Create default tray configuration
        tray_config = TrayConfig(
            enabled=True,
            backend=TrayBackend.TKINTER,
            app_name=app_name,
            icon_path=icon_path,
            menu_items=create_default_tray_menu(app_name)
        )

        # Store tray config in THREAD_BUS via bus_manager
        bus_mgr = get_bus_manager()
        bus_mgr.set_tray_config(tray_config)
        ColorPrint.blue(f"[DebugLog] Created and stored TrayConfig in THREAD_BUS (app_name={app_name})")

        # Register handlers for default tray menu signals (BusSignals.TRAY_SHOW, TRAY_RESTART, and TRAY_EXIT)
        # These must be registered BEFORE tray starts (which happens after debug window closes)
        def handle_tray_show(event_data):
            """
            Handle ui.tray.show signal - trigger window.show event

            This allows decoupling: tray emits generic show signal,
            and PySide6 framework listens to window.show to actually show the window
            """
            ColorPrint.blue("[TrayHandler] Received TRAY_SHOW signal, triggering window.show event")
            THREAD_BUS.trigger_event('window.show', {'source': 'tray'})

        def handle_tray_restart(event_data):
            """
            Handle ui.tray.restart signal - restart application

            This triggers application restart by:
            1. Closing all threads through shutdown manager
            2. Restarting the application via os.execv()
            """
            ColorPrint.yellow("[TrayHandler] Received TRAY_RESTART signal, restarting application...")
            # Use shutdown manager to perform clean restart
            shutdown_mgr = get_shutdown_manager()
            shutdown_mgr.request_restart()

        def handle_tray_exit(event_data):
            """
            Handle ui.tray.exit signal - trigger app.close event

            This triggers global shutdown through app.close event
            """
            ColorPrint.yellow("[TrayHandler] Received TRAY_EXIT signal, triggering app.close event")
            THREAD_BUS.trigger_event('app.close', {'source': 'tray_menu'})

        # Register tray event handlers with high priority
        THREAD_BUS.register_event_handler(BusSignals.TRAY_SHOW, handle_tray_show, priority=100)
        THREAD_BUS.register_event_handler(BusSignals.TRAY_RESTART, handle_tray_restart, priority=100)
        THREAD_BUS.register_event_handler(BusSignals.TRAY_EXIT, handle_tray_exit, priority=100)
        ColorPrint.blue("[DebugLog] Registered default tray event handlers (TRAY_SHOW, TRAY_RESTART, TRAY_EXIT)")
    else:
        ColorPrint.yellow("[DebugLog] Tray disabled, skipping TrayConfig setup")

    # ========== Step 2.6: DEPRECATED - frontend.ready handler now in Phase 4.55 ==========
    # The frontend.ready event handler is now registered BEFORE frontend starts
    # in launch_native_app.py Phase 4.55 to ensure it catches the event in time.
    # This avoids the race condition where frontend.ready was triggered before handler registration.
    #
    # NOTE: If startup_thread_ref is None (standalone usage), register handler here as fallback
    if startup_thread_ref is None:
        def handle_frontend_ready(event_data):
            """
            Handle frontend.ready event - auto-close debug window (fallback for standalone usage)

            Triggered by:
            - Dev mode: HTTP health check passes (frontend_thread.py)
            - Production mode: RPC v2 started with static files mounted (launch_native_app.py)
            """
            ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
            startup_thread.log("Frontend ready, closing debug window...", "success")
            startup_thread.set_status("Frontend ready, closing...")
            time.sleep(1.0)  # Brief delay to show message

            # Unregister ColorPrint callback
            ColorPrint.unregister_callback(startup_thread._colorprint_callback)

            # Close debug window directly (don't trigger app.close - that would shutdown entire app!)
            # Use stop() instead of request_close() to ensure _stop_event is set (prevents tray mode)
            startup_thread.stop()

        THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready, priority=100)
        ColorPrint.yellow("[DebugLog] Registered frontend.ready handler (fallback - may miss event!)")

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
        traceback.print_exc()
        raise
    finally:
        # Cleanup: Unregister ColorPrint callback and close log window
        ColorPrint.print_info("\nCleaning up...")
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)

        # Use stop() instead of request_close() to ensure:
        # 1. _stop_event is set (prevents entering tray mode after window closes)
        # 2. Tray is stopped if running
        # 3. Window is closed if still open
        # Note: Failsafe cleanup - don't use event system here in case THREAD_BUS is broken
        startup_thread.stop()

        # Wait for startup thread to fully stop
        if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
            ColorPrint.print_info("✓ Log window closed")

        ColorPrint.print_info("")
        ColorPrint.print_info("=" * 70)
        ColorPrint.print_info(f" {app_name.upper()} - SHUTDOWN COMPLETE")
        ColorPrint.print_info("=" * 70)


# Test
if __name__ == "__main__":
    def test_main_entry():
        """Test main entry"""
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
