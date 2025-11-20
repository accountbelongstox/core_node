# -*- coding: utf-8 -*-
"""
File Processing Routes

Handles file info extraction, OCR, document parsing, and caching
(Extracted from rpc_routes.py, reuses handlers)
"""

from typing import Any, Dict
from pycore.pyctl.mcpctl.backend import handlers


def register_file_routes(rpc_server: Any) -> None:
    """
    Register file processing routes (reuses handlers)

    Routes:
    - get_file_info: Extract file info with OCR/document parsing
    - generate_placeholder_image: Generate placeholder image
    - query_file_processing_history: Query processing history
    - clear_file_cache: Clear file processing cache
    - clear_file_cache_tool: Clear file cache (alias)
    """

    @rpc_server.route("get_file_info", sync=True, description="Extract file info with OCR/document parsing")
    async def route_get_file_info(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get file information (reuses handlers.handle_get_file_info_async)"""
        result = await handlers.handle_get_file_info_async(params, None, None)
        return result

    @rpc_server.route("generate_placeholder_image", sync=True, description="Generate placeholder image")
    async def route_generate_placeholder_image(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Generate placeholder image (reuses handlers.handle_generate_placeholder_image_async)"""
        result = await handlers.handle_generate_placeholder_image_async(params, None, None)
        return result

    @rpc_server.route("query_file_processing_history", sync=True, description="Query file processing history")
    async def route_query_file_processing_history(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Query file processing history (reuses handlers.handle_query_file_processing_history_async)"""
        result = await handlers.handle_query_file_processing_history_async(params, None, None)
        return result

    @rpc_server.route("clear_file_cache", sync=True, description="Clear file processing cache")
    async def route_clear_file_cache(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Clear file cache (reuses handlers.handle_clear_file_cache_async)"""
        result = await handlers.handle_clear_file_cache_async(params, None, None)
        return result

    # Alias for clear_file_cache (reuses same handler)
    @rpc_server.route("clear_file_cache_tool", sync=True, description="Clear file cache (alias)")
    async def route_clear_file_cache_tool(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Clear file cache tool (reuses handlers.handle_clear_file_cache_async)"""
        result = await handlers.handle_clear_file_cache_async(params, None, None)
        return result
