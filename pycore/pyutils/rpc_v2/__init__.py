#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pycore.pyutils.rpc_v2

FastAPI-based RPC stack with discovery, protocol, address provider, and shared
state tables. Mirrors the public API of `pycore.pyutils.rpc` so callers can
transition module-by-module.
"""

from .config import RPC_CONSTANTS, RPCConfig, get_rpc_config
from .common import (
    EventCache,
    default_event_cache,
    RequestManager,
    default_request_manager,
    InventoryTable,
    InventoryItem,
    default_inventory_table,
    RequestEventTable,
    RequestEvent,
    RequestStatus,
    default_request_event_table,
)
from .server.fastapi_server import FastAPIRPCServer
from .server.server_runner import FastAPIRPCServerRunner
from .address import RPCAddressProvider, RPCAddress
from .discovery import (
    RPCDiscovery,
    DiscoveredRPCService,
    NetworkScanner,
    NetworkHost,
    get_local_lan_ip,
    confirm_local_lan_ip,
)
from .protocol import (
    RPC_PROTOCOL_VERSION,
    RPC_STATUS_PATH,
    RPC_INFO_PATH,
    RPC_ADDRESSES_PATH,
    RPC_PROTOCOL_SYNC_PATH,
    RPCServiceInfo,
    RPCAddressResponse,
    RPCProtocolClient,
    RPCProtocolServer,
)

__all__ = [
    # Config / constants
    "RPC_CONSTANTS",
    "RPCConfig",
    "get_rpc_config",
    # Common tables
    "EventCache",
    "default_event_cache",
    "RequestManager",
    "default_request_manager",
    "InventoryTable",
    "InventoryItem",
    "default_inventory_table",
    "RequestEventTable",
    "RequestEvent",
    "RequestStatus",
    "default_request_event_table",
    # Server
    "FastAPIRPCServer",
    "FastAPIRPCServerRunner",
    # Discovery / address
    "RPCDiscovery",
    "DiscoveredRPCService",
    "NetworkScanner",
    "NetworkHost",
    "get_local_lan_ip",
    "confirm_local_lan_ip",
    "RPCAddressProvider",
    "RPCAddress",
    # Protocol
    "RPC_PROTOCOL_VERSION",
    "RPC_STATUS_PATH",
    "RPC_INFO_PATH",
    "RPC_ADDRESSES_PATH",
    "RPC_PROTOCOL_SYNC_PATH",
    "RPCServiceInfo",
    "RPCAddressResponse",
    "RPCProtocolClient",
    "RPCProtocolServer",
]
