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
"""

from typing import Optional
from pathlib import Path
from pycore.pyfoundations import ColorPrint
from pycore.pyutils.native_ui.step1_config import NativeUIConfig
from pycore.pyutils.native_ui.step2_port_url import get_port_range, process_url
from pycore.pyutils.native_ui.step7_managers.callback_manager import CallbackManager


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
        ColorPrint.blue("[NativeLauncher] Starting native UI application...")

    # ========== Phase 1: Auto Port Allocation ==========
    port_start, port_range = get_port_range(config.app_id, debug=config.debug)
    if config.debug:
        ColorPrint.blue(
            f"[NativeLauncher] Phase 1: Port range allocated: {port_start}-{port_start+port_range-1}"
        )

    # ========== Phase 2: Process URL ==========
    final_url, detected_url_type, url_metadata = process_url(
        config.url, config.url_type, project_root=config.project_root, debug=config.debug
    )
    if config.debug:
        ColorPrint.blue(f"[NativeLauncher] Phase 3: URL processed: {final_url} (type: {detected_url_type})")

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
        ColorPrint.blue(f"[NativeLauncher] Phase 4: Callback manager initialized")

    # ========== Phase 4.5: Auto-start Timer Manager ==========
    if config.enable_timer:
        _initialize_timer_manager(config)

    # ========== Phase 5: Singleton Detection ==========
    from pycore.pyutils.singleton_detector import SingletonDetector

    detector = SingletonDetector(
        app_id=config.app_id,
        port_start=port_start,
        port_range=port_range,
        timeout=1.0,
        debug=config.debug
    )

    detection = detector.detect_and_bind()

    # Check existing instance
    if detection.existing_instance:
        if not config.force:
            ColorPrint.yellow(f"[NativeLauncher] Instance already running at port {detection.existing_port}")
            return

    # Check if became primary
    if not detection.is_primary:
        ColorPrint.red("[NativeLauncher] No available ports in range")
        return

    if config.debug:
        ColorPrint.blue(f"[NativeLauncher] Phase 5: Became primary instance on port {detection.port}")

    # ========== Phase 6: Launch with startup window ==========
    from pycore.pyutils.native_ui.step3_launcher.launcher_with_startup import launch_app_with_startup

    # Create wrapped main_entry that integrates PySide6 UI
    def _wrapped_main_entry():
        """Wrapped main entry that creates PySide6 UI with callbacks"""
        # Call user's main_entry first (for service setup, etc.)
        if config.main_entry:
            config.main_entry()

        # If enable_tray and PySide6 available, create PySide6 UI
        if config.enable_tray:
            _create_pyside6_ui(config, final_url, callback_manager)

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
        enable_tray=config.enable_tray
    )


def _initialize_timer_manager(config: NativeUIConfig) -> None:
    """
    Initialize and start built-in timer manager (singleton)

    The timer manager is auto-started if enable_timer=True.
    Users can register tasks anytime using:
        from pycore.pyutils.native_ui import get_timer_manager
        timer_mgr = get_timer_manager()
        timer_mgr.register_task("my_task", interval=5.0, callback=my_callback)
    """
    try:
        from pycore.pyutils.native_ui.step7_managers.timer_manager import get_timer_manager

        timer_mgr = get_timer_manager()

        if not timer_mgr.is_running():
            timer_mgr.start()
            if config.debug:
                ColorPrint.blue("[NativeLauncher] Phase 4.5: Timer manager started (singleton)")
        else:
            if config.debug:
                ColorPrint.yellow("[NativeLauncher] Phase 4.5: Timer manager already running")

    except Exception as e:
        ColorPrint.red(f"[NativeLauncher] Phase 4.5: Failed to start timer manager: {e}")


def _create_pyside6_ui(config: NativeUIConfig, url: str, callback_manager: CallbackManager) -> None:
    """
    Create PySide6 UI with webview and system tray

    Integrates callback_manager with PySide6 lifecycle events.
    """
    try:
        from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
            PySide6Framework,
            PySide6UIConfig,
            PySide6TrayMenuItem
        )

        if config.debug:
            ColorPrint.blue("[NativeLauncher] Phase 7: Creating PySide6 UI...")

        # Convert tray menu items
        pyside6_tray_items = []
        if config.tray_menu_items:
            for item in config.tray_menu_items:
                pyside6_tray_items.append(
                    PySide6TrayMenuItem(
                        text=item.get("text", ""),
                        callback=item.get("callback")
                    )
                )

        # Extract window size
        if isinstance(config.window_size, tuple):
            window_width, window_height = config.window_size
        else:
            window_width, window_height = 1280, 900  # Default

        # Create PySide6 UI config
        ui_config = PySide6UIConfig(
            app_name=config.app_name,
            url=url,
            window_width=window_width,
            window_height=window_height,
            icon_path=config.icon_path,
            enable_tray=config.enable_tray,
            tray_menu_items=pyside6_tray_items
        )

        # Wire callbacks from callback_manager
        ui_config.on_ready = lambda: callback_manager.execute_ready_callbacks()
        ui_config.on_closing = lambda: callback_manager.execute_closing_callbacks()
        ui_config.on_closed = lambda: callback_manager.execute_closed_callbacks()

        # Create and start PySide6 framework
        framework = PySide6Framework(ui_config)

        if config.debug:
            ColorPrint.green("[NativeLauncher] Phase 7: PySide6 UI created, starting event loop...")

        framework.start()  # Blocks until window closes

    except ImportError:
        ColorPrint.yellow("[NativeLauncher] PySide6 not available, skipping UI creation")
    except Exception as e:
        ColorPrint.red(f"[NativeLauncher] Failed to create PySide6 UI: {e}")
        import traceback
        traceback.print_exc()


# Alias for convenience
launch = launch_native_app
