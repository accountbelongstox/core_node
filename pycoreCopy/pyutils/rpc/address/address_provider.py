#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Address Provider - Provides available RPC addresses

Provides available RPC service addresses (LAN or localhost) using:
- Network discovery
- Protocol queries
- Local IP detection

All components share the same port configuration from RPCConfig.

Features:
- Network and localhost address discovery
- Protocol-based service verification
- Address caching
- Automatic fallback to localhost
"""

import time
import threading
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from pycore import ColorPrint
from pycore.pyutils.rpc.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc.discovery.rpc_discovery import RPCDiscovery, DiscoveredRPCService
from pycore.pyutils.rpc.discovery.local_ip_detector import get_local_lan_ip, confirm_local_lan_ip
from pycore.pyutils.rpc.protocol.rpc_protocol import RPCProtocolClient, RPCAddressResponse


@dataclass
class RPCAddress:
    """
    RPC Address information
    
    Attributes:
        host: Host IP address or hostname
        port: Port number (from shared config)
        http_url: HTTP URL
        websocket_url: WebSocket URL
        is_localhost: Whether this is localhost
        is_local_lan: Whether this is on local LAN
        is_available: Whether address is currently available
        discovered_at: Timestamp when discovered
    """
    host: str
    port: int
    http_url: str
    websocket_url: str
    is_localhost: bool = False
    is_local_lan: bool = False
    is_available: bool = True
    discovered_at: float = field(default_factory=time.time)


class RPCAddressProvider:
    """
    RPC Address Provider - Provides available RPC addresses
    
    Provides available RPC service addresses using:
    - Network discovery
    - Protocol queries
    - Local IP detection
    
    All components share the same port configuration from RPCConfig.
    
    Features:
    - Network and localhost address discovery
    - Protocol-based service verification
    - Address caching
    - Automatic fallback to localhost
    - Background discovery
    
    Usage:
        provider = RPCAddressProvider()
        addresses = provider.get_available_addresses()
    """
    
    def __init__(self, debug: bool = False):
        """
        Initialize RPC Address Provider
        
        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        
        # RPC Discovery
        self.discovery = RPCDiscovery(debug=debug)
        
        # Address cache
        self._cached_addresses: List[RPCAddress] = []
        self._cache_lock = threading.Lock()
        self._last_discovery_time: Optional[float] = None
    
    def get_available_addresses(self, use_localhost: bool = True) -> List[RPCAddress]:
        """
        Get available RPC addresses (LAN or localhost)
        
        Discovers and returns available RPC service addresses.
        All addresses use the shared port configuration.
        
        Args:
            use_localhost: Whether to include localhost
        
        Returns:
            List of RPCAddress objects
        """
        if self.debug:
            ColorPrint.blue("[RPCAddressProvider] Getting available addresses...")
        
        addresses = []
        
        # Discover services
        services = self.discovery.discover_services(use_localhost=use_localhost)
        
        # Convert to RPCAddress
        for service in services:
            address = RPCAddress(
                host=service.host,
                port=service.port,
                http_url=service.http_url,
                websocket_url=service.websocket_url,
                is_localhost=service.is_localhost,
                is_local_lan=service.is_local_lan,
                is_available=service.is_available,
                discovered_at=service.discovered_at
            )
            addresses.append(address)
        
        # Update cache
        with self._cache_lock:
            self._cached_addresses = addresses
            self._last_discovery_time = time.time()
        
        if self.debug:
            ColorPrint.green(f"[RPCAddressProvider] Found {len(addresses)} available address(es)")
            for addr in addresses:
                ColorPrint.blue(f"  - {addr.host}:{addr.port} ({'localhost' if addr.is_localhost else 'LAN'})")
        
        return addresses
    
    def get_localhost_address(self) -> RPCAddress:
        """
        Get localhost address
        
        Returns:
            RPCAddress for localhost
        """
        return RPCAddress(
            host="localhost",
            port=self.port,
            http_url=f"http://localhost:{self.port}",
            websocket_url=f"ws://localhost:{self.port}/rpc/ws",
            is_localhost=True,
            is_local_lan=False,
            is_available=True
        )
    
    def get_local_lan_address(self) -> Optional[RPCAddress]:
        """
        Get local LAN address
        
        Returns:
            RPCAddress for local LAN or None
        """
        local_lan_ip = get_local_lan_ip(debug=self.debug)
        if not local_lan_ip:
            return None
        
        return RPCAddress(
            host=local_lan_ip,
            port=self.port,
            http_url=f"http://{local_lan_ip}:{self.port}",
            websocket_url=f"ws://{local_lan_ip}:{self.port}/rpc/ws",
            is_localhost=False,
            is_local_lan=True,
            is_available=True
        )
    
    def get_cached_addresses(self) -> List[RPCAddress]:
        """
        Get cached addresses
        
        Returns:
            List of cached RPCAddress objects
        """
        with self._cache_lock:
            return self._cached_addresses.copy()
    
    def clear_cache(self):
        """Clear address cache"""
        with self._cache_lock:
            self._cached_addresses = []
            self._last_discovery_time = None
        
        if self.debug:
            ColorPrint.blue("[RPCAddressProvider] Cache cleared")
    
    def query_addresses_protocol(self) -> RPCAddressResponse:
        """
        Query addresses using RPC protocol
        
        Returns:
            RPCAddressResponse with addresses and status
        """
        if self.debug:
            ColorPrint.blue("[RPCAddressProvider] Querying addresses via protocol...")
        
        addresses = []
        use_localhost = False
        has_available_service = False
        
        # Get discovered addresses
        discovered = self.get_available_addresses(use_localhost=True)
        
        for addr in discovered:
            # Verify using protocol
            client = RPCProtocolClient(host=addr.host, port=addr.port, debug=False)
            if client.check_rpc_service():
                addresses.append({
                    "host": addr.host,
                    "port": addr.port,
                    "http_url": addr.http_url,
                    "websocket_url": addr.websocket_url,
                    "is_localhost": addr.is_localhost,
                    "is_local_lan": addr.is_local_lan,
                    "is_available": True
                })
                
                if addr.is_localhost:
                    use_localhost = True
                
                has_available_service = True
        
        response = RPCAddressResponse(
            addresses=addresses,
            use_localhost=use_localhost,
            has_available_service=has_available_service,
            provider_info={
                "protocol_version": "1.0",
                "query_port": self.port,
                "discovery_time": self._last_discovery_time
            }
        )
        
        if self.debug:
            ColorPrint.green(f"[RPCAddressProvider] Protocol query: {len(addresses)} address(es)")
            ColorPrint.blue(f"[RPCAddressProvider] Use localhost: {use_localhost}")
            ColorPrint.blue(f"[RPCAddressProvider] Has available service: {has_available_service}")
        
        return response


__all__ = ['RPCAddressProvider', 'RPCAddress']

