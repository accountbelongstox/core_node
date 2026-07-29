# -*- coding: utf-8 -*-
"""
MCP Backend RPC v2 Route Registration (DEPRECATED)

THIS FILE IS NO LONGER USED.
All MCP routes are now registered in pycore/callmodule/routers/mcp_router.py

This file is kept for backwards compatibility with mcp_backend_main.py only.
If you need to use MCP routes, use pycore_module_caller.py instead.
"""

from typing import Any
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_mcp_routes(rpc_server: Any) -> None:
    """
    DEPRECATED: Route registration moved to pycore/callmodule/routers/mcp_router.py

    This function is kept for backwards compatibility only.
    All MCP backend routes are now registered through FastAPI routers in pycore/callmodule.

    Args:
        rpc_server: FastAPIRPCServer instance (unused)
    """
    ColorPrint.yellow("[MCP Routes] DEPRECATED: register_mcp_routes() is no longer used")
    ColorPrint.yellow("[MCP Routes] All routes are now in pycore/callmodule/routers/mcp_router.py")
    ColorPrint.yellow("[MCP Routes] Use pycore_module_caller.py to start the unified backend")


__all__ = ["register_mcp_routes"]
