#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC v2 constants.

FastAPI stack keeps the same protocol identifiers as the legacy RPC layer so
clients (JS/mobile) remain compatible.
"""


class RPC_CONSTANTS:
    """Protocol + transport constants shared across HTTP and WebSocket handlers."""

    MESSAGE_TYPES = {
        "REQUEST": "request",
        "RESPONSE": "response",
        "EVENT": "event",
        "WELCOME": "welcome",
        "ERROR": "error",
        "PING": "ping",
        "PONG": "pong",
        "AUTH": "auth",
        "AUTH_RESPONSE": "auth_response",
        "SUBSCRIBE": "subscribe",
        "UNSUBSCRIBE": "unsubscribe",
        "BROADCAST": "broadcast",
        "CANCEL": "cancel",
        "ACK": "ack",
        "ACK_REQUEST": "ack_request",
    }

    DEFAULTS = {
        "SERVER_PORT": 58765,
        "SERVER_HOST": "0.0.0.0",
        "REQUEST_TIMEOUT": 30.0,
        "RECONNECT_INTERVAL": 3.0,
        "MAX_RECONNECT_ATTEMPTS": 10,
        "HEARTBEAT_INTERVAL": 30.0,
        "HEARTBEAT_TIMEOUT": 5.0,
        "MAX_PAYLOAD_SIZE": 10 * 1024 * 1024,
        "COMPRESSION_THRESHOLD": 1024,
        "MAX_LISTENERS": 100,
    }

    CONNECTION = {
        "STATE_CONNECTING": 0,
        "STATE_OPEN": 1,
        "STATE_CLOSING": 2,
        "STATE_CLOSED": 3,
    }

    ERROR_CODES = {
        "ROUTE_NOT_FOUND": "ROUTE_NOT_FOUND",
        "TIMEOUT": "TIMEOUT",
        "UNAUTHORIZED": "UNAUTHORIZED",
        "FORBIDDEN": "FORBIDDEN",
        "PAYLOAD_TOO_LARGE": "PAYLOAD_TOO_LARGE",
        "INTERNAL_ERROR": "INTERNAL_ERROR",
        "INVALID_MESSAGE": "INVALID_MESSAGE",
        "CONNECTION_LOST": "CONNECTION_LOST",
        "CANCELLED": "CANCELLED",
    }

    EVENTS = {
        "CONNECTION": "connection",
        "DISCONNECT": "disconnect",
        "ERROR": "error",
        "RECONNECT": "reconnect",
        "RECONNECT_FAILED": "reconnect_failed",
        "AUTHENTICATED": "authenticated",
        "UNAUTHORIZED": "unauthorized",
        "MESSAGE": "message",
        "LATENCY": "latency",
    }

    HTTP_METHODS = {"GET": "GET", "POST": "POST", "PUT": "PUT", "DELETE": "DELETE", "PATCH": "PATCH"}

    WS_PATH = "/rpc/ws"
    HTTP_PATH_PREFIX = "/rpc"


__all__ = ["RPC_CONSTANTS"]
