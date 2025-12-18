#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCPCtl - MCP Control Layer

High-level MCP service management with singleton launcher integration.

Modules:
- mcp_launcher: MCP proxy service launcher with heartbeat management

Usage:
    from pycore.pyctl.mcpctl import launch_mcp_service

    # Launch MCP service with heartbeat (singleton mode)
    launch_mcp_service(shutdown_existing=True)
"""

__all__ = ['mcp_launcher']
