# -*- coding: utf-8 -*-
"""
pyutils.wsrpc - Python WebSocket RPC Framework
A lightweight, bidirectional RPC framework over WebSocket for Python

Extensions:
- SingletonBackendDetector: Singleton instance detection and management
- SingletonRpcBackend: Integrated singleton + RPC backend
"""

from pycore.pyutils.wsrpc.ws_rpc_server import WsRpcServer
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient
from pycore.pyutils.wsrpc.singleton_backend import SingletonBackendDetector, send_shutdown_signal, get_instance_status
from pycore.pyutils.wsrpc.singleton_rpc_backend import SingletonRpcBackend

__version__ = '1.0.1'
__all__ = [
    'WsRpcServer',
    'WsRpcClient',
    'SingletonBackendDetector',
    'SingletonRpcBackend',
    'send_shutdown_signal',
    'get_instance_status'
]
