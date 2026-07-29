#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC address provider for FastAPI v2 server.
"""

import time
from dataclasses import dataclass, field
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

from pycore.pyutils.rpc_v2.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc_v2.discovery.rpc_discovery import RPCDiscovery, DiscoveredRPCService
from pycore.pyutils.rpc_v2.discovery.local_ip_detector import get_local_lan_ip, confirm_local_lan_ip


@dataclass
class RPCAddress:
    host: str
    port: int
    http_url: str
    websocket_url: str
    is_localhost: bool = False
    is_local_lan: bool = False
    is_available: bool = True
    discovered_at: float = field(default_factory=time.time)


class RPCAddressProvider:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        self.discovery = RPCDiscovery(debug=debug)
        self._cache_signal = f'pyutils.rpc_v2.addresses.{id(self)}'
        THREAD_BUS.signal(self._cache_signal, ())

    def get_available_addresses(self, use_localhost: bool = True) -> List[RPCAddress]:
        services = self.discovery.discover_services(use_localhost=use_localhost)
        addresses = [
            RPCAddress(
                host=svc.host,
                port=svc.port,
                http_url=svc.http_url,
                websocket_url=svc.websocket_url,
                is_localhost=svc.is_localhost,
                is_local_lan=svc.is_local_lan,
                is_available=svc.is_available,
                discovered_at=svc.discovered_at,
            )
            for svc in services
        ]
        THREAD_BUS.signal(self._cache_signal, tuple(addresses))
        if self.debug:
            ColorPrint.green(f"[RPCAddressProvider] Found {len(addresses)} address(es)")
        return addresses

    def get_localhost_address(self) -> RPCAddress:
        return RPCAddress(
            host="localhost",
            port=self.port,
            http_url=f"http://localhost:{self.port}",
            websocket_url=f"ws://localhost:{self.port}/rpc/ws",
            is_localhost=True,
        )

    def get_local_lan_address(self) -> Optional[RPCAddress]:
        local_ip = get_local_lan_ip(debug=self.debug)
        if not local_ip:
            return None
        return RPCAddress(
            host=local_ip,
            port=self.port,
            http_url=f"http://{local_ip}:{self.port}",
            websocket_url=f"ws://{local_ip}:{self.port}/rpc/ws",
            is_local_lan=True,
        )

    def get_cached_addresses(self) -> List[RPCAddress]:
        return list(THREAD_BUS.get_signal(self._cache_signal, ()) or ())

    def clear_cache(self):
        THREAD_BUS.signal(self._cache_signal, ())


__all__ = ["RPCAddress", "RPCAddressProvider"]
