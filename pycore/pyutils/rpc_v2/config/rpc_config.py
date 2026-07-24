#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared configuration for RPC v2 components.
"""

import os
from typing import Dict, Optional, Any
from pycore.pyfoundations.serialized_worker import SerializedStateObject, serialized_method

from pycore.pyutils.rpc_v2.constants import (
    DEFAULT_SERVER_PORT,
    DEFAULT_SERVER_HOST,
    DEFAULT_REQUEST_TIMEOUT,
    DEFAULT_HEARTBEAT_INTERVAL,
    DEFAULT_SCAN_TIMEOUT,
    DEFAULT_CONNECTION_TIMEOUT,
    RPC_PROTOCOL_VERSION,
)


class RPCConfig(SerializedStateObject):
    """Singleton-style configuration shared by discovery/protocol/address providers."""

    def __init__(self):
        self.port: int = int(os.getenv("RPC_PORT", DEFAULT_SERVER_PORT))
        self.host: str = os.getenv("RPC_HOST", DEFAULT_SERVER_HOST)
        self.scan_timeout: float = DEFAULT_SCAN_TIMEOUT
        self.scan_interval: float = 0.5
        self.connection_timeout: float = DEFAULT_CONNECTION_TIMEOUT
        self.use_localhost: bool = True
        self.enable_network_scan: bool = True
        self.protocol_version: str = RPC_PROTOCOL_VERSION
        self.cache_enabled: bool = True
        self.cache_ttl: float = 300.0

        self.enable_serialized_state(
            "rpc_v2.config.state",
            "RPCConfigState",
        )

    @serialized_method
    def get_port(self) -> int:
        return self.port

    @serialized_method
    def set_port(self, port: int):
        self.port = int(port)

    @serialized_method
    def get_host(self) -> str:
        return self.host

    @serialized_method
    def set_host(self, host: str):
        self.host = host

    @serialized_method
    def get_config(self) -> Dict[str, Any]:
        return {
            "port": self.port,
            "host": self.host,
            "scan_timeout": self.scan_timeout,
            "scan_interval": self.scan_interval,
            "connection_timeout": self.connection_timeout,
            "use_localhost": self.use_localhost,
            "enable_network_scan": self.enable_network_scan,
            "protocol_version": self.protocol_version,
            "cache_enabled": self.cache_enabled,
            "cache_ttl": self.cache_ttl,
        }

    @serialized_method
    def update_config(self, cfg: Dict[str, Any]):
        for key, value in cfg.items():
            if hasattr(self, key):
                setattr(self, key, value)


_rpc_config = RPCConfig()


def get_rpc_config() -> RPCConfig:
    return _rpc_config


__all__ = ["RPCConfig", "get_rpc_config"]
