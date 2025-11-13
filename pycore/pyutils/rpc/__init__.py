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
from pycore.pyutils.rpc.common.event_cache import EventCache, default_event_cache
from pycore.pyutils.rpc.common.request_manager import RequestManager, default_request_manager
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer

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

__version__ = '2.0.0'
__all__ = [
    'RPC_CONSTANTS',
    'RPCConfig',
    'get_rpc_config',
    'EventCache',
    'default_event_cache',
    'RequestManager',
    'default_request_manager',
    'UnifiedRpcServer',
    'NetworkScanner',
    'NetworkHost',
    'RPCDiscovery',
    'DiscoveredRPCService',
    'get_local_lan_ip',
    'confirm_local_lan_ip',
    'RPCProtocolServer',
    'RPCProtocolClient',
    'RPCServiceInfo',
    'RPCAddressResponse',
    'RPCAddressProvider',
    'RPCAddress',
]

