# -*- coding: utf-8 -*-
"""
pyutils.wsrpc - Python WebSocket RPC Framework
A lightweight, bidirectional RPC framework over WebSocket for Python
"""

from .ws_rpc_server import WsRpcServer
from .ws_rpc_client import WsRpcClient

__version__ = '1.0.0'
__all__ = ['WsRpcServer', 'WsRpcClient']
