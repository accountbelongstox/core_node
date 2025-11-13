"""
MCP Utilities - Network Discovery and Service Location

This module provides utilities for discovering MCP servers on the local network.

Main Components:
- NetworkScanner: Detect local network configuration and scan network segments
- MCPServerDiscovery: Discover MCP servers on local network
- AddressMapper: Map discovered servers to WebSocket addresses
- AddressService: Cached address discovery with auto-retry
- MCPServiceProtocol: Standard protocol for MCP service (start service)
- MCPAddressProvider: Standard protocol for address queries (query addresses)

Usage:
    # As MCP Service
    from pycore.pyutils.mcp import MCPServiceProtocol
    
    service = MCPServiceProtocol(port=8767, service_name="My Service")
    service.start()
    
    # As Address Provider
    from pycore.pyutils.mcp import MCPAddressProvider
    
    provider = MCPAddressProvider(port=8767, use_localhost=True)
    response = provider.query_available_addresses()
"""

from pycore.pyutils.mcp.network_scanner import NetworkScanner
from pycore.pyutils.mcp.mcp_server_discovery import MCPServerDiscovery
from pycore.pyutils.mcp.address_mapper import AddressMapper, MappedAddress
from pycore.pyutils.mcp.address_service import AddressService, AddressCache
from pycore.pyutils.mcp.mcp_protocol import (
    MCPServiceProtocol,
    MCPAddressProvider,
    MCPServiceInfo,
    MCPAddressResponse,
    MCP_PROTOCOL_VERSION,
    MCP_STATUS_PATH,
    MCP_INFO_PATH,
    MCP_ADDRESSES_PATH,
)

__all__ = [
    'NetworkScanner',
    'MCPServerDiscovery',
    'AddressMapper',
    'MappedAddress',
    'AddressService',
    'AddressCache',
    'MCPServiceProtocol',
    'MCPAddressProvider',
    'MCPServiceInfo',
    'MCPAddressResponse',
    'MCP_PROTOCOL_VERSION',
    'MCP_STATUS_PATH',
    'MCP_INFO_PATH',
    'MCP_ADDRESSES_PATH',
]
