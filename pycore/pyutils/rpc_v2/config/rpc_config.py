#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared configuration for RPC v2 components.
"""

import os
from typing import Dict, Optional, Any

from .constants import RPC_CONSTANTS

DEFAULTS = RPC_CONSTANTS.DEFAULTS


class RPCConfig:
    """Singleton-style configuration shared by discovery/protocol/address providers."""

    _instance: Optional["RPCConfig"] = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.port: int = int(os.getenv("RPC_PORT", DEFAULTS["SERVER_PORT"]))
        self.host: str = os.getenv("RPC_HOST", DEFAULTS["SERVER_HOST"])
        self.scan_timeout: float = 2.0
        self.scan_interval: float = 0.5
        self.connection_timeout: float = 2.0
        self.use_localhost: bool = True
        self.enable_network_scan: bool = True
        self.protocol_version: str = "2.0"
        self.cache_enabled: bool = True
        self.cache_ttl: float = 300.0

        self._initialized = True

    def get_port(self) -> int:
        return self.port

    def set_port(self, port: int):
        self.port = int(port)

    def get_host(self) -> str:
        return self.host

    def set_host(self, host: str):
        self.host = host

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

    def update_config(self, cfg: Dict[str, Any]):
        for key, value in cfg.items():
            if hasattr(self, key):
                setattr(self, key, value)


_rpc_config = RPCConfig()


def get_rpc_config() -> RPCConfig:
    return _rpc_config


__all__ = ["RPCConfig", "get_rpc_config"]
