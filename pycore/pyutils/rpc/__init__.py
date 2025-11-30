#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pyutils.rpc - Unified RPC Framework

A unified RPC framework supporting both HTTP and WebSocket protocols
on the same port, with shared event cache.

Features:
- HTTP and WebSocket on same port
- Shared event cache
- Backward compatible with wsrpc
"""

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.config.rpc_config import RPCConfig, get_rpc_config

# Server implementation (Unified RPC with WebSocket and CORS support)
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer, UnifiedRpcServerRunner

# Discovery components
from pycore.pyutils.rpc.discovery.network_scanner import NetworkScanner, NetworkHost
from pycore.pyutils.rpc.discovery.rpc_discovery import RPCDiscovery, DiscoveredRPCService
from pycore.pyutils.rpc.discovery.local_ip_detector import get_local_lan_ip, confirm_local_lan_ip

# Protocol components
from pycore.pyutils.rpc.protocol.rpc_protocol import (
    RPCProtocolServer,
    RPCProtocolClient,
    RPCServiceInfo,
    RPCAddressResponse
)

# Address provider
from pycore.pyutils.rpc.address.address_provider import RPCAddressProvider, RPCAddress

__version__ = '3.2.0'  # Removed ThreadedRpcServer, WebSocket-only
__all__ = [
    'RPC_CONSTANTS',
    'RPCConfig',
    'get_rpc_config',
    # Server implementation (Unified with WebSocket + CORS)
    'UnifiedRpcServer',
    'UnifiedRpcServerRunner',
    # Discovery
    'NetworkScanner',
    'NetworkHost',
    'RPCDiscovery',
    'DiscoveredRPCService',
    'get_local_lan_ip',
    'confirm_local_lan_ip',
    # Protocol
    'RPCProtocolServer',
    'RPCProtocolClient',
    'RPCServiceInfo',
    'RPCAddressResponse',
    'RPCAddressProvider',
    'RPCAddress',
]

