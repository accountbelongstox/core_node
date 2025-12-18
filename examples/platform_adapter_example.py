#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Platform Adapter Integration Example

Demonstrates how to use PlatformAdapter with pylauncher to create
cross-platform applications with automatic tray configuration.

This example shows:
1. Platform detection and capability checking
2. Auto-configuration of tray based on platform
3. Integration with LauncherConfig
4. Platform-specific QtWebEngine flags
5. Event handling for tray menu items
"""

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore.pyutils.native_ui import get_platform_adapter


def create_tray_menu_items():
    """
    Create tray menu items

    Returns:
        List of menu item dicts
    """
    return [
        {
            "text": "Show Main Window",
            "action": "ui.window.show"
        },
        {
            "text": "Hide Main Window",
            "action": "ui.window.hide"
        },
        {
            "text": "---"  # Separator
        },
        {
            "text": "Settings",
            "action": "ui.settings.open"
        },
        {
            "text": "About",
            "action": "ui.about.show"
        },
        {
            "text": "---"  # Separator
        },
        {
            "text": "Restart Application",
            "action": "app.restart"
        },
        {
            "text": "Exit Application",
            "action": "app.exit"
        }
    ]


def register_tray_event_handlers():
    """
    Register THREAD_BUS event handlers for tray menu items
    """
    ColorPrint.blue("[TrayEvents] Registering tray event handlers...")

    def handle_window_show(event_data):
        ColorPrint.green("[TrayEvents] Show window requested")
        # Implement window show logic
        # For example: main_window.show()

    def handle_window_hide(event_data):
        ColorPrint.yellow("[TrayEvents] Hide window requested")
        # Implement window hide logic
        # For example: main_window.hide()

    def handle_settings_open(event_data):
        ColorPrint.blue("[TrayEvents] Open settings requested")
        # Implement settings dialog logic

    def handle_about_show(event_data):
        ColorPrint.blue("[TrayEvents] Show about dialog requested")
        # Implement about dialog logic

    def handle_app_restart(event_data):
        ColorPrint.yellow("[TrayEvents] Restart requested")
        THREAD_BUS.trigger_event('app.restart', {'source': 'tray_menu'})

    def handle_app_exit(event_data):
        ColorPrint.red("[TrayEvents] Exit requested")
        THREAD_BUS.request_shutdown(reason="User requested exit from tray menu")

    # Register handlers
    THREAD_BUS.register_event_handler('ui.window.show', handle_window_show)
    THREAD_BUS.register_event_handler('ui.window.hide', handle_window_hide)
    THREAD_BUS.register_event_handler('ui.settings.open', handle_settings_open)
    THREAD_BUS.register_event_handler('ui.about.show', handle_about_show)
    THREAD_BUS.register_event_handler('app.restart', handle_app_restart)
    THREAD_BUS.register_event_handler('app.exit', handle_app_exit)

    ColorPrint.green("[TrayEvents] Tray event handlers registered")


def main():
    """
    Main entry point with platform adaptation
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Platform Adapter Integration Example")
    ColorPrint.blue("=" * 70)

    # Step 1: Get platform adapter and print platform info
    adapter = get_platform_adapter()
    adapter.print_platform_info()

    # Step 2: Check tray availability
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Tray Configuration")
    ColorPrint.blue("=" * 70)

    if adapter.can_use_tray():
        ColorPrint.green("[Platform] System tray is available")
        backend = adapter.get_recommended_tray_backend()
        ColorPrint.blue(f"[Platform] Recommended tray backend: {backend.value}")

        # Create tray menu
        tray_menu_items = create_tray_menu_items()
        enable_tray = True
    else:
        ColorPrint.yellow("[Platform] System tray not available on this platform")
        ColorPrint.yellow("[Platform] Tray will be disabled")
        tray_menu_items = []
        enable_tray = False

    # Step 3: Create launcher config with platform adaptation
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Launcher Configuration")
    ColorPrint.blue("=" * 70)

    config = LauncherConfig(
        # App identification
        app_id="platform_adapter_example",
        app_name="Platform Adapter Example",

        # Singleton configuration
        singleton=True,
        shutdown_existing=True,

        # Tray configuration (auto-adapted)
        enable_tray=enable_tray,
        tray_backend="auto",  # Will use adapter.get_recommended_tray_backend()
        tray_icon_path=None,  # Will use default icon
        tray_menu_items=tray_menu_items,

        # Services
        services={
            'heartbeat': {},
            'rpc_v2': {
                'port': 58200,
                'host': '0.0.0.0',
                'debug': True
            }
        }
    )

    ColorPrint.green("[Config] Launcher configuration created")
    ColorPrint.blue(f"[Config] App ID: {config.app_id}")
    ColorPrint.blue(f"[Config] App Name: {config.app_name}")
    ColorPrint.blue(f"[Config] Singleton: {config.singleton}")
    ColorPrint.blue(f"[Config] Tray Enabled: {config.enable_tray}")
    ColorPrint.blue(f"[Config] Tray Backend: {config.tray_backend}")
    ColorPrint.blue(f"[Config] Tray Menu Items: {len(config.tray_menu_items)}")

    # Step 4: Register tray event handlers (if tray enabled)
    if enable_tray:
        ColorPrint.blue("\n" + "=" * 70)
        register_tray_event_handlers()

    # Step 5: Start launcher
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Starting Application")
    ColorPrint.blue("=" * 70)

    launcher = ServiceLauncher(config)
    success = launcher.start()

    if success:
        ColorPrint.green("[Launcher] Application started successfully")

        # Get QtWebEngine flags (for reference)
        qtwebengine_flags = adapter.get_qtwebengine_flags()
        ColorPrint.blue("\n[Platform] QtWebEngine flags:")
        ColorPrint.blue(f"  {qtwebengine_flags}")

        # Windows: Set AppUserModelID
        if adapter.is_windows:
            appid = adapter.get_windows_appusermodelid(config.app_id, config.app_name)
            ColorPrint.blue(f"\n[Platform] Windows AppUserModelID: {appid}")

        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green("Application is running")
        ColorPrint.green("=" * 70)

        if enable_tray:
            ColorPrint.blue("System tray is active - check your system tray area")
            ColorPrint.blue("Right-click the tray icon to access the menu")

        ColorPrint.yellow("\nPress Ctrl+C to stop the application")

        # Keep running
        try:
            import time
            while not THREAD_BUS.is_shutdown_requested():
                time.sleep(1)
        except KeyboardInterrupt:
            ColorPrint.yellow("\n[Main] Keyboard interrupt received")
            THREAD_BUS.request_shutdown(reason="Keyboard interrupt")

        # Stop launcher
        ColorPrint.blue("\n[Main] Stopping application...")
        launcher.stop()
        ColorPrint.green("[Main] Application stopped")

    else:
        ColorPrint.red("[Launcher] Failed to start application")
        return 1

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
