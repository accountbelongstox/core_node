# -*- coding: utf-8 -*-
"""
Meta Routes - Backend information and status

Handles backend metadata, state, and tools list
(Extracted from rpc_routes.py, reuses handlers)
"""

from typing import Any, Dict
from pycore.pyctl.mcpctl.backend import handlers
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict


def register_meta_routes(rpc_server: Any) -> None:
    """
    Register meta routes (reuses handlers)

    Routes:
    - backend_info: Backend metadata (ID, ports, status)
    - backend_state: Processing state (IDLE/BUSY)
    - tools_list: Available MCP tools
    """

    @rpc_server.route("backend_info", sync=True, description="Get backend metadata (ID, ports, status)")
    async def route_backend_info(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get backend information (reuses handlers.handle_backend_info)"""
        result = handlers.handle_backend_info(params, None, None)
        return result

    @rpc_server.route("backend_state", sync=True, description="Get backend processing state (IDLE/BUSY)")
    async def route_backend_state(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get backend state (reuses global_state)"""
        result = get_backend_state_dict()
        return result

    @rpc_server.route("tools_list", sync=True, description="List all available MCP tools")
    async def route_tools_list(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get list of available tools (reuses handlers.file_processing.backend_info)"""
        tools = handlers.file_processing.backend_info.get("tools", [])
        return {"tools": tools}
