#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Protocol helpers for RPC v2 clients/discovery.
"""

import json
import http.client
import time
from dataclasses import asdict
from typing import Any, Dict, Optional

from pycore.pyfoundations.third_party import get_third_package_fastapi

# Get fastapi via third_party manager
fastapi = get_third_package_fastapi()
Request = fastapi.Request

from pycore.pyutils.rpc_v2.config import get_rpc_config
from pycore.pyutils.rpc_v2.constants import (
    RPC_PROTOCOL_VERSION,
    RPC_STATUS_PATH,
    RPC_INFO_PATH,
    RPC_ADDRESSES_PATH,
    RPC_PROTOCOL_SYNC_PATH,
)
from pycore.pyutils.rpc_v2.protocol.models import RPCServiceInfo, RPCAddressResponse
from pycore.pyutils.rpc_v2.address import RPCAddressProvider


class RPCProtocolClient:
    """Lightweight HTTP client for pinging RPC services."""

    def __init__(self, host: str, port: int, timeout: float = 2.0):
        self.host = host
        self.port = port
        self.timeout = timeout

    def get_status(self) -> Optional[Dict[str, Any]]:
        return self._request("GET", RPC_STATUS_PATH)

    def get_info(self) -> Optional[Dict[str, Any]]:
        return self._request("GET", RPC_INFO_PATH)

    def sync_protocol(self, payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        body = json.dumps(payload or {}).encode("utf-8")
        return self._request("POST", RPC_PROTOCOL_SYNC_PATH, body=body, headers={"Content-Type": "application/json"})

    def _request(self, method: str, path: str, body: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=self.timeout)
        try:
            conn.request(method, path, body=body, headers=headers or {})
            response = conn.getresponse()
            if response.status != 200:
                return None
            data = response.read().decode("utf-8")
            return json.loads(data)
        except Exception:
            return None
        finally:
            conn.close()


class RPCProtocolServer:
    """Registers RPC protocol endpoints on the FastAPI server."""

    def __init__(self, rpc_server, service_name: str = "FastAPIRPCServer", metadata: Optional[Dict[str, Any]] = None):
        self.rpc_server = rpc_server
        self.app = rpc_server.app
        self.config = get_rpc_config()
        self.service_info = RPCServiceInfo(
            service_name=service_name,
            port=self.config.get_port(),
            host=self.config.get_host(),
            capabilities=["http_rpc", "websocket_rpc"],
            metadata=metadata or {},
        )
        self.address_provider = RPCAddressProvider(debug=rpc_server.debug)
        self._register_routes()

    def _register_routes(self):
        @self.app.get(RPC_STATUS_PATH)
        async def status_endpoint():
            return {
                "is_rpc_service": True,
                "protocol_version": RPC_PROTOCOL_VERSION,
                "service": self.service_info.service_name,
            }

        @self.app.get(RPC_INFO_PATH)
        async def info_endpoint():
            payload = await self.rpc_server._build_status_payload()
            payload["protocol_version"] = RPC_PROTOCOL_VERSION
            payload["service_name"] = self.service_info.service_name
            payload["metadata"] = self.service_info.metadata
            return payload

        @self.app.get(RPC_ADDRESSES_PATH)
        async def addresses_endpoint():
            addresses = self.address_provider.get_available_addresses(use_localhost=True)
            response = RPCAddressResponse(
                addresses=[
                    {
                        "host": addr.host,
                        "port": addr.port,
                        "http_url": addr.http_url,
                        "websocket_url": addr.websocket_url,
                        "is_localhost": addr.is_localhost,
                        "is_local_lan": addr.is_local_lan,
                        "is_available": addr.is_available,
                    }
                    for addr in addresses
                ],
                use_localhost=self.config.use_localhost,
                has_available_service=bool(addresses),
                provider_info={"port": self.config.get_port()},
            )
            return asdict(response)

        @self.app.post(RPC_PROTOCOL_SYNC_PATH)
        async def protocol_sync(request: Request):
            data = await request.json()
            return {
                "status": "synced",
                "protocol_version": RPC_PROTOCOL_VERSION,
                "received_data": data,
                "timestamp": time.time(),
            }


__all__ = [
    "RPCProtocolClient",
    "RPCProtocolServer",
]
