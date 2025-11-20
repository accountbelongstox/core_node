#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Protocol Data Models

Contains dataclasses for RPC protocol messages.
Separated from rpc_protocol.py to avoid circular imports.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List

from pycore.pyutils.rpc_v2.constants import RPC_PROTOCOL_VERSION


@dataclass
class RPCServiceInfo:
    """RPC service information"""
    is_rpc_service: bool = True
    protocol_version: str = RPC_PROTOCOL_VERSION
    service_name: str = "FastAPI RPC Service"
    port: int | None = None
    host: str = "localhost"
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RPCAddressResponse:
    """RPC address discovery response"""
    addresses: List[Dict[str, Any]] = field(default_factory=list)
    use_localhost: bool = False
    has_available_service: bool = False
    provider_info: Dict[str, Any] = field(default_factory=dict)


__all__ = [
    'RPCServiceInfo',
    'RPCAddressResponse',
]
