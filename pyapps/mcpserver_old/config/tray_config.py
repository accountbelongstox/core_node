#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server - System Tray Configuration

Defines tray menu structure and callbacks for mcpserver
"""

import sys
import webbrowser
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import TrayMenuItem


class TrayCallbacks:
    """
    System Tray Callbacks for MCP Server

    Provides all callback functions for tray menu items
    """

    def __init__(self, mcp_server: Optional[Any] = None):
        """
        Initialize tray callbacks

        Args:
            mcp_server: Reference to MCP server instance
        """
        self.mcp_server = mcp_server
        self.ui_window = None  # Will be set when UI is created

        ColorPrint.blue("[TrayCallbacks] Initialized")

    def set_ui_window(self, ui_window):
        """Set reference to UI window"""
        self.ui_window = ui_window
        ColorPrint.blue("[TrayCallbacks] UI window reference set")

    def set_mcp_server(self, mcp_server):
        """Set reference to MCP server"""
        self.mcp_server = mcp_server
        ColorPrint.blue("[TrayCallbacks] MCP server reference set")

    # ============================================
    # Window Controls
    # ============================================

    def on_show_window(self):
        """Show main window"""
        ColorPrint.blue("[TrayMenu] Show window requested")
        if self.ui_window and hasattr(self.ui_window, 'show'):
            self.ui_window.show()
        else:
            ColorPrint.print_warn("[TrayMenu] No UI window available")

    def on_hide_window(self):
        """Hide main window"""
        ColorPrint.blue("[TrayMenu] Hide window requested")
        if self.ui_window and hasattr(self.ui_window, 'hide'):
            self.ui_window.hide()
        else:
            ColorPrint.print_warn("[TrayMenu] No UI window available")

    # ============================================
    # Server Controls
    # ============================================

    def on_server_status(self):
        """Show server status"""
        ColorPrint.blue("[TrayMenu] Server status requested")

        if self.mcp_server:
            ColorPrint.green("=" * 60)
            ColorPrint.green(" MCP Server Status")
            ColorPrint.green("=" * 60)

            # Server info
            if hasattr(self.mcp_server, 'is_primary'):
                mode = "PRIMARY" if self.mcp_server.is_primary else "SECONDARY"
                ColorPrint.blue(f"  Mode: {mode}")

            if hasattr(self.mcp_server, 'rpc_port'):
                ColorPrint.blue(f"  RPC Port: {self.mcp_server.rpc_port}")

            if hasattr(self.mcp_server, 'singleton_port'):
                ColorPrint.blue(f"  Singleton Port: {self.mcp_server.singleton_port}")

            # Service stats
            if hasattr(self.mcp_server, 'service_stats'):
                stats = self.mcp_server.service_stats
                ColorPrint.blue(f"  Services Loaded: {len(stats.get('services_loaded', []))}")
                ColorPrint.blue(f"  Total Requests: {stats.get('total_requests', 0)}")

                uptime = 0
                if 'start_time' in stats:
                    uptime = int(time.time() - stats['start_time'])
                ColorPrint.blue(f"  Uptime: {uptime}s")

            ColorPrint.green("=" * 60)
        else:
            ColorPrint.print_warn("[TrayMenu] No MCP server instance available")

    def on_restart_server(self):
        """Restart server"""
        ColorPrint.yellow("[TrayMenu] Restart server requested")
        # TODO: Implement server restart logic
        ColorPrint.print_warn("[TrayMenu] Server restart not yet implemented")

    # ============================================
    # Services Menu
    # ============================================

    def on_codebase_scanner(self):
        """Open Codebase Scanner documentation"""
        ColorPrint.blue("[TrayMenu] Codebase Scanner selected")
        # Could open documentation or show service info
        ColorPrint.print_info("[TrayMenu] Codebase Scanner: Active")

    def on_file_processor(self):
        """Open File Processor documentation"""
        ColorPrint.blue("[TrayMenu] File Processor selected")
        ColorPrint.print_info("[TrayMenu] File Processor: Active")

    def on_ai_collaboration(self):
        """Open AI Collaboration documentation"""
        ColorPrint.blue("[TrayMenu] AI Collaboration selected")
        ColorPrint.print_info("[TrayMenu] AI Collaboration: Active")

    def on_database_service(self):
        """Open Database Service documentation"""
        ColorPrint.blue("[TrayMenu] Database Service selected")
        ColorPrint.print_info("[TrayMenu] Database Service: Active")

    # ============================================
    # Tools Menu
    # ============================================

    def on_open_logs(self):
        """Open logs directory"""
        ColorPrint.blue("[TrayMenu] Open logs requested")

        # Try to find logs directory
        log_dirs = [
            PROJECT_ROOT / "logs",
            PROJECT_ROOT / ".cache" / "logs",
            PROJECT_ROOT / "pyapps" / "mcpserver" / "logs"
        ]

        for log_dir in log_dirs:
            if log_dir.exists():
                ColorPrint.green(f"[TrayMenu] Opening logs: {log_dir}")
                import subprocess
                subprocess.Popen(['explorer', str(log_dir)])
                return

        ColorPrint.print_warn("[TrayMenu] No logs directory found")

    def on_open_config(self):
        """Open configuration directory"""
        ColorPrint.blue("[TrayMenu] Open config requested")

        config_dir = PROJECT_ROOT / "pyapps" / "mcpserver" / "config"
        if config_dir.exists():
            ColorPrint.green(f"[TrayMenu] Opening config: {config_dir}")
            import subprocess
            subprocess.Popen(['explorer', str(config_dir)])
        else:
            ColorPrint.print_warn("[TrayMenu] Config directory not found")

    def on_open_browser(self):
        """Open MCP server in browser"""
        ColorPrint.blue("[TrayMenu] Open browser requested")

        if self.mcp_server and hasattr(self.mcp_server, 'rpc_port'):
            url = f"http://localhost:{self.mcp_server.rpc_port}"
            ColorPrint.green(f"[TrayMenu] Opening: {url}")
            webbrowser.open(url)
        else:
            ColorPrint.print_warn("[TrayMenu] Server URL not available")

    # ============================================
    # Help Menu
    # ============================================

    def on_documentation(self):
        """Open documentation"""
        ColorPrint.blue("[TrayMenu] Documentation requested")

        docs_file = PROJECT_ROOT / "pyapps" / "mcpserver" / "README.md"
        if docs_file.exists():
            ColorPrint.green(f"[TrayMenu] Opening docs: {docs_file}")
            import subprocess
            subprocess.Popen(['notepad', str(docs_file)])
        else:
            ColorPrint.print_warn("[TrayMenu] Documentation not found")

    def on_about(self):
        """Show about information"""
        ColorPrint.blue("[TrayMenu] About requested")

        ColorPrint.green("=" * 60)
        ColorPrint.green(" MCP Server - Unified MCP Services")
        ColorPrint.green("=" * 60)
        ColorPrint.blue("  Version: 1.0.0")
        ColorPrint.blue("  Services:")
        ColorPrint.blue("    - Codebase Scanner")
        ColorPrint.blue("    - File Processor")
        ColorPrint.blue("    - AI Collaboration")
        ColorPrint.blue("    - Database Service")
        ColorPrint.blue("    - Image Generator")
        ColorPrint.blue("  ")
        ColorPrint.blue("  Architecture:")
        ColorPrint.blue("    - Singleton RPC Backend")
        ColorPrint.blue("    - WebSocket Communication")
        ColorPrint.blue("    - Multi-client Support")
        ColorPrint.green("=" * 60)

    # ============================================
    # Exit
    # ============================================

    def on_exit(self):
        """Exit application"""
        ColorPrint.yellow("[TrayMenu] Exit requested")

        # Stop UI window
        if self.ui_window and hasattr(self.ui_window, 'stop'):
            self.ui_window.stop()

        # Stop MCP server
        if self.mcp_server and hasattr(self.mcp_server, 'stop'):
            self.mcp_server.stop()

        # Exit process
        ColorPrint.green("[TrayMenu] Shutting down...")
        sys.exit(0)


class TrayConfig:
    """
    System Tray Configuration for MCP Server

    Provides tray menu structure and configuration
    """

    @staticmethod
    def create_menu_items(callbacks: TrayCallbacks) -> List[TrayMenuItem]:
        """
        Create tray menu items

        Args:
            callbacks: TrayCallbacks instance with callback methods

        Returns:
            List of TrayMenuItem objects
        """

        menu_items = [
            # Window controls
            TrayMenuItem(
                text="Show Window",
                callback=callbacks.on_show_window,
                default=True  # Default action on double-click
            ),
            TrayMenuItem(
                text="Hide Window",
                callback=callbacks.on_hide_window
            ),

            TrayMenuItem.SEPARATOR,

            # Server controls
            TrayMenuItem(
                text="Server",
                submenu=[
                    TrayMenuItem("Status", callbacks.on_server_status),
                    TrayMenuItem("Restart", callbacks.on_restart_server)
                ]
            ),

            # Services submenu
            TrayMenuItem(
                text="Services",
                submenu=[
                    TrayMenuItem("Codebase Scanner", callbacks.on_codebase_scanner),
                    TrayMenuItem("File Processor", callbacks.on_file_processor),
                    TrayMenuItem("AI Collaboration", callbacks.on_ai_collaboration),
                    TrayMenuItem("Database Service", callbacks.on_database_service)
                ]
            ),

            TrayMenuItem.SEPARATOR,

            # Tools submenu
            TrayMenuItem(
                text="Tools",
                submenu=[
                    TrayMenuItem("Open Logs", callbacks.on_open_logs),
                    TrayMenuItem("Open Config", callbacks.on_open_config),
                    TrayMenuItem("Open in Browser", callbacks.on_open_browser)
                ]
            ),

            # Help submenu
            TrayMenuItem(
                text="Help",
                submenu=[
                    TrayMenuItem("Documentation", callbacks.on_documentation),
                    TrayMenuItem("About", callbacks.on_about)
                ]
            ),

            TrayMenuItem.SEPARATOR,

            # Exit
            TrayMenuItem(
                text="Exit",
                callback=callbacks.on_exit
            )
        ]

        return menu_items

    @staticmethod
    def get_default_config() -> Dict[str, Any]:
        """
        Get default tray configuration

        Returns:
            Dictionary with tray configuration
        """
        return {
            'enable_tray': True,
            'tray_tooltip': 'MCP Server - Right-click for menu',
            'tray_icon_path': None,  # Will use default icon
            'app_name': 'MCP Server'
        }


# Convenience function
def create_tray_menu(mcp_server: Optional[Any] = None) -> tuple:
    """
    Create tray menu configuration

    Args:
        mcp_server: MCP server instance

    Returns:
        Tuple of (TrayCallbacks instance, list of menu items)
    """
    callbacks = TrayCallbacks(mcp_server)
    menu_items = TrayConfig.create_menu_items(callbacks)

    return callbacks, menu_items


# Import time for status callback
import time
