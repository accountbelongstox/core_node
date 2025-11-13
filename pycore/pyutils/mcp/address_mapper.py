#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Address Mapper - Map discovered MCP servers to accessible addresses

This module provides address mapping functionality for MCP servers discovered
on the local network. It maintains a mapping of discovered servers and their
WebSocket endpoints.

Architecture (similar to device_sync):
- Uses NetworkScanner and MCPServerDiscovery to find servers
- Maintains address mapping cache
- Provides WebSocket URL generation
- Supports dynamic updates when network changes

Usage:
    from pycore.pyutils.mcp.address_mapper import AddressMapper
    
    mapper = AddressMapper()
    
    # Scan and map addresses
    addresses = mapper.scan_and_map()
    
    # Get WebSocket URL for a server
    ws_url = mapper.get_websocket_url(host="192.168.1.100", port=8767)
    
    # Get all mapped addresses
    all_addresses = mapper.get_all_addresses()
"""

import time
from typing import List, Dict, Optional
from dataclasses import dataclass, field

from pycore import ColorPrint
from pycore.pyutils.mcp.network_scanner import NetworkScanner
from pycore.pyutils.mcp.mcp_server_discovery import MCPServerDiscovery


@dataclass
class MappedAddress:
    """
    Mapped address information for an MCP server
    
    Attributes:
        host: IP address or hostname
        port: Port number
        websocket_url: WebSocket URL (ws://host:port)
        discovered_at: Timestamp when discovered
        last_verified: Timestamp when last verified
        is_active: Whether the address is currently active
        metadata: Additional metadata about the server
    """
    host: str
    port: int
    websocket_url: str
    discovered_at: float
    last_verified: float = field(default_factory=time.time)
    is_active: bool = True
    metadata: Dict = field(default_factory=dict)


class AddressMapper:
    """
    MCP Address Mapper
    
    Maps discovered MCP servers to accessible WebSocket addresses.
    Maintains a cache of discovered servers and their endpoints.
    
    Features:
    - Automatic network scanning
    - Address mapping cache
    - WebSocket URL generation
    - Dynamic address updates
    - Server health checking
    
    Usage:
        mapper = AddressMapper(debug=True)
        
        # Scan and map all discovered servers
        addresses = mapper.scan_and_map()
        
        # Get WebSocket URL for specific server
        ws_url = mapper.get_websocket_url("192.168.1.100", 8767)
        
        # Get all active addresses
        active = mapper.get_active_addresses()
    """
    
    DEFAULT_MCP_PORT = 8767
    DEFAULT_WS_PROTOCOL = "ws"  # Use "wss" for secure WebSocket
    
    def __init__(self, debug: bool = False):
        """
        Initialize Address Mapper
        
        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.network_scanner = NetworkScanner(debug=debug)
        self.server_discovery = MCPServerDiscovery(debug=debug)
        
        # Address mapping cache
        self._address_map: Dict[str, MappedAddress] = {}  # Key: "host:port"
        self._last_scan_time: Optional[float] = None
    
    def scan_and_map(
        self,
        quick: bool = False,
        ports: Optional[List[int]] = None
    ) -> List[MappedAddress]:
        """
        Scan network and map discovered MCP servers to addresses
        
        Args:
            quick: Use quick discovery mode (faster, less thorough)
            ports: List of ports to scan (default: [8767])
            
        Returns:
            List of MappedAddress objects
        """
        if self.debug:
            ColorPrint.blue("=" * 70)
            ColorPrint.blue("[AddressMapper] Starting scan and map...")
            ColorPrint.blue("=" * 70)
        
        # Discover MCP servers
        if quick:
            servers = self.server_discovery.find_servers_quick(ports=ports)
        else:
            servers = self.server_discovery.find_servers(ports=ports)
        
        if self.debug:
            ColorPrint.green(f"[AddressMapper] Discovered {len(servers)} MCP server(s)")
        
        # Map servers to addresses
        mapped_addresses = []
        for server in servers:
            mapped = self._map_server(server)
            if mapped:
                mapped_addresses.append(mapped)
        
        # Update cache
        self._update_address_map(mapped_addresses)
        self._last_scan_time = time.time()
        
        if self.debug:
            ColorPrint.green(f"[AddressMapper] Mapped {len(mapped_addresses)} address(es)")
            ColorPrint.blue("=" * 70)
        
        return mapped_addresses
    
    def _map_server(self, server: Dict) -> Optional[MappedAddress]:
        """
        Map a discovered server to MappedAddress
        
        Args:
            server: Server info dict from MCPServerDiscovery
            
        Returns:
            MappedAddress object or None
        """
        host = server.get('host')
        port = server.get('port', self.DEFAULT_MCP_PORT)
        
        if not host:
            return None
        
        # Generate WebSocket URL
        ws_url = self._generate_websocket_url(host, port)
        
        # Create mapped address
        mapped = MappedAddress(
            host=host,
            port=port,
            websocket_url=ws_url,
            discovered_at=server.get('discovered_at', time.time()),
            last_verified=time.time(),
            is_active=True,
            metadata={
                'role': server.get('role', 'unknown'),
                'response_time': server.get('response_time', 0.0)
            }
        )
        
        return mapped
    
    def _generate_websocket_url(self, host: str, port: int, protocol: str = None) -> str:
        """
        Generate WebSocket URL for a server
        
        Args:
            host: IP address or hostname
            port: Port number
            protocol: WebSocket protocol ("ws" or "wss", default: "ws")
            
        Returns:
            WebSocket URL (e.g., "ws://192.168.1.100:8767")
        """
        if protocol is None:
            protocol = self.DEFAULT_WS_PROTOCOL
        
        return f"{protocol}://{host}:{port}"
    
    def _update_address_map(self, addresses: List[MappedAddress]):
        """
        Update address mapping cache
        
        Args:
            addresses: List of MappedAddress objects
        """
        # Create new map
        new_map = {}
        
        for addr in addresses:
            key = f"{addr.host}:{addr.port}"
            new_map[key] = addr
        
        # Merge with existing map (preserve metadata)
        for key, existing_addr in self._address_map.items():
            if key in new_map:
                # Update existing address
                new_addr = new_map[key]
                new_addr.metadata.update(existing_addr.metadata)
            else:
                # Mark as inactive if not found in new scan
                existing_addr.is_active = False
                new_map[key] = existing_addr
        
        self._address_map = new_map
    
    def get_websocket_url(self, host: str, port: int = None) -> Optional[str]:
        """
        Get WebSocket URL for a specific server
        
        Args:
            host: IP address or hostname
            port: Port number (default: DEFAULT_MCP_PORT)
            
        Returns:
            WebSocket URL or None if not found
        """
        if port is None:
            port = self.DEFAULT_MCP_PORT
        
        key = f"{host}:{port}"
        mapped = self._address_map.get(key)
        
        if mapped and mapped.is_active:
            return mapped.websocket_url
        
        # Generate URL even if not in cache
        return self._generate_websocket_url(host, port)
    
    def get_all_addresses(self) -> List[MappedAddress]:
        """
        Get all mapped addresses
        
        Returns:
            List of all MappedAddress objects (including inactive)
        """
        return list(self._address_map.values())
    
    def get_active_addresses(self) -> List[MappedAddress]:
        """
        Get only active mapped addresses
        
        Returns:
            List of active MappedAddress objects
        """
        return [addr for addr in self._address_map.values() if addr.is_active]
    
    def get_address(self, host: str, port: int = None) -> Optional[MappedAddress]:
        """
        Get mapped address for specific host:port
        
        Args:
            host: IP address or hostname
            port: Port number (default: DEFAULT_MCP_PORT)
            
        Returns:
            MappedAddress object or None
        """
        if port is None:
            port = self.DEFAULT_MCP_PORT
        
        key = f"{host}:{port}"
        return self._address_map.get(key)
    
    def clear_cache(self):
        """Clear address mapping cache"""
        self._address_map.clear()
        self._last_scan_time = None
        if self.debug:
            ColorPrint.blue("[AddressMapper] Cache cleared")
    
    def get_cache_stats(self) -> Dict:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        total = len(self._address_map)
        active = len([a for a in self._address_map.values() if a.is_active])
        
        return {
            'total_addresses': total,
            'active_addresses': active,
            'inactive_addresses': total - active,
            'last_scan_time': self._last_scan_time
        }


__all__ = [
    'AddressMapper',
    'MappedAddress',
]

