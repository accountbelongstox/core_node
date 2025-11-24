#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Discover FastAPI RPC servers on the local network.
"""

import sys
import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional

from pycore import ColorPrint

from pycore.pyutils.rpc_v2.config import get_rpc_config
from pycore.pyutils.rpc_v2.discovery.local_ip_detector import get_local_lan_ip
from pycore.pyutils.rpc_v2.discovery.network_scanner import NetworkScanner, NetworkHost
# Delayed import to avoid circular dependency: protocol → address → discovery → protocol
# from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPCProtocolClient


@dataclass
class DiscoveredRPCService:
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
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        self.scanner = NetworkScanner(debug=debug)
        self._discovered_services: List[DiscoveredRPCService] = []
        self._cache_lock = threading.Lock()
        self._local_lan_ip: Optional[str] = None

    def get_local_lan_ip(self) -> Optional[str]:
        if self._local_lan_ip is None:
            self._local_lan_ip = get_local_lan_ip(debug=self.debug)
        return self._local_lan_ip

    def discover_services(self, use_localhost: bool = True) -> List[DiscoveredRPCService]:
        if sys.is_finalizing():
            return []

        services: List[DiscoveredRPCService] = []
        local_ip = self.get_local_lan_ip()

        if self.config.enable_network_scan:
            hosts = self.scanner.scan_network_segment()
            for host in hosts:
                if self._verify_rpc_service(host.ip, host.port):
                    services.append(
                        DiscoveredRPCService(
                            host=host.ip,
                            port=host.port,
                            http_url=f"http://{host.ip}:{host.port}",
                            websocket_url=f"ws://{host.ip}:{host.port}/rpc/ws",
                            is_local_lan=(host.ip == local_ip),
                        )
                    )

        if use_localhost and self.config.use_localhost and self._verify_rpc_service("localhost", self.port):
            services.append(
                DiscoveredRPCService(
                    host="localhost",
                    port=self.port,
                    http_url=f"http://localhost:{self.port}",
                    websocket_url=f"ws://localhost:{self.port}/rpc/ws",
                    is_localhost=True,
                )
            )

        with self._cache_lock:
            self._discovered_services = services

        if self.debug:
            ColorPrint.green(f"[RPCDiscovery] Found {len(services)} service(s)")
        return services

    def _verify_rpc_service(self, host: str, port: int) -> bool:
        # Delayed import to break circular dependency
        from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPCProtocolClient
        
        client = RPCProtocolClient(host=host, port=port, timeout=self.config.connection_timeout)
        try:
            response = client.get_status()
            return bool(response and response.get("service") == "FastAPIRPCServer")
        except Exception:
            return False


__all__ = ["RPCDiscovery", "DiscoveredRPCService"]
