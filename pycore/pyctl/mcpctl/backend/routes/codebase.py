# -*- coding: utf-8 -*-
"""
Codebase Routes

Handles codebase tree generation, file search, content analysis, and statistics
(Extracted from rpc_routes.py, reuses handlers)
"""

from typing import Any, Dict
from pycore.pyctl.mcpctl.backend import handlers


def register_codebase_routes(rpc_server: Any) -> None:
    """
    Register codebase routes (reuses handlers)

    Routes:
    - codebase_get_directory_tree: Get directory tree
    - codebase_find_files_by_pattern: Find files by pattern
    - codebase_search_content: Search content
    - codebase_get_file_content: Get file content
    - codebase_analyze_statistics: Analyze statistics
    - codebase_describe_directory: Describe directory
    - codebase_scan_framework_apps: Scan framework apps
    - codebase_health_check: Health check
    """

    @rpc_server.route("codebase_get_directory_tree", sync=True, description="Get codebase directory tree")
    async def route_codebase_get_directory_tree(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase get directory tree (reuses handlers.handle_codebase_get_directory_tree_async)"""
        result = await handlers.handle_codebase_get_directory_tree_async(params, None, None)
        return result

    @rpc_server.route("codebase_find_files_by_pattern", sync=True, description="Find files by pattern")
    async def route_codebase_find_files_by_pattern(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase find files by pattern (reuses handlers.handle_codebase_find_files_by_pattern_async)"""
        result = await handlers.handle_codebase_find_files_by_pattern_async(params, None, None)
        return result

    @rpc_server.route("codebase_search_content", sync=True, description="Search content in codebase")
    async def route_codebase_search_content(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase search content (reuses handlers.handle_codebase_search_content_async)"""
        result = await handlers.handle_codebase_search_content_async(params, None, None)
        return result

    @rpc_server.route("codebase_get_file_content", sync=True, description="Get file content")
    async def route_codebase_get_file_content(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase get file content (reuses handlers.handle_codebase_get_file_content_async)"""
        result = await handlers.handle_codebase_get_file_content_async(params, None, None)
        return result

    @rpc_server.route("codebase_analyze_statistics", sync=True, description="Analyze codebase statistics")
    async def route_codebase_analyze_statistics(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase analyze statistics (reuses handlers.handle_codebase_analyze_statistics_async)"""
        result = await handlers.handle_codebase_analyze_statistics_async(params, None, None)
        return result

    @rpc_server.route("codebase_describe_directory", sync=True, description="Describe directory structure")
    async def route_codebase_describe_directory(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase describe directory (reuses handlers.handle_codebase_describe_directory_async)"""
        result = await handlers.handle_codebase_describe_directory_async(params, None, None)
        return result

    @rpc_server.route("codebase_scan_framework_apps", sync=True, description="Scan framework apps")
    async def route_codebase_scan_framework_apps(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase scan framework apps (reuses handlers.handle_codebase_scan_framework_apps_async)"""
        result = await handlers.handle_codebase_scan_framework_apps_async(params, None, None)
        return result

    @rpc_server.route("codebase_health_check", sync=True, description="Codebase health check")
    async def route_codebase_health_check(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Codebase health check (reuses handlers.handle_codebase_health_check_async)"""
        result = await handlers.handle_codebase_health_check_async(params, None, None)
        return result
