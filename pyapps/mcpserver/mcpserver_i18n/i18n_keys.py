#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server I18n Keys - Translation Key Constants

App-specific translation keys for mcpserver application.
Extends base I18nKeys with mcpserver-specific keys.

Usage:
    from pyapps.mcpserver.mcpserver_i18n.i18n_keys import MCPServerI18nKeys
    
    # Use constants instead of strings
    text = i18n.get(MCPServerI18nKeys.APP_NAME)
    text = i18n.get(MCPServerI18nKeys.TRAY_START_MCP_SERVER)
"""

from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys


class MCPServerI18nKeys(I18nKeys):
    """
    MCP Server i18n translation key constants
    
    Extends base I18nKeys with mcpserver-specific keys.
    All keys use dot notation matching the translation JSON structure.
    """
    
    # App keys
    APP_NAME = "mcpserver.app_name"
    LOADING = "mcpserver.loading"
    UI_READY = "mcpserver.ui_ready"
    UI_CLOSED = "mcpserver.ui_closed"
    CLOSING = "mcpserver.closing"
    SERVICE_RUNNING = "mcpserver.service_running"
    
    # Tray menu keys
    TRAY_START_MCP_SERVER = "mcpserver.tray.start_mcp_server"
    TRAY_START_MAIN_SERVER = "mcpserver.tray.start_main_server"
    TRAY_START_AS_CLIENT = "mcpserver.tray.start_as_client"
    TRAY_OPEN_WEB_UI = "mcpserver.tray.open_web_ui"
    TRAY_RESTART = "mcpserver.tray.restart"
    TRAY_EXIT = "mcpserver.tray.exit"
    
    @classmethod
    def get_all_keys(cls) -> list[str]:
        """Get all key constants as a list (base + app-specific)"""
        # Get base keys
        base_keys = super().get_all_keys()
        # Get app-specific keys
        app_keys = [
            value for key, value in cls.__dict__.items()
            if not key.startswith('_') and isinstance(value, str) and key.isupper()
            and value not in base_keys  # Avoid duplicates
        ]
        return base_keys + app_keys


__all__ = ['MCPServerI18nKeys']

