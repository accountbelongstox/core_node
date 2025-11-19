#!/usr/bin/env python3
"""
Flutter design documentation dev tools (rpc_v2 wrapper).

This package re-hosts the legacy flutter_dev_tools UI using the shared
rpc_v2 FastAPI server so it can run from within pycore.
"""

from pycore.pyutils.flutter_dev_tools.server import FlutterDevToolsServer, create_flutter_dev_tools_server

__all__ = [
    "FlutterDevToolsServer",
    "create_flutter_dev_tools_server",
]
