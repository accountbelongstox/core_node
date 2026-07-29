#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Config exports for rpc_v2.
"""

from pycore.pyutils.rpc_v2.config.rpc_config import RPCConfig, get_rpc_config
from pycore.pyutils.rpc_v2.constants import (
    MessageType,
    ExtendedMessageType,
    ConnectionState,
    ErrorCode,
    EventType,
    DEFAULT_SERVER_PORT,
    DEFAULT_SERVER_HOST,
    DEFAULT_REQUEST_TIMEOUT,
    DEFAULT_HEARTBEAT_INTERVAL,
    RECONNECT_INTERVAL,
    MAX_RECONNECT_ATTEMPTS,
    MAX_PAYLOAD_SIZE,
    COMPRESSION_THRESHOLD,
    MAX_LISTENERS,
    RPC_WEBSOCKET_PATH,
    HTTP_PATH_PREFIX,
)


class RPC_CONSTANTS:
    """Backward compatibility wrapper for legacy code using RPC_CONSTANTS"""

    MESSAGE_TYPES = {
        "REQUEST": MessageType.REQUEST,
        "RESPONSE": MessageType.RESPONSE,
        "EVENT": MessageType.EVENT,
        "WELCOME": MessageType.WELCOME,
        "ERROR": MessageType.ERROR,
        "PING": MessageType.PING,
        "PONG": MessageType.PONG,
        "AUTH": ExtendedMessageType.AUTH,
        "AUTH_RESPONSE": ExtendedMessageType.AUTH_RESPONSE,
        "SUBSCRIBE": ExtendedMessageType.SUBSCRIBE,
        "UNSUBSCRIBE": ExtendedMessageType.UNSUBSCRIBE,
        "BROADCAST": ExtendedMessageType.BROADCAST,
        "CANCEL": ExtendedMessageType.CANCEL,
        "ACK": MessageType.ACK,
        "HELLO": MessageType.HELLO,
        "SERVER_EVENT": MessageType.SERVER_EVENT,
        "ACK_CONFIRMATION": MessageType.ACK_CONFIRMATION,
        "ACK_REQUEST": ExtendedMessageType.ACK_REQUEST,
    }

    DEFAULTS = {
        "SERVER_PORT": DEFAULT_SERVER_PORT,
        "SERVER_HOST": DEFAULT_SERVER_HOST,
        "REQUEST_TIMEOUT": DEFAULT_REQUEST_TIMEOUT,
        "RECONNECT_INTERVAL": RECONNECT_INTERVAL,
        "MAX_RECONNECT_ATTEMPTS": MAX_RECONNECT_ATTEMPTS,
        "HEARTBEAT_INTERVAL": DEFAULT_HEARTBEAT_INTERVAL,
        "HEARTBEAT_TIMEOUT": 5.0,
        "MAX_PAYLOAD_SIZE": MAX_PAYLOAD_SIZE,
        "COMPRESSION_THRESHOLD": COMPRESSION_THRESHOLD,
        "MAX_LISTENERS": MAX_LISTENERS,
    }

    CONNECTION = {
        "STATE_CONNECTING": ConnectionState.CONNECTING,
        "STATE_OPEN": ConnectionState.OPEN,
        "STATE_CLOSING": ConnectionState.CLOSING,
        "STATE_CLOSED": ConnectionState.CLOSED,
    }

    ERROR_CODES = {
        "ROUTE_NOT_FOUND": ErrorCode.ROUTE_NOT_FOUND,
        "TIMEOUT": ErrorCode.TIMEOUT,
        "UNAUTHORIZED": ErrorCode.UNAUTHORIZED,
        "FORBIDDEN": ErrorCode.FORBIDDEN,
        "PAYLOAD_TOO_LARGE": ErrorCode.PAYLOAD_TOO_LARGE,
        "INTERNAL_ERROR": ErrorCode.INTERNAL_ERROR,
        "INVALID_MESSAGE": ErrorCode.INVALID_MESSAGE,
        "CONNECTION_LOST": ErrorCode.CONNECTION_LOST,
        "CANCELLED": ErrorCode.CANCELLED,
    }

    EVENTS = {
        "CONNECTION": EventType.CONNECTION,
        "DISCONNECT": EventType.DISCONNECT,
        "ERROR": EventType.ERROR,
        "RECONNECT": EventType.RECONNECT,
        "RECONNECT_FAILED": EventType.RECONNECT_FAILED,
        "AUTHENTICATED": EventType.AUTHENTICATED,
        "UNAUTHORIZED": EventType.UNAUTHORIZED,
        "MESSAGE": EventType.MESSAGE,
        "LATENCY": EventType.LATENCY,
    }

    HTTP_METHODS = {"GET": "GET", "POST": "POST", "PUT": "PUT", "DELETE": "DELETE", "PATCH": "PATCH"}

    WS_PATH = RPC_WEBSOCKET_PATH
    HTTP_PATH_PREFIX = HTTP_PATH_PREFIX


__all__ = ["RPC_CONSTANTS", "RPCConfig", "get_rpc_config"]
