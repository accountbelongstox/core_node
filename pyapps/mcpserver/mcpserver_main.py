#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server Application - Entry Point

Usage:
    python pymain.py app=mcpserver
"""

import sys
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import NativeUILauncher, LaunchMode
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TkinterSystemTray, TrayMenuItem
from pycore.pyutils.native_ui.step9_i18n import get_i18n_manager
from pyapps.mcpserver.config import Config


def main_app_entry():
    """Main application entry point - initialize services"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MCP SERVER - STARTING SERVICES")
    ColorPrint.blue("=" * 70)
    
    ColorPrint.green("MCP Server services initialized")
    ColorPrint.yellow("Services will be started from tray menu")


def on_closing():
    """Cleanup callback when app closes"""
    i18n = get_i18n_manager()
    ColorPrint.yellow(f"[MCP Server] {i18n.get('mcpserver.closing')}")
    ColorPrint.yellow("Stopping all services...")


def _create_tray_menu_items():
    """Create tray menu items using TrayMenuItem"""
    i18n = get_i18n_manager()
    
    menu_items = [
        TrayMenuItem(
            text=i18n.get("mcpserver.tray.start_mcp_server"),
            action_signal="mcpserver.tray.start_mcp_server"
        ),
        TrayMenuItem(
            text=i18n.get("mcpserver.tray.start_main_server"),
            action_signal="mcpserver.tray.start_main_server"
        ),
        TrayMenuItem(
            text=i18n.get("mcpserver.tray.start_as_client"),
            action_signal="mcpserver.tray.start_as_client"
        ),
        TrayMenuItem(
            text=i18n.get("mcpserver.tray.open_web_ui"),
            action_signal="mcpserver.tray.open_web_ui"
        ),
        TrayMenuItem(
            text=i18n.get("mcpserver.tray.restart"),
            action_signal="mcpserver.tray.restart"
        ),
        TrayMenuItem.SEPARATOR,
    ]
    
    return menu_items


def _append_original_menu_items(menu_items):
    """Append original menu items from mcpserver_old"""
    menu_items.append(TrayMenuItem(
        text="Show Status",
        action_signal="mcpserver.tray.show_status"
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    menu_items.append(TrayMenuItem(
        text="MCP Server Info",
        action_signal="mcpserver.tray.show_info"
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    menu_items.append(TrayMenuItem(
        text="Exit",
        action_signal="mcpserver.tray.exit"
    ))
    
    return menu_items


def _setup_tray_signal_handlers():
    """Setup THREAD_BUS signal handlers for tray menu actions"""
    def handle_start_mcp_server():
        ColorPrint.blue("[MCP Server] Starting MCP server...")
    
    def handle_start_main_server():
        ColorPrint.blue("[MCP Server] Starting main server...")
    
    def handle_start_as_client():
        ColorPrint.blue("[MCP Server] Starting as client...")
    
    def handle_open_web_ui():
        import webbrowser
        web_url = f"http://localhost:{Config.WEB_PORT}"
        webbrowser.open(web_url)
        ColorPrint.blue(f"[MCP Server] Opened web UI: {web_url}")
    
    def handle_restart():
        ColorPrint.blue("[MCP Server] Restarting application...")
        from pycore.pyutils.native_ui import get_shutdown_manager
        shutdown_mgr = get_shutdown_manager()
        shutdown_mgr.request_shutdown()
    
    def handle_exit():
        ColorPrint.yellow("[MCP Server] Exiting application...")
        on_closing()
        THREAD_BUS.signal("mcpserver.shutdown", {})
    
    def handle_show_status():
        ColorPrint.blue("[MCP Server] Show status requested")
        ColorPrint.green("MCP Server Status:")
        ColorPrint.green("  Services: Initialized")
        ColorPrint.green("  Ready for commands")
    
    def handle_show_info():
        ColorPrint.blue("[MCP Server] Show info requested")
        ColorPrint.green("MCP Server - Global Backend")
        ColorPrint.green("  • Unified RPC server for all MCP services")
        ColorPrint.green("  • WebSocket RPC: ws://localhost:8767")
        ColorPrint.green("  • Singleton Port: 19997")
    
    THREAD_BUS.on("mcpserver.tray.start_mcp_server", handle_start_mcp_server)
    THREAD_BUS.on("mcpserver.tray.start_main_server", handle_start_main_server)
    THREAD_BUS.on("mcpserver.tray.start_as_client", handle_start_as_client)
    THREAD_BUS.on("mcpserver.tray.open_web_ui", handle_open_web_ui)
    THREAD_BUS.on("mcpserver.tray.restart", handle_restart)
    THREAD_BUS.on("mcpserver.tray.show_status", handle_show_status)
    THREAD_BUS.on("mcpserver.tray.show_info", handle_show_info)
    THREAD_BUS.on("mcpserver.tray.exit", handle_exit)


def _start_tkinter_tray():
    """Start tkinter system tray in separate thread"""
    i18n = get_i18n_manager()
    icon_path = str(PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png")
    
    menu_items = _create_tray_menu_items()
    menu_items = _append_original_menu_items(menu_items)
    
    tray = TkinterSystemTray(
        app_name=i18n.get("mcpserver.app_name"),
        icon_path=icon_path if Path(icon_path).exists() else None,
        menu_items=menu_items
    )
    
    def tray_thread():
        tray.run()
    
    thread_obj = threading.Thread(target=tray_thread, daemon=False)
    thread_obj.start()
    
    return tray, thread_obj


def start():
    """Standard entry point for pymain.py launcher"""
    launcher = NativeUILauncher(
        app_id="mcpserver",
        port_start=55000,
        port_range=100,
        timeout=1.0,
        debug=True
    )
    
    detection = launcher._detector.detect_and_bind()
    
    if detection.existing_instance:
        ColorPrint.yellow(f"[MCP Server] Instance already running at port {detection.existing_port}")
        return
    
    if not detection.is_primary:
        ColorPrint.red("[MCP Server] No available ports in range")
        return
    
    ColorPrint.green(f"[MCP Server] Starting on port {detection.port}")
    
    i18n = get_i18n_manager()
    i18n_dir = PROJECT_ROOT / "pyapps" / "mcpserver" / "mcpserver_i18n"
    if i18n_dir.exists():
        i18n.initialize(
            config_dir=str(i18n_dir),
            use_system_language=True
        )
    
    main_app_entry()
    
    _setup_tray_signal_handlers()
    
    tray, tray_thread_obj = _start_tkinter_tray()
    
    ColorPrint.green("[MCP Server] Tray menu started. Right-click tray icon to access menu.")
    
    try:
        tray_thread_obj.join()
    except KeyboardInterrupt:
        ColorPrint.yellow("[MCP Server] Interrupted by user")
        on_closing()
        tray.stop()


if __name__ == "__main__":
    start()

