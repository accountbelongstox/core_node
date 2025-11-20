# -*- coding: utf-8 -*-
"""
MCP Backend RPC v2 Route Registration

Register all MCP backend routes to RPC v2 server.
Does not implement HTTP server - uses pycore.pyutils.rpc_v2 architecture.
"""

from typing import Any, Dict
from pycore.pyctl.mcpctl.backend import handlers
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict
from pycore import ColorPrint


def register_mcp_routes(rpc_server: Any) -> None:
    """
    Register all MCP backend routes to RPC v2 server

    Args:
        rpc_server: FastAPIRPCServer instance from pycore.pyutils.rpc_v2
    """
    ColorPrint.blue("[MCP Routes] Registering routes to RPC v2 server...")

    # ============================================================
    # Meta Routes (sync=True for immediate response)
    # ============================================================

    @rpc_server.route("backend_info", sync=True, description="Get backend metadata (ID, ports, status)")
    async def route_backend_info(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get backend information"""
        result = handlers.handle_backend_info(params, None, None)
        return result

    @rpc_server.route("backend_state", sync=True, description="Get backend processing state (IDLE/BUSY)")
    async def route_backend_state(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get backend state (processing state)"""
        result = get_backend_state_dict()
        return result

    @rpc_server.route("tools_list", sync=True, description="List all available MCP tools")
    async def route_tools_list(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get list of available tools"""
        tools = handlers.file_processing.backend_info.get("tools", [])
        return {"tools": tools}

    # ============================================================
    # File Processing Routes (sync=True for fast operations)
    # ============================================================

    @rpc_server.route("get_file_info", sync=True, description="Extract file info with OCR/document parsing")
    async def route_get_file_info(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Get file information with OCR and document parsing"""
        result = await handlers.handle_get_file_info_async(params, None, None)
        return result

    @rpc_server.route("generate_placeholder_image", sync=True, description="Generate placeholder image")
    async def route_generate_placeholder_image(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Generate placeholder image"""
        result = await handlers.handle_generate_placeholder_image_async(params, None, None)
        return result

    @rpc_server.route("query_file_processing_history", sync=True, description="Query file processing history")
    async def route_query_file_processing_history(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Query file processing history"""
        result = await handlers.handle_query_file_processing_history_async(params, None, None)
        return result

    @rpc_server.route("clear_file_cache", sync=True, description="Clear file processing cache")
    async def route_clear_file_cache(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Clear file cache"""
        result = await handlers.handle_clear_file_cache_async(params, None, None)
        return result

    # Alias for clear_file_cache_tool
    @rpc_server.route("clear_file_cache_tool", sync=True, description="Clear file cache (alias)")
    async def route_clear_file_cache_tool(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Clear file cache (alias)"""
        result = await handlers.handle_clear_file_cache_async(params, None, None)
        return result

    # ============================================================
    # Database Routes (sync=True for fast DB operations)
    # ============================================================

    @rpc_server.route("database_namespace_negotiation", sync=True, description="Database namespace negotiation")
    async def route_database_namespace_negotiation(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database namespace negotiation"""
        result = await handlers.handle_database_namespace_negotiation_async(params, None, None)
        return result

    @rpc_server.route("database_register_and_connect", sync=True, description="Register and connect to database")
    async def route_database_register_and_connect(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database register and connect"""
        result = await handlers.handle_database_register_and_connect_async(params, None, None)
        return result

    @rpc_server.route("database_execute_query", sync=True, description="Execute database query")
    async def route_database_execute_query(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database execute query"""
        result = await handlers.handle_database_execute_query_async(params, None, None)
        return result

    @rpc_server.route("database_batch_operations", sync=True, description="Database batch operations")
    async def route_database_batch_operations(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database batch operations"""
        result = await handlers.handle_database_batch_operations_async(params, None, None)
        return result

    @rpc_server.route("database_schema_inspection", sync=True, description="Database schema inspection")
    async def route_database_schema_inspection(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database schema inspection"""
        result = await handlers.handle_database_schema_inspection_async(params, None, None)
        return result

    @rpc_server.route("database_get_statistics", sync=True, description="Get database statistics")
    async def route_database_get_statistics(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database get statistics"""
        result = await handlers.handle_database_get_statistics_async(params, None, None)
        return result

    @rpc_server.route("database_health_check", sync=True, description="Database health check")
    async def route_database_health_check(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database health check"""
        result = await handlers.handle_database_health_check_async(params, None, None)
        return result

    # ============================================================
    # Codebase Routes (sync=True for fast operations)
    # ============================================================

    @rpc_server.route("codebase_get_directory_tree", sync=True, description="Get codebase directory tree")
    async def route_codebase_get_directory_tree(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase get directory tree"""
        result = await handlers.handle_codebase_get_directory_tree_async(params, None, None)
        return result

    @rpc_server.route("codebase_find_files_by_pattern", sync=True, description="Find files by pattern")
    async def route_codebase_find_files_by_pattern(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase find files by pattern"""
        result = await handlers.handle_codebase_find_files_by_pattern_async(params, None, None)
        return result

    @rpc_server.route("codebase_search_content", sync=True, description="Search content in codebase")
    async def route_codebase_search_content(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase search content"""
        result = await handlers.handle_codebase_search_content_async(params, None, None)
        return result

    @rpc_server.route("codebase_get_file_content", sync=True, description="Get file content")
    async def route_codebase_get_file_content(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase get file content"""
        result = await handlers.handle_codebase_get_file_content_async(params, None, None)
        return result

    @rpc_server.route("codebase_analyze_statistics", sync=True, description="Analyze codebase statistics")
    async def route_codebase_analyze_statistics(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase analyze statistics"""
        result = await handlers.handle_codebase_analyze_statistics_async(params, None, None)
        return result

    @rpc_server.route("codebase_describe_directory", sync=True, description="Describe directory structure")
    async def route_codebase_describe_directory(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase describe directory"""
        result = await handlers.handle_codebase_describe_directory_async(params, None, None)
        return result

    @rpc_server.route("codebase_scan_framework_apps", sync=True, description="Scan framework apps")
    async def route_codebase_scan_framework_apps(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase scan framework apps"""
        result = await handlers.handle_codebase_scan_framework_apps_async(params, None, None)
        return result

    @rpc_server.route("codebase_health_check", sync=True, description="Codebase health check")
    async def route_codebase_health_check(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase health check"""
        result = await handlers.handle_codebase_health_check_async(params, None, None)
        return result

    # Get route statistics
    stats = rpc_server.routes_manager.get_route_stats()
    ColorPrint.green(f"[MCP Routes] Registered {stats['total']} routes:")
    ColorPrint.green(f"  - Meta: 3 routes")
    ColorPrint.green(f"  - File Processing: 5 routes")
    ColorPrint.green(f"  - Database: 7 routes")
    ColorPrint.green(f"  - Codebase: 8 routes")
    ColorPrint.green(f"  - All routes are sync (immediate response)")


__all__ = ["register_mcp_routes"]
