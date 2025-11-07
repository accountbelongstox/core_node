# -*- coding: utf-8 -*-
"""
pyutils.wsrpc - Python WebSocket RPC Framework
A lightweight, bidirectional RPC framework over WebSocket for Python

Extensions:
- SingletonBackendDetector: Singleton instance detection and management
- SingletonRpcBackend: Integrated singleton + RPC backend (see singleton_rpc_example.py)
"""

from .ws_rpc_server import WsRpcServer
from .ws_rpc_client import WsRpcClient
from .singleton_backend import SingletonBackendDetector, send_shutdown_signal, get_instance_status

__version__ = '1.0.1'
__all__ = [
    'WsRpcServer',
    'WsRpcClient',
    'SingletonBackendDetector',
    'send_shutdown_signal',
    'get_instance_status'
]
