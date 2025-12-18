#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Constants

Defines all constants used by the RPC framework (HTTP + WebSocket).
Moved from pycore.pygvar.ws_rpc_constants.
"""

class RPC_CONSTANTS:
    """RPC framework constants (HTTP + WebSocket)"""

    MESSAGE_TYPES = {
        'REQUEST': 'request',
        'RESPONSE': 'response',
        'EVENT': 'event',
        'WELCOME': 'welcome',
        'ERROR': 'error',
        'PING': 'ping',
        'PONG': 'pong',
        'AUTH': 'auth',
        'AUTH_RESPONSE': 'auth_response',
        'SUBSCRIBE': 'subscribe',
        'UNSUBSCRIBE': 'unsubscribe',
        'BROADCAST': 'broadcast',
        'CANCEL': 'cancel',
        'ACK': 'ack',  # Acknowledgment - client confirms receipt
        'ACK_REQUEST': 'ack_request'  # Server requests acknowledgment
    }

    DEFAULTS = {
        'SERVER_PORT': 58765,  # High port to avoid conflicts (changed from 8080)
        'SERVER_HOST': '0.0.0.0',
        'REQUEST_TIMEOUT': 30.0,
        'RECONNECT_INTERVAL': 3.0,
        'MAX_RECONNECT_ATTEMPTS': 10,
        'HEARTBEAT_INTERVAL': 30.0,
        'HEARTBEAT_TIMEOUT': 5.0,
        'MAX_PAYLOAD_SIZE': 10485760,  # 10MB
        'COMPRESSION_THRESHOLD': 1024,  # 1KB
        'MAX_LISTENERS': 100
    }

    CONNECTION = {
        'STATE_CONNECTING': 0,
        'STATE_OPEN': 1,
        'STATE_CLOSING': 2,
        'STATE_CLOSED': 3
    }

    ERROR_CODES = {
        'ROUTE_NOT_FOUND': 'ROUTE_NOT_FOUND',
        'TIMEOUT': 'TIMEOUT',
        'UNAUTHORIZED': 'UNAUTHORIZED',
        'FORBIDDEN': 'FORBIDDEN',
        'PAYLOAD_TOO_LARGE': 'PAYLOAD_TOO_LARGE',
        'INTERNAL_ERROR': 'INTERNAL_ERROR',
        'INVALID_MESSAGE': 'INVALID_MESSAGE',
        'CONNECTION_LOST': 'CONNECTION_LOST',
        'CANCELLED': 'CANCELLED'
    }

    EVENTS = {
        'CONNECTION': 'connection',
        'DISCONNECT': 'disconnect',
        'ERROR': 'error',
        'RECONNECT': 'reconnect',
        'RECONNECT_FAILED': 'reconnect_failed',
        'AUTHENTICATED': 'authenticated',
        'UNAUTHORIZED': 'unauthorized',
        'MESSAGE': 'message',
        'LATENCY': 'latency'
    }

    # HTTP RPC specific
    HTTP_METHODS = {
        'GET': 'GET',
        'POST': 'POST',
        'PUT': 'PUT',
        'DELETE': 'DELETE',
        'PATCH': 'PATCH'
    }

    # WebSocket RPC specific
    WS_PATH = '/rpc/ws'  # WebSocket endpoint path
    HTTP_PATH_PREFIX = '/rpc'  # HTTP RPC endpoint prefix

