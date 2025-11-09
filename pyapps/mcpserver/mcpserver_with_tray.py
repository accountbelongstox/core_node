#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server with System Tray

Launches MCP Server with native UI and system tray menu

Usage:
    python -m pyapps.mcpserver.mcpserver_with_tray
    python pyapps/mcpserver/mcpserver_with_tray.py
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pylauncher import UnifiedLauncher, LauncherConfig, UIServiceConfig, MCPServiceConfig

# Import tray configuration
from pyapps.mcpserver.config import create_tray_menu


def main():
    """
    Main entry point for MCP Server with system tray
    """
    ColorPrint.green("=" * 80)
    ColorPrint.green(" MCP Server - With System Tray")
    ColorPrint.green("=" * 80)

    ColorPrint.blue("\nStarting MCP Server with native UI and system tray...")

    # Create launcher configuration
    config = LauncherConfig(
        # MCP Service configuration
        mcp_service=MCPServiceConfig(
            singleton_port=19997,
            rpc_port=8767,
            debug=True,
            enabled=True
        ),

        # UI Service configuration with system tray
        ui_service=UIServiceConfig(
            app_name="MCP Server",
            window_size=(1200, 800),
            min_window_size=(800, 600),
            frameless=True,
            show_on_start=True,
            resizable=True,
            theme="dark",
            debug=True,
            # Enable system tray
            enable_tray=True,
            tray_tooltip="MCP Server - Right-click for menu",
            tray_icon_path=None,  # Use default icon
            enabled=True
        ),

        # Disable other services
        web_service=None,
        selenium_service=None,

        auto_start_all=False,
        startup_delay=1.0
    )

    # Create launcher
    ColorPrint.blue("\nCreating unified launcher...")
    launcher = UnifiedLauncher(config)

    # Start MCP service first
    ColorPrint.blue("\nStarting MCP service...")
    launcher.start_service('mcp_service')

    # Wait for MCP server to initialize
    time.sleep(2)

    # Register custom UI service with tray menu
    ColorPrint.blue("\nRegistering custom UI service with tray menu...")

    def custom_ui_entry(ui_config):
        """Custom UI service with MCP-specific tray menu"""
        from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig
        from pycore.pyutils.native_ui import SystemTray

        ColorPrint.green("[MCPServerUI] Starting UI thread with custom tray menu...")

        # Create UI thread configuration
        ui_thread_config = NativeUIThreadConfig(
            app_name=ui_config.app_name,
            width=ui_config.window_size[0],
            height=ui_config.window_size[1],
            show_on_start=ui_config.show_on_start,
            resizable=ui_config.resizable,
            frameless=ui_config.frameless,
            theme=ui_config.theme if hasattr(ui_config, 'theme') else 'dark',
            debug=ui_config.debug
        )

        # Create and start UI thread
        ui_thread = NativeUIThread(
            config=ui_thread_config,
            thread_name="MCPServerUI"
        )

        ui_thread.start()
        ui_thread.wait_until_ready()

        ColorPrint.green("[MCPServerUI] UI thread ready")

        # Get MCP server instance from launcher
        mcp_server_instance = None
        if 'mcp_service' in launcher.services:
            mcp_service = launcher.services['mcp_service']
            if hasattr(mcp_service, 'service_instance'):
                mcp_server_instance = mcp_service.service_instance

        # Create custom tray menu for MCP server
        ColorPrint.blue("[MCPServerUI] Creating MCP-specific tray menu...")

        callbacks, menu_items = create_tray_menu(mcp_server_instance)
        callbacks.set_ui_window(ui_thread)

        # Create and start system tray
        tooltip = ui_config.tray_tooltip if hasattr(ui_config, 'tray_tooltip') and ui_config.tray_tooltip else ui_config.app_name
        icon_path = ui_config.tray_icon_path if hasattr(ui_config, 'tray_icon_path') else None

        system_tray = SystemTray(
            app_name=ui_config.app_name,
            menu_items=menu_items,
            icon_path=icon_path,
            tooltip=tooltip,
            on_left_click=callbacks.on_show_window
        )

        system_tray.start_async()
        ColorPrint.green("[MCPServerUI] System tray started with MCP menu")

        # Keep thread running
        try:
            while ui_thread.is_running():
                time.sleep(0.1)
        except Exception as e:
            ColorPrint.red(f"[MCPServerUI] Thread error: {e}")
        finally:
            # Stop system tray
            if system_tray:
                system_tray.stop()

        return ui_thread

    # Register custom service
    launcher.register_custom_service(
        service_name='mcp_ui_with_tray',
        entry_point=custom_ui_entry,
        config=config.ui_service,
        daemon=True
    )

    # Start custom UI service
    ColorPrint.blue("\nStarting UI service with tray menu...")
    launcher.start_service('mcp_ui_with_tray')

    ColorPrint.green("\n" + "=" * 80)
    ColorPrint.green(" MCP Server Started Successfully")
    ColorPrint.green("=" * 80)
    ColorPrint.blue("\nServices running:")
    ColorPrint.blue("  - MCP Service: RPC Port 8767")
    ColorPrint.blue("  - UI Window: Native Tkinter")
    ColorPrint.blue("  - System Tray: Active with MCP menu")
    ColorPrint.blue("\nSystem tray menu:")
    ColorPrint.blue("  - Window: Show/Hide")
    ColorPrint.blue("  - Server: Status/Restart")
    ColorPrint.blue("  - Services: Codebase Scanner, File Processor, etc.")
    ColorPrint.blue("  - Tools: Open Logs, Config, Browser")
    ColorPrint.blue("  - Help: Documentation, About")
    ColorPrint.blue("  - Exit")
    ColorPrint.blue("\nPress Ctrl+C to stop")
    ColorPrint.green("=" * 80 + "\n")

    try:
        # Wait for services
        launcher.wait()
    except KeyboardInterrupt:
        ColorPrint.yellow("\n\nShutting down MCP Server...")
        launcher.stop_all()


if __name__ == '__main__':
    main()
