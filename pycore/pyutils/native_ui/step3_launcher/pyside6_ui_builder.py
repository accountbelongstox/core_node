#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pycore.pyutils.native_ui.step7_managers.callback_manager import CallbackManager

"""
PySide6 UI builder for the native UI launcher.

Holds _create_pyside6_ui (extracted from launch_native_app): webengine config,
PySide6UIConfig assembly, callback wiring, and framework lifecycle.

Framework creation is delegated to the pyside6 package
(PySide6Framework / PySide6UIConfig / configure_webengine_all_tiers); this
module only assembles the config and wires callbacks. The os.execv restart
tail is delegated to _restart.restart_process (shared with server mode).
"""

from typing import TYPE_CHECKING

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_pyside6
from pycore.pyutils.native_ui.step1_config.app_config import NativeUIConfig
from pycore.pyutils.native_ui.step5_main_ui.pyside6.webengine_config import configure_webengine_all_tiers
from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework
from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import PySide6UIConfig
from pycore.pyutils.native_ui.step5_main_ui.pyside6.system_tray import PySide6TrayMenuItem
from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import StartupWindowConfig
from pycore.pyutils.native_ui.step3_launcher._restart import restart_process

if TYPE_CHECKING:
    pass

try:
    from PySide6.QtWidgets import QApplication
    from PySide6.QtGui import QGuiApplication
except ImportError:
    # PySide6 will be installed on demand
    QApplication = None
    QGuiApplication = None


def _create_pyside6_ui(config: NativeUIConfig, url: str, callback_manager: "CallbackManager") -> None:
    """
    Create PySide6 UI with webview and system tray.

    Integrates callback_manager with PySide6 lifecycle events. Delegates
    framework creation to the pyside6 package (PySide6Framework /
    PySide6UIConfig / configure_webengine_all_tiers).
    """
    # Import PySide6 via third_party manager (will auto-install if needed)
    get_third_package_pyside6()  # Ensure PySide6 is installed

    # CRITICAL: Configure QtWebEngine BEFORE importing PySide6 modules
    # This must be done before QApplication is created
    if config.webengine_enable_config:
        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[NativeLauncher] CRITICAL: Configuring QtWebEngine BEFORE QApplication...")
        ColorPrint.blue("=" * 80)

        # Apply all tiers of WebEngine configuration with config options
        results = configure_webengine_all_tiers(
            env_flags=config.webengine_chromium_flags,
            qputenv_flags=config.webengine_chromium_flags,
            enable_webcodecs=config.webengine_enable_webcodecs,
            enable_hardware_acceleration=config.webengine_enable_hardware_acceleration,
            disable_gpu_sandbox=config.webengine_disable_gpu_sandbox,
            enable_remote_debugging=config.webengine_enable_remote_debugging,
            remote_debugging_port=config.webengine_remote_debugging_port,
            print_diagnostics=config.webengine_print_diagnostics
        )

        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[NativeLauncher] QtWebEngine configuration completed")
        ColorPrint.blue("=" * 80)
    else:
        ColorPrint.yellow("[NativeLauncher] QtWebEngine configuration DISABLED (webengine_enable_config=False)")

    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Phase 7: Creating PySide6 UI...")

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

    # Extract window size (support tuple or "fullscreen")
    if isinstance(config.window_size, tuple):
        window_width, window_height = config.window_size
    elif config.window_size == "fullscreen":
        # Get screen size for fullscreen
        screen = None
        if QApplication and QGuiApplication:
            screen = QGuiApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            window_width, window_height = screen_geometry.width(), screen_geometry.height()
            if config.debug:
                ColorPrint.green(f"[NativeLauncher] Fullscreen mode: {window_width}x{window_height}")
        else:
            window_width, window_height = 1920, 1080  # Fallback
    else:
        window_width, window_height = 1280, 900  # Default

    # Create PySide6 UI config
    # Tray differentiation: Only enable PySide6 tray if tray_type is "pyside6"
    # If tray_type is "tk", pystray tray is already started via pylauncher
    enable_pyside6_tray = config.enable_tray and config.tray_type == "pyside6"

    ui_config = PySide6UIConfig(
        app_name=config.app_name,
        app_id=config.app_id,
        webview_url=url,
        window_size=(window_width, window_height),
        show_on_start=config.show_on_start,
        frameless=config.frameless,
        icon_path=config.icon_path,
        enable_tray=enable_pyside6_tray,
        tray_menu_items=pyside6_tray_items,
        # QtWebEngine configuration
        enable_dev_tools=config.webengine_enable_remote_debugging,  # Fixed: was webengine_enable_dev_tools
        webengine_enable_config=config.webengine_enable_config,
        webengine_chromium_flags=config.webengine_chromium_flags,
        webengine_disable_gpu_sandbox=config.webengine_disable_gpu_sandbox,
        webengine_enable_webcodecs=config.webengine_enable_webcodecs,
        webengine_enable_hardware_acceleration=config.webengine_enable_hardware_acceleration,
        webengine_enable_remote_debugging=config.webengine_enable_remote_debugging,
        webengine_remote_debugging_port=config.webengine_remote_debugging_port,
        webengine_print_diagnostics=config.webengine_print_diagnostics
    )

    if config.debug and config.enable_tray:
        if enable_pyside6_tray:
            ColorPrint.blue("[NativeLauncher] PySide6 tray enabled (tray_type=pyside6)")
        else:
            ColorPrint.blue(f"[NativeLauncher] PySide6 tray disabled (using {config.tray_type} backend)")

    # Wire callbacks from callback_manager
    ui_config.on_ready = lambda: callback_manager.execute_ready_callbacks()
    ui_config.on_closing = lambda: callback_manager.execute_closing_callbacks()
    ui_config.on_closed = lambda: callback_manager.execute_closed_callbacks()

    # Only one tk window: if launcher already shows TkinterStartupThread (show_debug_window),
    # do not show framework's tk window (pass show_startup=False).
    startup_config = None
    if config.show_debug_window:
        startup_config = StartupWindowConfig(
            app_name=config.app_name,
            icon_path=config.icon_path,
            show_startup=False,
            auto_close=True,
            daemon=True
        )

    # Create and start PySide6 framework
    framework = PySide6Framework(ui_config, startup_config)

    # Register shutdown handler to close window after all services stopped
    # This must be registered AFTER framework is created and BEFORE framework.start()
    # Priority 0 ensures it runs LAST (after all other shutdown handlers complete)
    def handle_final_quit():
        """
        Final shutdown handler - quit PySide6 framework after all services stopped

        This handler runs LAST (priority=0) to ensure all services are stopped before quitting Qt.
        It calls framework.quit() which will:
        1. Set _force_close=True on main window
        2. Call window.close() again (this time it will accept the close)
        3. Quit Qt application
        """
        ColorPrint.blue("[NativeLauncher] All services stopped, calling framework.quit()...")
        framework.quit()

    THREAD_BUS.register_shutdown_handler(handle_final_quit, priority=0, name="pyside6_quit")
    ColorPrint.blue("[NativeLauncher] Registered final shutdown handler (priority=0) to quit framework")

    if config.debug:
        ColorPrint.print_success("[NativeLauncher] Phase 7: PySide6 UI created, starting event loop...")

    framework.start()  # Blocks until window closes

    # After UI exits, check if restart was requested (else clean shutdown)
    restart_process()
