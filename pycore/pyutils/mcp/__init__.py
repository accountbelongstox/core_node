"""
MCP Utilities - Network Discovery and Service Location

This module provides utilities for discovering MCP servers on the local network.

Main Components:
- NetworkScanner: Detect local network configuration and scan network segments
- MCPServerDiscovery: Discover MCP servers on local network

Usage:
    from pycore.pyutils.mcp import MCPServerDiscovery

    discovery = MCPServerDiscovery()
    servers = discovery.find_servers()

    for server in servers:
        print(f"Found server: {server['host']}:{server['port']}")
"""

from pycore.pyutils.mcp.network_scanner import NetworkScanner
from pycore.pyutils.mcp.mcp_server_discovery import MCPServerDiscovery

__all__ = [
    'NetworkScanner',
    'MCPServerDiscovery',
]
