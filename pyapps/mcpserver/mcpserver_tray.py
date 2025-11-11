#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server with Tkinter Tray - Minimal UI Mode

Launches MCP server with:
- Tkinter debug window (shows dependency check, then closes)
- Tkinter system tray menu (persists after debug window closes)
- NO PySide6 resources (lightweight mode)
- MCP server backend in separate thread

Usage:
    python mcpserver_tray.py
    python pymain.py app=mcp

Architecture:
- TkinterStartupThread handles both debug window and tray
- Debug window closes after initialization
- Tray menu persists for controlling MCP server
- All communication via THREAD_BUS
"""

import sys
import os
import threading
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.native_ui import get_bus_manager, BusSignals
from pycore.pyutils.native_ui.tray_config import TrayConfig, TrayMenuItem, TrayBackend
from pycore.pylauncher import NativeUILauncher, LaunchMode

# Import MCP server
from pyapps.mcpserver.mcpserver_main import UnifiedMCPServer


class MCPServerThread(threading.Thread):
    """
    MCP Server background thread

    Runs the MCP server in a separate thread.
    Communicates status via THREAD_BUS.
    """

    def __init__(self):
        super().__init__()
        self.daemon = False
        self.server = None
        self._stop_event = threading.Event()

    def run(self):
        """Run MCP server"""
        ColorPrint.blue("[MCPServerThread] Starting MCP server...")

        # Set thread state
        THREAD_BUS.set_thread_state('MCPServerThread', 'starting')

        # Create server
        self.server = UnifiedMCPServer(
            singleton_host='localhost',
            singleton_port=19997,
            rpc_host='localhost',
            rpc_port=8767,
            debug=True
        )

        # Set callbacks
        self.server.on_primary_started(
            lambda: ColorPrint.green("[MCPServerThread] Started as PRIMARY instance")
        )
        self.server.on_secondary_started(
            lambda: ColorPrint.green("[MCPServerThread] Started as SECONDARY instance")
        )

        # Start server
        if self.server.start():
            THREAD_BUS.set_thread_state('MCPServerThread', 'running')
            THREAD_BUS.signal('mcp_server_ready', {
                'is_primary': self.server.is_primary_instance(),
                'rpc_port': 8767,
                'singleton_port': 19997
            })

            ColorPrint.green("[MCPServerThread] MCP server is running")

            # Keep running until stop requested
            while not self._stop_event.is_set() and self.server.is_running():
                time.sleep(0.5)

        else:
            ColorPrint.red("[MCPServerThread] Failed to start MCP server")
            THREAD_BUS.signal('mcp_server_error', {'error': 'Failed to start'})

        # Cleanup
        THREAD_BUS.set_thread_state('MCPServerThread', 'stopped')
        ColorPrint.blue("[MCPServerThread] MCP server thread stopped")

    def stop(self):
        """Stop server thread"""
        ColorPrint.yellow("[MCPServerThread] Stopping MCP server...")
        self._stop_event.set()

        if self.server:
            self.server.stop()


def configure_tray_menu():
    """
    Configure tray menu via THREAD_BUS manager

    This sets up the tray configuration that will be read by
    TkinterStartupThread when it enters tray-only mode.
    """
    bus_mgr = get_bus_manager()

    # Create tray menu items
    menu_items = [
        TrayMenuItem(
            text="Show Status",
            signal=BusSignals.TRAY_SHOW,
            default=True
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="MCP Server Info",
            signal="mcp_show_info"
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Exit MCP Server",
            signal=BusSignals.TRAY_EXIT
        )
    ]

    # Create tray configuration
    tray_config = TrayConfig(
        enabled=True,
        backend=TrayBackend.TKINTER,
        app_name="MCP Server",
        icon_path=None,  # Will use default icon
        menu_items=menu_items,
        show_on_minimize=True,
        start_minimized=False,
        close_to_tray=True
    )

    # Store in THREAD_BUS via manager
    bus_mgr.set_tray_config(tray_config)

    ColorPrint.green("[Config] Tray menu configured")


def register_mcp_event_handlers(server_thread):
    """
    Register MCP server event handlers for lifecycle management

    Follows event-driven architecture pattern from EVENT_DRIVEN_ARCHITECTURE_GUIDE.md

    Args:
        server_thread: MCPServerThread instance
    """

    def on_app_close(event_data):
        """
        Handle app.close event - stop MCP server cleanly

        Priority 10 = high priority (runs first for critical cleanup)
        """
        source = event_data.get('source', 'unknown')
        ColorPrint.yellow(f"[MCP] App closing (source: {source})")

        # Stop MCP server thread
        ColorPrint.blue("[MCP] Stopping MCP server...")
        server_thread.stop()

        # Wait for server to stop with timeout
        server_thread.join(timeout=5.0)

        if server_thread.is_alive():
            ColorPrint.yellow("[MCP] Warning: Server thread did not stop in time")
        else:
            ColorPrint.green("[MCP] Server stopped successfully")

    # Register app.close handler with high priority (runs first)
    THREAD_BUS.register_event_handler('app.close', on_app_close, priority=10)

    ColorPrint.green("[MCP] Event handlers registered (app.close)")


def setup_tray_handlers(server_thread):
    """
    Setup handlers for tray menu signals

    Args:
        server_thread: MCPServerThread instance
    """

    def handle_show():
        """Handle tray 'Show Status' action"""
        ColorPrint.blue("[Tray] Show Status clicked")

        if server_thread.server:
            stats = server_thread.server.service_stats
            uptime = int(time.time() - stats['start_time'])
            role = "PRIMARY" if server_thread.server.is_primary_instance() else "SECONDARY"

            ColorPrint.green(f"MCP Server Status:")
            ColorPrint.green(f"  Role: {role}")
            ColorPrint.green(f"  Uptime: {uptime}s")
            ColorPrint.green(f"  Requests: {stats['total_requests']}")
            ColorPrint.green(f"  Services: {len(stats['services_loaded'])}")
        else:
            ColorPrint.yellow("MCP Server not running")

    def handle_info():
        """Handle tray 'MCP Server Info' action"""
        ColorPrint.blue("[Tray] MCP Server Info clicked")
        ColorPrint.green("MCP Server - Global Backend")
        ColorPrint.green("  • Unified RPC server for all MCP services")
        ColorPrint.green("  • WebSocket RPC: ws://localhost:8767")
        ColorPrint.green("  • Singleton Port: 19997")

    def handle_exit():
        """
        Handle tray 'Exit' action

        Uses event-driven architecture - triggers app.close event instead of direct sys.exit()
        This allows all components to cleanup properly before exit.
        """
        ColorPrint.yellow("[Tray] Exit clicked - triggering app.close event...")

        # Trigger app.close event (synchronous - wait for all handlers to complete)
        # This will call on_app_close which stops the MCP server
        THREAD_BUS.trigger_event('app.close', {'source': 'tray_menu'}, async_mode=False)

        # Stop the tray (allows main thread to continue)
        from pycore.pyutils.native_ui.thread_bus_manager import get_bus_manager
        bus_mgr = get_bus_manager()

        # Signal tray to stop
        THREAD_BUS.trigger_event(BusSignals.TRAY_STOP, {'source': 'exit_handler'})

        ColorPrint.green("[Tray] Cleanup complete - exiting gracefully")

    # Register handlers
    THREAD_BUS.register_event_handler(BusSignals.TRAY_SHOW, lambda data: handle_show())
    THREAD_BUS.register_event_handler("mcp_show_info", lambda data: handle_info())
    THREAD_BUS.register_event_handler(BusSignals.TRAY_EXIT, lambda data: handle_exit())

    ColorPrint.green("[Handlers] Tray menu handlers registered")


def main_app_entry():
    """
    Main application entry point

    Called after debug window is ready.
    Starts MCP server backend in separate thread.
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Server - Main Entry")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("")

    # Step 1: Create MCP server thread
    ColorPrint.blue("[1/4] Creating MCP server thread...")
    server_thread = MCPServerThread()
    ColorPrint.green("✓ MCP server thread created")

    # Step 2: Register event handlers (event-driven architecture)
    ColorPrint.blue("\n[2/4] Registering event handlers...")
    register_mcp_event_handlers(server_thread)
    ColorPrint.green("✓ Event handlers registered")

    # Step 3: Setup tray handlers
    ColorPrint.blue("\n[3/4] Setting up tray menu handlers...")
    setup_tray_handlers(server_thread)
    ColorPrint.green("✓ Tray handlers registered")

    # Step 4: Start MCP server
    ColorPrint.blue("\n[4/4] Starting MCP server backend...")
    server_thread.start()

    # Wait for server to be ready
    ColorPrint.yellow("Waiting for MCP server to start...")
    server_ready = THREAD_BUS.wait_signal('mcp_server_ready', timeout=15.0)

    if server_ready:
        ColorPrint.green("✓ MCP server is ready!")
        ColorPrint.blue("")
        ColorPrint.green("=" * 70)
        ColorPrint.green("MCP Server Running")
        ColorPrint.green("=" * 70)
        ColorPrint.green("  • Debug window will close")
        ColorPrint.green("  • Tray menu will remain active")
        ColorPrint.green("  • Right-click tray icon for menu")
        ColorPrint.green("=" * 70)
        ColorPrint.blue("")
    else:
        ColorPrint.red("ERROR: MCP server failed to start!")
        sys.exit(1)

    # Keep main thread alive (don't exit immediately)
    # The tray thread will keep the application running
    # Main thread can wait or do other work here

    # Wait for server thread to finish (when user clicks Exit in tray)
    server_thread.join()


