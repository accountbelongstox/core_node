#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Address Service - Cached address discovery with auto-retry

This service provides a cached address discovery mechanism for MCP servers.
It automatically scans the network, caches discovered addresses, and retries
when addresses become unavailable.

Features:
- Port-based address discovery
- Automatic caching of discovered addresses
- Fallback to localhost if no network addresses found
- Configurable localhost usage
- Auto-retry with recursive scanning (0.5s interval)
- Health checking and cache invalidation

Usage:
    from pycore.pyutils.mcp import AddressService
    
    service = AddressService(port=8767, use_localhost=True)
    address = service.get_available_address()  # Returns cached or discovered address
"""

import socket
import time
import threading
from typing import Optional, Dict
from dataclasses import dataclass, field

from pycore import ColorPrint
from pycore.pyutils.mcp.address_mapper import AddressMapper, MappedAddress


@dataclass
class AddressCache:
    """
    Cached address information
    
    Attributes:
        host: IP address or hostname
        port: Port number
        websocket_url: WebSocket URL
        discovered_at: Timestamp when discovered
        last_verified: Timestamp when last verified
        is_available: Whether the address is currently available
        is_localhost: Whether this is a localhost address
    """
    host: str
    port: int
    websocket_url: str
    discovered_at: float
    last_verified: float = field(default_factory=time.time)
    is_available: bool = True
    is_localhost: bool = False


class AddressService:
    """
    MCP Address Service with caching and auto-retry
    
    Provides cached address discovery with automatic retry mechanism.
    Scans network recursively with 0.5s interval when addresses become unavailable.
    
    Features:
    - Port-based address discovery
    - Address caching
    - Automatic fallback to localhost
    - Configurable localhost usage
    - Recursive scanning with 0.5s interval
    - Health checking
    
    Usage:
        service = AddressService(port=8767, use_localhost=True, debug=True)
        
        # Get available address (cached or discovered)
        address = service.get_available_address()
        
        # Start background scanning
        service.start_background_scanning()
    """
    
    SCAN_INTERVAL = 0.5  # Seconds between scans
    CONNECTION_TIMEOUT = 2.0  # Connection test timeout
    
    def __init__(
        self,
        port: int = 8767,
        use_localhost: bool = True,
        debug: bool = False
    ):
        """
        Initialize Address Service
        
        Args:
            port: Port number to scan for
            use_localhost: Whether to use localhost as fallback
            debug: Enable debug output
        """
        self.port = port
        self.use_localhost = use_localhost
        self.debug = debug
        
        # Address mapper for network discovery
        self.address_mapper = AddressMapper(debug=debug)
        
        # Address cache
        self._cached_address: Optional[AddressCache] = None
        self._cache_lock = threading.Lock()
        
        # Background scanning
        self._scanning = False
        self._scan_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Localhost address (always available)
        self._localhost_address = self._create_localhost_address()
    
    def _create_localhost_address(self) -> AddressCache:
        """Create localhost address cache"""
        return AddressCache(
            host="localhost",
            port=self.port,
            websocket_url=f"ws://localhost:{self.port}",
            discovered_at=time.time(),
            last_verified=time.time(),
            is_available=True,
            is_localhost=True
        )
    
    def get_available_address(self) -> Optional[AddressCache]:
        """
        Get available address (cached or discovered)
        
        Priority:
        1. Cached network address (if available)
        2. New network scan
        3. Localhost (if use_localhost=True)
        
        Returns:
            AddressCache object or None
        """
        with self._cache_lock:
            # Check cached address first
            if self._cached_address and not self._cached_address.is_localhost:
                if self._verify_address(self._cached_address):
                    if self.debug:
                        ColorPrint.blue(f"[AddressService] Using cached address: {self._cached_address.host}:{self._cached_address.port}")
                    return self._cached_address
                else:
                    # Cached address is no longer available
                    if self.debug:
                        ColorPrint.yellow(f"[AddressService] Cached address unavailable: {self._cached_address.host}:{self._cached_address.port}")
                    self._cached_address = None
        
        # Try to discover new address
        discovered = self._discover_address()
        if discovered:
            with self._cache_lock:
                self._cached_address = discovered
            if self.debug:
                ColorPrint.green(f"[AddressService] Discovered address: {discovered.host}:{discovered.port}")
            return discovered
        
        # Fallback to localhost
        if self.use_localhost:
            if self.debug:
                ColorPrint.yellow(f"[AddressService] No network address found, using localhost")
            return self._localhost_address
        
        return None
    
    def _discover_address(self) -> Optional[AddressCache]:
        """
        Discover address on network
        
        Returns:
            AddressCache object or None
        """
        # Quick scan for MCP servers on specified port
        addresses = self.address_mapper.scan_and_map(
            quick=True,
            ports=[self.port]
        )
        
        # Find first available address
        for addr in addresses:
            if addr.is_active and addr.port == self.port:
                # Verify address is accessible
                if self._verify_mapped_address(addr):
                    cache = AddressCache(
                        host=addr.host,
                        port=addr.port,
                        websocket_url=addr.websocket_url,
                        discovered_at=addr.discovered_at,
                        last_verified=time.time(),
                        is_available=True,
                        is_localhost=False
                    )
                    return cache
        
        return None
            
    
    def _verify_address(self, address: AddressCache) -> bool:
        """
        Verify if address is still available
        
        Args:
            address: AddressCache to verify
            
        Returns:
            True if address is available
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.CONNECTION_TIMEOUT)
            result = sock.connect_ex((address.host, address.port))
            sock.close()
            
            is_available = (result == 0)
            
            # Update cache
            address.last_verified = time.time()
            address.is_available = is_available
            
            return is_available
            
        except Exception:
            address.last_verified = time.time()
            address.is_available = False
            return False
    
    def _verify_mapped_address(self, mapped: MappedAddress) -> bool:
        """
        Verify if mapped address is accessible
        
        Args:
            mapped: MappedAddress to verify
            
        Returns:
            True if address is accessible
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.CONNECTION_TIMEOUT)
            result = sock.connect_ex((mapped.host, mapped.port))
            sock.close()
            return (result == 0)
        except Exception:
            return False
    
    def start_background_scanning(self):
        """
        Start background scanning thread
        
        Recursively scans network with 0.5s interval when cached address
        becomes unavailable.
        """
        if self._scanning:
            if self.debug:
                ColorPrint.yellow("[AddressService] Background scanning already running")
            return
        
        self._scanning = True
        self._stop_event.clear()
        
        self._scan_thread = threading.Thread(
            target=self._background_scan_loop,
            daemon=True,
            name="AddressService-Scanner"
        )
        self._scan_thread.start()
        
        if self.debug:
            ColorPrint.green("[AddressService] Background scanning started")
    
    def stop_background_scanning(self):
        """Stop background scanning thread"""
        if not self._scanning:
            return
        
        self._scanning = False
        self._stop_event.set()
        
        if self._scan_thread:
            self._scan_thread.join(timeout=2.0)
        
        if self.debug:
            ColorPrint.blue("[AddressService] Background scanning stopped")
    
    def _background_scan_loop(self):
        """
        Background scanning loop
        
        Recursively scans network with 0.5s interval when address is unavailable.
        """
        while self._scanning and not self._stop_event.is_set():
            with self._cache_lock:
                # Check if we need to scan
                need_scan = False
                
                if not self._cached_address:
                    # No cached address, need to scan
                    need_scan = True
                elif self._cached_address.is_localhost:
                    # Using localhost, try to find network address
                    if self.use_localhost:
                        need_scan = True
                elif not self._cached_address.is_available:
                    # Cached address unavailable, need to rescan
                    need_scan = True
            
            if need_scan:
                if self.debug:
                    ColorPrint.blue("[AddressService] Background scan: Discovering address...")
                
                discovered = self._discover_address()
                if discovered:
                    with self._cache_lock:
                        self._cached_address = discovered
                    if self.debug:
                        ColorPrint.green(f"[AddressService] Background scan: Found {discovered.host}:{discovered.port}")
                else:
                    # Verify cached address if exists
                    if self._cached_address and not self._cached_address.is_localhost:
                        if not self._verify_address(self._cached_address):
                            with self._cache_lock:
                                self._cached_address = None
                            if self.debug:
                                ColorPrint.yellow("[AddressService] Background scan: Cached address invalidated")
            else:
                # Verify cached address is still available
                if self._cached_address and not self._cached_address.is_localhost:
                    self._verify_address(self._cached_address)
            
            # Wait 0.5 seconds before next scan
            self._stop_event.wait(self.SCAN_INTERVAL)
                
    
    def get_cached_address(self) -> Optional[AddressCache]:
        """
        Get currently cached address
        
        Returns:
            AddressCache object or None
        """
        with self._cache_lock:
            return self._cached_address
    
    def clear_cache(self):
        """Clear address cache"""
        with self._cache_lock:
            self._cached_address = None
        if self.debug:
            ColorPrint.blue("[AddressService] Cache cleared")
    
    def __del__(self):
        """Cleanup on deletion"""
        self.stop_background_scanning()


__all__ = ['AddressService', 'AddressCache']

