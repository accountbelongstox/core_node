#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server BusKeys Registration

Defines app-specific BusKeys for THREAD_BUS communication.
Follows the same pattern as i18n registration.
"""

from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusKeys, BusNamespaces


class MCPServerBusKeys:
    """
    MCP Server specific BusKeys
    
    App-specific keys should use namespace: {appname}.{category}.{key}
    """
    
    # Launcher state keys
    LAUNCHER_STATE = f"{BusNamespaces.UI_STARTUP}.launcher.state"
    LAUNCHER_PORT = f"{BusNamespaces.UI_STARTUP}.launcher.port"
    LAUNCHER_APP_ID = f"{BusNamespaces.UI_STARTUP}.launcher.app_id"
    
    # MCP Server specific keys
    MCP_SERVER_STATE = "mcpserver.state"
    MCP_SERVER_PORT = "mcpserver.port"
    MCP_SERVER_READY = "mcpserver.ready"
    
    # Tray menu signal keys
    TRAY_START_MCP_SERVER = "mcpserver.tray.start_mcp_server"
    TRAY_START_MAIN_SERVER = "mcpserver.tray.start_main_server"
    TRAY_START_AS_CLIENT = "mcpserver.tray.start_as_client"
    TRAY_OPEN_WEB_UI = "mcpserver.tray.open_web_ui"
    TRAY_RESTART = "mcpserver.tray.restart"
    TRAY_SHOW_STATUS = "mcpserver.tray.show_status"
    TRAY_SHOW_INFO = "mcpserver.tray.show_info"
    TRAY_EXIT = "mcpserver.tray.exit"


def register_bus_keys():
    """
    Register app-specific BusKeys
    
    This function should be called in the app entry file (start() function)
    to register all app-specific BusKeys with the global BusKeys registry.
    
    Usage:
        from pyapps.mcpserver.mcpserver_bus_keys import register_bus_keys
        
        def start():
            register_bus_keys()
            # ... rest of startup code
    """
    from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import get_bus_manager
    
    bus_mgr = get_bus_manager()
    
    # Register app-specific keys
    # The BusKeys class is already defined, this function serves as documentation
    # and can be extended in the future if dynamic registration is needed
    
    return MCPServerBusKeys