def main():
    """Main entry point with startup window and tray"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Server - Tkinter Tray Mode")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("")

    # Configure tray menu BEFORE launching
    # This stores the tray config in THREAD_BUS for TkinterStartupThread to read
    ColorPrint.blue("Configuring tray menu...")
    configure_tray_menu()
    ColorPrint.green("✓ Tray configuration stored in THREAD_BUS")
    ColorPrint.blue("")

    # Launch with Native UI Launcher (includes singleton detection)
    ColorPrint.blue("Launching with Native UI Launcher (singleton detection enabled)...")
    ColorPrint.blue("")

    launcher = NativeUILauncher(
        app_id="mcp_server",
        port_start=54000,
        port_range=100,
        debug=True
    )

    result = launcher.launch(
        app_name="MCP Server - Debug Log",
        main_entry=main_app_entry,
        mode=LaunchMode.DEBUG_WITH_TRAY,
        startup_width=600,
        startup_height=500,
        min_display_time=2.0,
        enable_language_selector=False
    )

    if not result.success:
        ColorPrint.yellow("")
        ColorPrint.yellow("=" * 70)
        ColorPrint.yellow(f"Launch Result: {result.message}")
        ColorPrint.yellow("=" * 70)

        if result.existing_instance:
            ColorPrint.yellow(f"Existing instance detected at port {result.existing_port}")
            ColorPrint.yellow("MCP Server is already running.")

        sys.exit(0)


def start():
    """Alternative entry point (for compatibility)"""
    main()


if __name__ == '__main__':
    main()
