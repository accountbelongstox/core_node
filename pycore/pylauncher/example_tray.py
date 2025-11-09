#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Launcher - System Tray Example

Demonstrates how to use the unified launcher with system tray menu
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pylauncher import (
    UnifiedLauncher,
    LauncherConfig,
    UIServiceConfig
)


def main():
    """Main entry point for tray example"""
    ColorPrint.green("=" * 70)
    ColorPrint.green(" Unified Launcher - System Tray Example")
    ColorPrint.green("=" * 70)

    ColorPrint.blue("\nThis example demonstrates:")
    ColorPrint.blue("  - Starting a native UI with system tray")
    ColorPrint.blue("  - Tray menu with Show/Hide/Exit")
    ColorPrint.blue("  - Left-click to show window")
    ColorPrint.blue("  - Right-click for menu")

    # Create configuration with tray enabled
    config = LauncherConfig(
        ui_service=UIServiceConfig(
            app_name="Tray Example Application",
            window_size=(800, 600),
            show_on_start=True,
            frameless=True,
            resizable=True,
            theme="dark",
            debug=True,
            # Enable system tray
            enable_tray=True,
            tray_tooltip="Tray Example - Right-click for menu",
            tray_icon_path=None,  # Will use default icon
            enabled=True
        ),
        # Disable other services
        web_service=None,
        mcp_service=None,
        selenium_service=None,
        auto_start_all=False
    )

    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Configuration")
    ColorPrint.green("=" * 70)
    ColorPrint.blue(f"  App Name: {config.ui_service.app_name}")
    ColorPrint.blue(f"  Window Size: {config.ui_service.window_size}")
    ColorPrint.blue(f"  System Tray: Enabled")
    ColorPrint.blue(f"  Tray Tooltip: {config.ui_service.tray_tooltip}")
    ColorPrint.green("=" * 70)

    # Create launcher
    ColorPrint.blue("\nCreating unified launcher...")
    launcher = UnifiedLauncher(config)

    # Start UI thread service (which includes tray)
    ColorPrint.blue("\nStarting UI thread service with system tray...")
    launcher.start_service('ui_thread_service')

    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Application Started")
    ColorPrint.green("=" * 70)
    ColorPrint.blue("\nSystem tray controls:")
    ColorPrint.blue("  - Left-click tray icon: Show window")
    ColorPrint.blue("  - Right-click tray icon: Open menu")
    ColorPrint.blue("  - Menu -> Show: Show window")
    ColorPrint.blue("  - Menu -> Hide: Hide window")
    ColorPrint.blue("  - Menu -> Exit: Close application")
    ColorPrint.blue("\nPress Ctrl+C to stop")
    ColorPrint.green("=" * 70 + "\n")

    try:
        # Wait for services
        launcher.wait()
    except KeyboardInterrupt:
        ColorPrint.yellow("\n\nShutting down...")
        launcher.stop_all()


if __name__ == '__main__':
    main()
