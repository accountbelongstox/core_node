#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Network Scanner - Scans local network for RPC services

Scans local network segments to discover RPC services on the network.
Uses HTTP discovery to verify RPC services (not TCP socket connection).
Uses shared port configuration from RPCConfig.
"""

import socket
import sys
import ipaddress
import threading
import time
import json
import http.client
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field

from pycore.pyfoundations.third_party import get_third_package_netifaces

netifaces = get_third_package_netifaces()

from pycore import ColorPrint
from pycore.pyutils.rpc.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc.protocol.rpc_protocol import RPC_STATUS_PATH


@dataclass
class NetworkHost:
    """
    Network host information
    
    Attributes:
        ip: IP address
        port: Port number
        is_active: Whether host is active
        response_time: Response time in seconds
        discovered_at: Timestamp when discovered
    """
    ip: str
    port: int
    is_active: bool = False
    response_time: float = 0.0
    discovered_at: float = field(default_factory=time.time)


class NetworkScanner:
    """
    RPC Network Scanner - Scans local network for RPC services
    
    Scans local network segments to discover RPC services.
    Uses shared port configuration from RPCConfig.
    
    Features:
    - Local network segment scanning
    - Port-based service discovery
    - Multi-threaded scanning
    - Configurable timeout and intervals
    
    Usage:
        scanner = NetworkScanner()
        hosts = scanner.scan_network_segment()
    """
    
    def __init__(self, debug: bool = False):
        """
        Initialize Network Scanner
        
        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        self.timeout = self.config.scan_timeout
        self.max_threads = 50  # Maximum concurrent scan threads
    
    def get_local_network_segments(self) -> List[str]:
        """
        Get local network segments to scan
        
        Returns:
            List of network segments (CIDR notation)
        """
        segments = []
        
        # Get local IP addresses
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        # Get network interface addresses using netifaces
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr_info in addrs[netifaces.AF_INET]:
                    ip = addr_info.get('addr')
                    netmask = addr_info.get('netmask')
                    if ip and netmask and not ip.startswith('127.'):
                        try:
                            network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                            segments.append(str(network))
                        except Exception:
                            pass
        
        # Fallback: use local IP with common subnet
        if not segments:
            try:
                ip_obj = ipaddress.IPv4Address(local_ip)
                # Assume /24 subnet
                network = ipaddress.IPv4Network(f"{ip_obj}/{24}", strict=False)
                segments.append(str(network))
            except Exception as e:
                if self.debug:
                    ColorPrint.yellow(f"[NetworkScanner] Error creating network segment: {e}")
        
        if not segments:
            # Final fallback: common local network ranges
            segments = ['192.168.1.0/24', '192.168.0.0/24', '10.0.0.0/24']
        
        if self.debug:
            ColorPrint.blue(f"[NetworkScanner] Network segments to scan: {segments}")
        
        return segments
    
    def scan_network_segment(self, segment: Optional[str] = None) -> List[NetworkHost]:
        """
        Scan network segment for RPC services
        
        Args:
            segment: Network segment in CIDR notation (e.g., '192.168.1.0/24')
                    If None, scans all local network segments
        
        Returns:
            List of discovered NetworkHost objects
        """
        if segment:
            segments = [segment]
        else:
            segments = self.get_local_network_segments()
        
        all_hosts = []
        
        for seg in segments:
            if self.debug:
                ColorPrint.blue(f"[NetworkScanner] Scanning segment: {seg}")
            
            try:
                network = ipaddress.IPv4Network(seg, strict=False)
                hosts = self._scan_network(network)
                all_hosts.extend(hosts)
            except Exception as e:
                if self.debug:
                    ColorPrint.red(f"[NetworkScanner] Error scanning segment {seg}: {e}")
        
        if self.debug:
            ColorPrint.green(f"[NetworkScanner] Found {len(all_hosts)} active hosts")
        
        return all_hosts
    
    def _scan_network(self, network: ipaddress.IPv4Network) -> List[NetworkHost]:
        """
        Scan network for active hosts on RPC port
        
        Args:
            network: IPv4Network object
        
        Returns:
            List of NetworkHost objects
        """
        hosts = []
        ip_list = list(network.hosts())
        
        # Use thread pool for concurrent scanning
        threads = []
        results = []
        lock = threading.Lock()
        
        def scan_ip(ip: str):
            """Scan single IP address"""
            host = self._check_host(ip, self.port)
            if host and host.is_active:
                with lock:
                    results.append(host)
        
        # Create threads (limit concurrent threads)
        for i, ip in enumerate(ip_list):
            if i % self.max_threads == 0 and i > 0:
                # Wait for batch to complete
                for t in threads:
                    t.join()
                threads = []
            
            thread = threading.Thread(target=scan_ip, args=(str(ip),), daemon=True)
            thread.start()
            threads.append(thread)
        
        # Wait for remaining threads
        for thread in threads:
            thread.join()
        
        return results
    
    def _check_host(self, ip: str, port: int) -> Optional[NetworkHost]:
        """
        Check if host is active RPC service using HTTP discovery
        
        Uses HTTP request to /rpc/status endpoint to verify RPC service.
        If HTTP request succeeds and returns expected response, service is active.
        
        Args:
            ip: IP address
            port: Port number
        
        Returns:
            NetworkHost object or None
        """
        start_time = time.time()
        
        conn = None
        if sys.is_finalizing():
            return None
        
        try:
            conn = http.client.HTTPConnection(ip, port, timeout=self.timeout)
            conn.request('GET', RPC_STATUS_PATH, headers={'Connection': 'close'})
            response = conn.getresponse()
            
            response_time = time.time() - start_time
            
            if response.status == 200:
                body = response.read().decode('utf-8', errors='ignore')
                response.close()
                conn.close()
                
                result = json.loads(body)
                is_rpc_service = result.get('is_rpc_service', False)
                
                if is_rpc_service:
                    return NetworkHost(
                        ip=ip,
                        port=port,
                        is_active=True,
                        response_time=response_time
                    )
            
            if conn:
                conn.close()
            
        except (socket.timeout, socket.error, OSError, http.client.HTTPException, json.JSONDecodeError, ValueError):
            if conn:
                conn.close()
        except (RuntimeError, SystemError) as e:
            if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                if conn:
                    conn.close()
                return None
            if conn:
                conn.close()
        except Exception:
            if conn:
                conn.close()
        
        return None
    
    def scan_single_host(self, ip: str, port: Optional[int] = None) -> Optional[NetworkHost]:
        """
        Scan single host for RPC service
        
        Args:
            ip: IP address
            port: Port number (uses config port if None)
        
        Returns:
            NetworkHost object or None
        """
        if port is None:
            port = self.port
        
        return self._check_host(ip, port)


__all__ = ['NetworkScanner', 'NetworkHost']

