#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Launcher - Simplified main entry point

Provides a single function launch_native_app() that handles everything:
- Auto port allocation
- Auto i18n initialization
- URL processing
- Singleton detection
- Debug window
- Main UI creation
- Lifecycle management

This module is the slimmed orchestrator. Service starters live in
service_starters.py, the PySide6 UI builder in pyside6_ui_builder.py, and the
shared restart logic in _restart.py. Inline closures that capture local state
(startup_thread_ref, frontend_thread, final_url, callback_manager) stay here.

Public API: launch_native_app (re-exported by this package's __init__ and by
pycore.pyutils.native_ui). The `launch` alias is preserved.
"""

import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import RPC_CONTROLLER_PREFIX
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.native_ui.step1_config.app_config import NativeUIConfig
from pycore.pyutils.native_ui.step2_port_url.port_allocator import get_port_range
from pycore.pyutils.native_ui.step2_port_url.url_handler import process_url
from pycore.pyutils.native_ui.step7_managers.callback_manager import CallbackManager
from pycore.pyutils.native_ui.step3_launcher.launcher_with_startup import launch_app_with_startup
from pycore.pyutils.native_ui.step7_managers.timer_manager import timer_manager
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusSignals
from pycore.pyutils.native_ui.platform_adapter import get_platform_adapter
from pycore.pyutils.native_ui.step3_launcher.service_starters import (
    _start_frontend,
    _start_rpc_v2_service,
    _start_pylauncher_tray_service,
    _start_singleton_detector,
)
from pycore.pyutils.native_ui.step3_launcher.pyside6_ui_builder import _create_pyside6_ui
from pycore.pyutils.native_ui.step3_launcher._restart import restart_process

import signal
import traceback



def launch_native_app(config: NativeUIConfig) -> None:
    """
    Launch native UI application with simplified API

    This is the main entry point for native UI applications.
    Handles everything automatically based on configuration.

    Args:
        config: NativeUIConfig instance

    Example:
        config = NativeUIConfig(
            app_id="matrix",
            app_name="Matrix Application",
            main_entry=main_app_entry,
            url="http://localhost:3000",
            enable_tray=True,
            tray_menu_items=[
                {"text": "Open Frontend", "callback": open_frontend},
                {"text": "Exit", "callback": exit_app}
            ]
        )
        launch_native_app(config)
    """
    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Starting native UI application...")

    # ========== Phase 1: Auto Port Allocation ==========
    port_start, port_range = get_port_range(config.app_id, debug=config.debug)
    if config.debug:
        ColorPrint.print_info(
            f"[NativeLauncher] Phase 1: Port range allocated: {port_start}-{port_start+port_range-1}"
        )

    # ========== Phase 2: Process URL ==========
    final_url, detected_url_type, url_metadata = process_url(
        config.url, config.url_type, project_root=config.project_root, debug=config.debug
    )
    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 3: URL processed: {final_url} (type: {detected_url_type})")

    # ========== Phase 4: Initialize Callback Manager ==========
    callback_manager = CallbackManager(debug=config.debug)

    # Add user callbacks from config
    for callback in config.on_ready_callbacks:
        callback_manager.add_ready_callback(callback)
    for callback in config.on_closed_callbacks:
        callback_manager.add_closed_callback(callback)
    for callback in config.on_closing_callbacks:
        callback_manager.add_closing_callback(callback)
    if config.on_restart_callback:
        callback_manager.set_restart_callback(config.on_restart_callback)

    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 4: Callback manager initialized")

    # ========== Phase 4.5: Auto-start Timer Manager ==========
    if config.enable_timer:
        _initialize_timer_manager(config)

    # ========== Phase 4.55: Pre-register frontend.ready handler (if debug window enabled) ==========
    # IMPORTANT: This must happen BEFORE frontend starts to catch the frontend.ready event
    startup_thread_ref = {'thread': None, 'frontend_ready': False} if config.show_debug_window else None

    if config.show_debug_window:
        def handle_frontend_ready_early(event_data):
            """
            Handle frontend.ready event - auto-close debug window

            This handler is registered BEFORE frontend starts to ensure
            it catches the frontend.ready event when it's triggered.

            Triggered by:
            - Dev mode: HTTP health check passes (frontend_thread.py)
            - Production mode: RPC v2 started with static files mounted (launch_native_app.py)
            """
            # Mark that frontend is ready
            startup_thread_ref['frontend_ready'] = True

            thread = startup_thread_ref['thread']
            if thread is None:
                if config.debug:
                    ColorPrint.yellow("[NativeLauncher] frontend.ready received - waiting for startup window thread")
                return

            ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
            thread.log("Frontend ready, closing debug window...", "success")
            thread.set_status("Frontend ready, closing...")
            time.sleep(1.0)  # Brief delay to show message

            # Unregister ColorPrint callback
            ColorPrint.unregister_callback(thread._colorprint_callback)

            # Close debug window via THREAD_BUS (TkinterStartupThread handler sets _stop_event + request_close)
            THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': 'frontend.ready'}, async_mode=False)

        # Register handler with high priority to ensure it runs first
        THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready_early, priority=100)

        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 4.55: Registered frontend.ready handler (pre-frontend startup)")

    # ========== Phase 4.6: Start Frontend (if enabled) ==========
    frontend_thread = None
    if config.frontend_enabled:
        frontend_thread = _start_frontend(config)

        # Register frontend shutdown handler to THREAD_BUS
        if frontend_thread:
            def stop_frontend():
                ColorPrint.blue("[frontend] Stopping frontend thread...")
                frontend_thread.stop()

            THREAD_BUS.register_shutdown_handler(
                handler=stop_frontend,
                priority=30,  # Stop before RPC v2 (priority 50)
                name="frontend"
            )
            if config.debug:
                ColorPrint.blue("[frontend] Registered shutdown handler (priority=30)")

        # Update final_url if frontend is in dev mode
        if frontend_thread and config.frontend_mode == "dev":
            final_url = f"http://localhost:{config.frontend_port}"
            ColorPrint.cyan(f"[NativeLauncher] Updated URL to frontend dev server: {final_url}")

    # ========== Phase 4.7: Start RPC v2 (if enabled) ==========
    rpc_service = None
    if config.rpc_enabled:
        rpc_service = _start_rpc_v2_service(config, frontend_thread, callback_manager)

        # Update final_url if RPC v2 is serving frontend (production mode)
        if rpc_service and config.rpc_auto_mount_frontend:
            if config.frontend_mode == "production" and config.frontend_enabled:
                final_url = f"http://localhost:{config.rpc_port}"
                ColorPrint.cyan(f"[NativeLauncher] Updated URL to RPC v2 (with frontend): {final_url}")
            elif not config.frontend_enabled:
                # RPC only mode (no frontend)
                final_url = f"http://localhost:{config.rpc_port}"
                if config.debug:
                    ColorPrint.cyan(f"[NativeLauncher] RPC v2 URL: {final_url}")

    # ========== Phase 4.8: Register app.close event handlers for cleanup ==========
    def handle_app_close(event_data):
        """
        Handle app.close event - trigger THREAD_BUS shutdown

        Triggered by:
        - Window close (main_window.py closeEvent)
        - Tray exit action
        - Ctrl+C / KeyboardInterrupt

        IMPORTANT: Don't manually stop services here!
        Let THREAD_BUS.request_shutdown() handle service shutdown via shutdown stack.
        Debug window is closed via THREAD_BUS (ui.startup.request_close).
        """
        source = event_data.get('source', 'unknown')
        ColorPrint.yellow(f"[NativeLauncher] Handling app.close event (source: {source})")

        # Close debug window via THREAD_BUS (TkinterStartupThread listens and closes)
        if config.show_debug_window:
            THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': source}, async_mode=False)

        # Trigger THREAD_BUS shutdown to stop all services in proper order
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[NativeLauncher] Triggering THREAD_BUS shutdown...")
            THREAD_BUS.request_shutdown(
                reason=f"app.close event (source: {source})",
                execute_handlers=True
            )
        else:
            ColorPrint.yellow("[NativeLauncher] Shutdown already requested, skipping")

    # Register with high priority to ensure cleanup happens early
    THREAD_BUS.register_event_handler('app.close', handle_app_close, priority=90)
    ColorPrint.blue("[NativeLauncher] Registered app.close event handler for THREAD_BUS shutdown")

    # Register shutdown handler to close tk debug window via THREAD_BUS (singleton / any shutdown)
    # Priority -1 so it runs before pyside6_quit (0). TkinterStartupThread (single tk build) listens.
    def close_debug_window_via_bus():
        ColorPrint.blue("[NativeLauncher] Shutdown: requesting debug window close via THREAD_BUS...")
        THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': 'shutdown'}, async_mode=False)

    THREAD_BUS.register_shutdown_handler(
        handler=close_debug_window_via_bus,
        priority=-1,
        name="debug_window_close"
    )
    if config.debug:
        ColorPrint.blue("[NativeLauncher] Registered shutdown handler (priority=-1) for debug window close via THREAD_BUS")

    # ========== Phase 5: Singleton Detection ==========
    # Create singleton detector with shutdown_existing=True
    # This means: if an old instance exists, notify it to shutdown and take over
    detection = _start_singleton_detector(config, port_start, port_range)
    if detection is None:
        return

    # ========== Print Startup Summary ==========
    if config.debug:
        ColorPrint.print_success("\n" + "=" * 70)
        ColorPrint.print_success("  SERVICES INITIALIZED")
        ColorPrint.print_success("=" * 70)
        if frontend_thread and config.frontend_enabled:
            ColorPrint.cyan(f"  Frontend:  {final_url}  ({config.frontend_framework} {config.frontend_mode})")
        if config.rpc_enabled:
            rpc_url = f"http://{config.rpc_host}:{config.rpc_port}"
            ColorPrint.cyan(
                f"  Backend:   {rpc_url}{RPC_CONTROLLER_PREFIX}/<route>  "
                f"({len(config.rpc_routers)} routes)"
            )
        ColorPrint.cyan(f"  Window:    {config.window_size[0]}x{config.window_size[1]}" + (" (frameless)" if config.frameless else ""))
        ColorPrint.print_success("=" * 70 + "\n")

    # ========== Phase 6: Launch with or without startup window ==========
    # Create wrapped main_entry that integrates PySide6 UI
    def _wrapped_main_entry():
        """Wrapped main entry that creates PySide6 UI with callbacks"""
        # Call user's main_entry first (for service setup, etc.)
        if config.main_entry:
            config.main_entry()

        # ========== Tray Differentiation ==========
        # Start pylauncher tray service if tray_type == "tk" (pystray backend)
        if config.enable_tray and config.tray_type == "tk":
            ColorPrint.blue(f"[NativeLauncher] Starting pylauncher tray service (pystray backend)...")
            _start_pylauncher_tray_service(config)

        # Create PySide6 UI only if GUI is available (desktop mode)
        # Server mode (no X11 display) should skip PySide6 UI creation entirely
        # Check: GUI available AND (window needed OR tray needed)
        adapter = get_platform_adapter()
        if adapter.has_gui and (config.show_on_start or config.enable_tray):
            if final_url:
                _create_pyside6_ui(config, final_url, callback_manager)
            elif config.enable_tray:
                # Tray only, no frontend - use blank page
                _create_pyside6_ui(config, "about:blank", callback_manager)
        elif config.debug:
            # Server mode: Skip PySide6 UI creation
            ColorPrint.yellow("[NativeLauncher] Server mode detected (no GUI), skipping PySide6 UI creation")

    # Check if we should show debug window
    if config.show_debug_window:
        # Launch with startup window
        launch_app_with_startup(
            app_name=config.app_name,
            main_entry=_wrapped_main_entry,
            startup_width=config.debug_window_width,
            startup_height=config.debug_window_height,
            min_display_time=config.min_display_time,
            icon_path=config.icon_path,
            logo_path=config.logo_path,
            enable_language_selector=config.enable_language_selector,
            enable_tray=config.enable_tray,
            startup_thread_ref=startup_thread_ref  # Pass reference for early handler
        )
    else:
        # Launch directly without startup window
        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 6: Launching directly (no debug window)")

        try:
            _wrapped_main_entry()

            # If no GUI (server mode), wait for shutdown signal
            adapter = get_platform_adapter()
            if not (adapter.has_gui and (config.show_on_start or config.enable_tray)):

                ColorPrint.green("[NativeLauncher] Server mode: Running in background (no GUI)")
                ColorPrint.blue("[NativeLauncher] Press Ctrl+C to stop, or use THREAD_BUS.request_shutdown()")

                # Setup Ctrl+C handler
                def signal_handler(signum, frame):
                    if not THREAD_BUS.is_shutdown_requested():
                        ColorPrint.yellow("\n[NativeLauncher] Keyboard interrupt (Ctrl+C)")
                        THREAD_BUS.request_shutdown(reason="Keyboard interrupt", execute_handlers=True)
                    else:
                        ColorPrint.yellow("\n[NativeLauncher] Already shutting down, please wait...")

                signal.signal(signal.SIGINT, signal_handler)
                signal.signal(signal.SIGTERM, signal_handler)

                # Wait for shutdown signal
                while not THREAD_BUS.is_shutdown_requested():
                    time.sleep(0.5)

                ColorPrint.blue("[NativeLauncher] Shutdown signal received, cleaning up...")

                # After shutdown, check if restart was requested (else clean shutdown)
                restart_process()

        except KeyboardInterrupt:
            ColorPrint.yellow("\nKeyboard interrupt received")
        except Exception as e:
            ColorPrint.print_error(f"\nERROR: Main application failed: {e}")
            traceback.print_exc()
            raise


def _initialize_timer_manager(config: NativeUIConfig) -> None:
    """
    Initialize and start built-in timer manager (singleton)

    The timer manager is auto-started if enable_timer=True.
    Users can register tasks anytime using:
        from pycore.pyutils.native_ui.step7_managers.timer_manager import timer_manager
        timer_manager.register_task("my_task", interval=5.0, callback=my_callback)
    """
    timer_mgr = timer_manager

    if not timer_mgr.is_running():
        timer_mgr.start()
        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 4.5: Timer manager started (singleton)")
    else:
        if config.debug:
            ColorPrint.print_warn("[NativeLauncher] Phase 4.5: Timer manager already running")


# Alias for convenience
launch = launch_native_app
