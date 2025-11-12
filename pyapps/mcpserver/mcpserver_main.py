#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server Application - Entry Point

Usage:
    python pymain.py app=mcpserver
"""

import sys
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import NativeUILauncher, LaunchMode
from pycore.pyutils.native_ui.step1_config.tray_config import TrayConfig, TrayMenuItem, TrayBackend
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import get_bus_manager, BusSignals
from pycore.pyutils.native_ui.step0_i18n import i18n
from pyapps.mcpserver.config import Config
from pyapps.mcpserver.mcpserver_bus_keys import MCPServerBusKeys, register_bus_keys
from pyapps.mcpserver.mcpserver_i18n import MCPServerI18nKeys


def main_app_entry():
    """Main application entry point - initialize services and configure tray"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MCP SERVER - STARTING SERVICES")
    ColorPrint.blue("=" * 70)
    
    ColorPrint.green("MCP Server services initialized")
    ColorPrint.yellow("Services will be started from tray menu")
    
    # Setup tray configuration via THREAD_BUS manager
    _configure_tray_menu()


def on_closing():
    """Cleanup callback when app closes"""
    ColorPrint.yellow(f"[MCP Server] {i18n.get(MCPServerI18nKeys.CLOSING)}")
    ColorPrint.yellow("Stopping all services...")


def _create_tray_menu_items():
    """Create tray menu items using TrayMenuItem from tray_config"""
    menu_items = [
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_MCP_SERVER,
            signal=MCPServerBusKeys.TRAY_START_MCP_SERVER
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_MAIN_SERVER,
            signal=MCPServerBusKeys.TRAY_START_MAIN_SERVER
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_AS_CLIENT,
            signal=MCPServerBusKeys.TRAY_START_AS_CLIENT
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_OPEN_WEB_UI,
            signal=MCPServerBusKeys.TRAY_OPEN_WEB_UI
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_RESTART,
            signal=MCPServerBusKeys.TRAY_RESTART
        ),
        TrayMenuItem.SEPARATOR,
    ]
    
    return menu_items




def _append_original_menu_items(menu_items):
    """Append original menu items from mcpserver_old"""
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_SHOW_STATUS,
        signal=MCPServerBusKeys.TRAY_SHOW_STATUS
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_SHOW_INFO,
        signal=MCPServerBusKeys.TRAY_SHOW_INFO
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    
    # Add language selection menu with submenu
    language_submenu = _create_language_submenu()
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_LANGUAGE,
        signal="",  # No direct action, only submenu
        submenu=language_submenu
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_EXIT,
        signal=MCPServerBusKeys.TRAY_EXIT
    ))
    
    return menu_items


def _configure_tray_menu():
    """Configure tray menu via THREAD_BUS manager"""
    icon_path = str(PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png")
    
    menu_items = _create_tray_menu_items()
    menu_items = _append_original_menu_items(menu_items)
    
    tray_config = TrayConfig(
        enabled=True,
        backend=TrayBackend.TKINTER,
        app_name=i18n.get(MCPServerI18nKeys.APP_NAME),
        icon_path=icon_path if Path(icon_path).exists() else None,
        menu_items=menu_items,
        show_on_minimize=True,
        start_minimized=False,
        close_to_tray=True
    )
    
    bus_mgr = get_bus_manager()
    bus_mgr.set_tray_config(tray_config)
    
    ColorPrint.green("[MCP Server] Tray configuration stored in THREAD_BUS")


def _setup_tray_signal_handlers():
    """Setup THREAD_BUS event handlers for tray menu actions"""
    def handle_start_mcp_server(event_data):
        ColorPrint.blue("[MCP Server] Starting MCP server...")
    
    def handle_start_main_server(event_data):
        ColorPrint.blue("[MCP Server] Starting main server...")
    
    def handle_start_as_client(event_data):
        ColorPrint.blue("[MCP Server] Starting as client...")
    
    def handle_open_web_ui(event_data):
        web_url = f"http://localhost:{Config.WEB_PORT}"
        webbrowser.open(web_url)
        ColorPrint.blue(f"[MCP Server] Opened web UI: {web_url}")
    
    def handle_restart(event_data):
        ColorPrint.blue("[MCP Server] Restarting application...")
        THREAD_BUS.trigger_event(BusSignals.TRAY_STOP, {"source": "restart_handler"})
    
    def handle_exit(event_data):
        ColorPrint.yellow("[MCP Server] Exiting application...")
        on_closing()
        THREAD_BUS.trigger_event(BusSignals.TRAY_STOP, {"source": "exit_handler"})
    
    def handle_show_status(event_data):
        ColorPrint.blue("[MCP Server] Show status requested")
        ColorPrint.green("MCP Server Status:")
        ColorPrint.green("  Services: Initialized")
        ColorPrint.green("  Ready for commands")
    
    def handle_show_info(event_data):
        ColorPrint.blue("[MCP Server] Show info requested")
        ColorPrint.green("MCP Server - Global Backend")
        ColorPrint.green("  • Unified RPC server for all MCP services")
        ColorPrint.green("  • WebSocket RPC: ws://localhost:8767")
        ColorPrint.green("  • Singleton Port: 19997")
    
    # Setup language change handler (using library function)
    bus_mgr = get_bus_manager()
    bus_mgr.setup_language_change_handler(MCPServerBusKeys.TRAY_SET_LANGUAGE)
    
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_MCP_SERVER, handle_start_mcp_server)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_MAIN_SERVER, handle_start_main_server)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_AS_CLIENT, handle_start_as_client)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_OPEN_WEB_UI, handle_open_web_ui)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_RESTART, handle_restart)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_SHOW_STATUS, handle_show_status)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_SHOW_INFO, handle_show_info)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_EXIT, handle_exit)


def start():
    """Standard entry point for pymain.py launcher"""
    # Register app-specific BusKeys (required)
    register_bus_keys()
    
    # Extend i18n with app-specific translations (base translations already loaded)
    app_dir = Path(__file__).parent
    i18n.extend_translations(
        app_dir=str(app_dir),
        app_name="mcpserver",
        use_system_language=True
    )
    
    # Setup tray signal handlers before launching
    _setup_tray_signal_handlers()
    
    # Create launcher
    launcher = NativeUILauncher(
        app_id="mcpserver",
        port_start=55000,
        port_range=100,
        timeout=1.0,
        debug=True
    )
    
    icon_path = str(PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png")
    
    # Launch using NativeUILauncher.launch() method
    result = launcher.launch(
        app_name=i18n.get(MCPServerI18nKeys.APP_NAME),
        main_entry=main_app_entry,
        mode=LaunchMode.TRAY_ONLY,
        startup_width=600,
        startup_height=500,
        min_display_time=2.0,
        icon_path=icon_path if Path(icon_path).exists() else None,
        enable_language_selector=True
    )
    
    if not result.success:
        if result.existing_instance:
            ColorPrint.yellow(f"[MCP Server] Instance already running at port {result.existing_port}")
        else:
            ColorPrint.red(f"[MCP Server] Launch failed: {result.message}")
        return
    
    ColorPrint.green(f"[MCP Server] Launched successfully on port {result.port}")
    ColorPrint.green("[MCP Server] Tray menu started. Right-click tray icon to access menu.")


if __name__ == "__main__":
    start()

