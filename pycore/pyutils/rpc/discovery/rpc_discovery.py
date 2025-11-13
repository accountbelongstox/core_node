#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Discovery - Discovers RPC services on local network

Discovers RPC services using network scanning and protocol queries.
Uses shared port configuration from RPCConfig.
"""

import socket
import sys
import time
import threading
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from pycore import ColorPrint
from pycore.pyutils.rpc.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc.discovery.network_scanner import NetworkScanner, NetworkHost
from pycore.pyutils.rpc.discovery.local_ip_detector import get_local_lan_ip
from pycore.pyutils.rpc.protocol.rpc_protocol import RPCProtocolClient


@dataclass
class DiscoveredRPCService:
    """
    Discovered RPC service information
    
    Attributes:
        host: Host IP address or hostname
        port: Port number
        http_url: HTTP URL
        websocket_url: WebSocket URL
        is_localhost: Whether this is localhost
        is_local_lan: Whether this is on local LAN
        discovered_at: Timestamp when discovered
        last_verified: Timestamp when last verified
        is_available: Whether service is currently available
    """
    host: str
    port: int
    http_url: str
    websocket_url: str
    is_localhost: bool = False
    is_local_lan: bool = False
    discovered_at: float = field(default_factory=time.time)
    last_verified: float = field(default_factory=time.time)
    is_available: bool = True


class RPCDiscovery:
    """
    RPC Discovery - Discovers RPC services on local network
    
    Discovers RPC services using:
    - Network scanning
    - Protocol queries
    - Local IP detection
    
    Uses shared port configuration from RPCConfig.
    
    Features:
    - Network segment scanning
    - Protocol-based service verification
    - Local LAN IP detection
    - Service caching
    - Background discovery
    
    Usage:
        discovery = RPCDiscovery()
        services = discovery.discover_services()
    """
    
    def __init__(self, debug: bool = False):
        """
        Initialize RPC Discovery
        
        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        
        # Network scanner
        self.scanner = NetworkScanner(debug=debug)
        
        # Discovered services cache
        self._discovered_services: List[DiscoveredRPCService] = []
        self._cache_lock = threading.Lock()
        
        # Local LAN IP
        self._local_lan_ip: Optional[str] = None
    
    def get_local_lan_ip(self) -> Optional[str]:
        """
        Get local LAN IP address
        
        Returns:
            Local LAN IP address or None
        """
        if self._local_lan_ip is None:
            self._local_lan_ip = get_local_lan_ip(debug=self.debug)
        
        return self._local_lan_ip
    
    def discover_services(self, use_localhost: bool = True) -> List[DiscoveredRPCService]:
        """
        Discover RPC services on local network
        
        Args:
            use_localhost: Whether to include localhost
        
        Returns:
            List of DiscoveredRPCService objects
        """
        # Check if interpreter is shutting down
        if sys.is_finalizing():
            if self.debug:
                ColorPrint.yellow("[RPCDiscovery] Interpreter shutting down, skipping discovery")
            return []

        if self.debug:
            ColorPrint.blue("[RPCDiscovery] Starting service discovery...")
        
        services = []
        
        # Get local LAN IP
        local_lan_ip = self.get_local_lan_ip()
        if local_lan_ip and self.debug:
            ColorPrint.blue(f"[RPCDiscovery] Local LAN IP: {local_lan_ip}")
        
        # Scan network for active hosts
        if self.config.enable_network_scan:
            try:
                hosts = self.scanner.scan_network_segment()
                
                for host in hosts:
                    # Verify host is RPC service using protocol
                    if self._verify_rpc_service(host.ip, host.port):
                        service = DiscoveredRPCService(
                            host=host.ip,
                            port=host.port,
                            http_url=f"http://{host.ip}:{host.port}",
                            websocket_url=f"ws://{host.ip}:{host.port}/rpc/ws",
                            is_localhost=False,
                            is_local_lan=(host.ip == local_lan_ip),
                            is_available=True
                        )
                        services.append(service)
                        
                        if self.debug:
                            ColorPrint.green(f"[RPCDiscovery] Discovered RPC service: {host.ip}:{host.port}")
            except (RuntimeError, SystemError) as e:
                if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                    if self.debug:
                        ColorPrint.yellow("[RPCDiscovery] Interpreter shutting down during network scan")
                    return []
                raise
        
        # Add localhost if enabled
        if use_localhost and self.config.use_localhost:
            if self._verify_rpc_service("localhost", self.port):
                service = DiscoveredRPCService(
                    host="localhost",
                    port=self.port,
                    http_url=f"http://localhost:{self.port}",
                    websocket_url=f"ws://localhost:{self.port}/rpc/ws",
                    is_localhost=True,
                    is_local_lan=False,
                    is_available=True
                )
                services.append(service)
                
                if self.debug:
                    ColorPrint.green(f"[RPCDiscovery] Discovered localhost service: localhost:{self.port}")
        
        # Update cache
        with self._cache_lock:
            self._discovered_services = services
        
        if self.debug:
            ColorPrint.green(f"[RPCDiscovery] Discovery complete: {len(services)} service(s) found")
        
        return services
    
    def _verify_rpc_service(self, host: str, port: int) -> bool:
        """
        Verify if host is an RPC service using protocol
        
        Args:
            host: Host address
            port: Port number
        
        Returns:
            True if host is RPC service
        """
        # Check if interpreter is shutting down
        if sys.is_finalizing():
            return False
        
        try:
            client = RPCProtocolClient(host=host, port=port, debug=False)
            return client.check_rpc_service()
        
        except (RuntimeError, SystemError) as e:
            # Interpreter shutdown or system error
            if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                return False
            # Fallback: check if port is open
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.config.connection_timeout)
                result = sock.connect_ex((host, port))
                sock.close()
                return (result == 0)
            except Exception:
                return False
        except Exception:
            # Fallback: check if port is open
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.config.connection_timeout)
                result = sock.connect_ex((host, port))
                sock.close()
                return (result == 0)
            except Exception:
                return False
    
    def get_discovered_services(self) -> List[DiscoveredRPCService]:
        """
        Get cached discovered services
        
        Returns:
            List of DiscoveredRPCService objects
        """
        with self._cache_lock:
            return self._discovered_services.copy()
    
    def clear_cache(self):
        """Clear discovered services cache"""
        with self._cache_lock:
            self._discovered_services = []
        
        if self.debug:
            ColorPrint.blue("[RPCDiscovery] Cache cleared")


__all__ = ['RPCDiscovery', 'DiscoveredRPCService']

