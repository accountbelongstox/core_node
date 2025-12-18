#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC v2 Protocol Constants - Single Source of Truth

All protocol paths, endpoints, and configuration constants defined here.
DO NOT duplicate these definitions in other files.
"""

# ============================================================
# Protocol Version and Paths
# ============================================================

RPC_PROTOCOL_VERSION = "2.0.0"

# Standard RPC endpoints
RPC_STATUS_PATH = "/rpc/status"
RPC_INFO_PATH = "/rpc/info"
RPC_ADDRESSES_PATH = "/rpc/addresses"
RPC_PROTOCOL_SYNC_PATH = "/rpc/protocol_sync"

# WebSocket endpoint
RPC_WEBSOCKET_PATH = "/rpc/ws"

# Query endpoint
RPC_QUERY_PATH_TEMPLATE = "/rpc/query/{request_id}"

# ============================================================
# Server Configuration Defaults
# ============================================================

DEFAULT_SERVER_HOST = "0.0.0.0"
DEFAULT_SERVER_PORT = 58765
DEFAULT_DEBUG = True

# ============================================================
# Timeout Configuration
# ============================================================

# Connection timeouts
DEFAULT_CONNECTION_TIMEOUT = 2.0  # seconds
DEFAULT_SCAN_TIMEOUT = 2.0  # seconds
DEFAULT_REQUEST_TIMEOUT = 30.0  # seconds

# Heartbeat and cleanup
DEFAULT_HEARTBEAT_INTERVAL = 30.0  # seconds
DEFAULT_CLEANUP_INTERVAL = 60.0  # seconds

# ACK configuration
DEFAULT_ACK_TIMEOUT = 5.0  # seconds
DEFAULT_ACK_MAX_RETRIES = 3
DEFAULT_ACK_RETRY_INTERVAL = 3.0  # seconds

# ============================================================
# Table Configuration
# ============================================================

# Event cache (short-term cache for idempotent operations)
EVENT_CACHE_TTL = 1800.0  # 30 minutes
EVENT_CACHE_MAX_SIZE = 10000

# Inventory table (failed delivery queue)
INVENTORY_TTL = 3600.0  # 1 hour
INVENTORY_MAX_SIZE = 10_000_000

# Request event table (lifecycle tracking)
REQUEST_EVENT_TTL = 3600.0  # 1 hour
REQUEST_EVENT_MAX_SIZE = 10_000_000

# Request manager
REQUEST_MANAGER_MAX_SIZE = 10_000_000

# ============================================================
# Client Configuration
# ============================================================

DEFAULT_MAX_CLIENTS = 10_000_000
DEFAULT_CLIENT_TIMEOUT = 300.0  # 5 minutes

# ============================================================
# Message Types (from UNIFIED_MESSAGE_TYPES.md)
# ============================================================

class MessageType:
    """Standard message types for RPC protocol"""
    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    ERROR = "error"
    WELCOME = "welcome"
    PING = "ping"
    PONG = "pong"
    ACK = "ack"
    INVENTORY = "inventory"

class TaskStatus:
    """Task lifecycle states"""
    ACCEPTED = "accepted"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# ============================================================
# Additional Message Types (legacy compatibility)
# ============================================================

class ExtendedMessageType:
    """Extended message types for backward compatibility with legacy RPC"""
    AUTH = "auth"
    AUTH_RESPONSE = "auth_response"
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    BROADCAST = "broadcast"
    CANCEL = "cancel"
    ACK_REQUEST = "ack_request"

# ============================================================
# Connection States
# ============================================================

class ConnectionState:
    """WebSocket connection states"""
    CONNECTING = 0
    OPEN = 1
    CLOSING = 2
    CLOSED = 3

# ============================================================
# Error Codes
# ============================================================

class ErrorCode:
    """Standard error codes for RPC protocol"""
    ROUTE_NOT_FOUND = "ROUTE_NOT_FOUND"
    TIMEOUT = "TIMEOUT"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    INVALID_MESSAGE = "INVALID_MESSAGE"
    CONNECTION_LOST = "CONNECTION_LOST"
    CANCELLED = "CANCELLED"

# ============================================================
# Event Types
# ============================================================

class EventType:
    """Event types for RPC lifecycle"""
    CONNECTION = "connection"
    DISCONNECT = "disconnect"
    ERROR = "error"
    RECONNECT = "reconnect"
    RECONNECT_FAILED = "reconnect_failed"
    AUTHENTICATED = "authenticated"
    UNAUTHORIZED = "unauthorized"
    MESSAGE = "message"
    LATENCY = "latency"

# ============================================================
# HTTP Configuration
# ============================================================

HTTP_PATH_PREFIX = "/rpc"
MAX_PAYLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
COMPRESSION_THRESHOLD = 1024  # bytes
MAX_LISTENERS = 100
MAX_RECONNECT_ATTEMPTS = 10
RECONNECT_INTERVAL = 3.0  # seconds

__all__ = [
    # Protocol version and paths
    'RPC_PROTOCOL_VERSION',
    'RPC_STATUS_PATH',
    'RPC_INFO_PATH',
    'RPC_ADDRESSES_PATH',
    'RPC_PROTOCOL_SYNC_PATH',
    'RPC_WEBSOCKET_PATH',
    'RPC_QUERY_PATH_TEMPLATE',

    # Server defaults
    'DEFAULT_SERVER_HOST',
    'DEFAULT_SERVER_PORT',
    'DEFAULT_DEBUG',

    # Timeouts
    'DEFAULT_CONNECTION_TIMEOUT',
    'DEFAULT_SCAN_TIMEOUT',
    'DEFAULT_REQUEST_TIMEOUT',
    'DEFAULT_HEARTBEAT_INTERVAL',
    'DEFAULT_CLEANUP_INTERVAL',
    'DEFAULT_ACK_TIMEOUT',
    'DEFAULT_ACK_MAX_RETRIES',
    'DEFAULT_ACK_RETRY_INTERVAL',

    # Table configuration
    'EVENT_CACHE_TTL',
    'EVENT_CACHE_MAX_SIZE',
    'INVENTORY_TTL',
    'INVENTORY_MAX_SIZE',
    'REQUEST_EVENT_TTL',
    'REQUEST_EVENT_MAX_SIZE',
    'REQUEST_MANAGER_MAX_SIZE',

    # Client configuration
    'DEFAULT_MAX_CLIENTS',
    'DEFAULT_CLIENT_TIMEOUT',

    # Message types
    'MessageType',
    'TaskStatus',
    'ExtendedMessageType',

    # Connection and error codes
    'ConnectionState',
    'ErrorCode',
    'EventType',

    # HTTP configuration
    'HTTP_PATH_PREFIX',
    'MAX_PAYLOAD_SIZE',
    'COMPRESSION_THRESHOLD',
    'MAX_LISTENERS',
    'MAX_RECONNECT_ATTEMPTS',
    'RECONNECT_INTERVAL',
]
