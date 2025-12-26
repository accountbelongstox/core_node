# -*- coding: utf-8 -*-
"""MCP Backend Handlers

Export all handlers for route registration
"""

from .file_processing import (
    handle_backend_info,
    handle_get_file_info_async,
    handle_generate_placeholder_image_async,
    handle_query_file_processing_history_async,
    handle_clear_file_cache_async
)

from .database import (
    handle_database_namespace_negotiation_async,
    handle_database_register_and_connect_async,
    handle_database_execute_query_async,
    handle_database_batch_operations_async,
    handle_database_schema_inspection_async,
    handle_database_get_statistics_async,
    handle_database_health_check_async
)

from .codebase import (
    handle_codebase_get_directory_tree_async,
    handle_codebase_find_files_by_pattern_async,
    handle_codebase_search_content_async,
    handle_codebase_get_file_content_async,
    handle_codebase_analyze_statistics_async,
    handle_codebase_describe_directory_async,
    handle_codebase_scan_framework_apps_async,
    handle_codebase_health_check_async
)

__all__ = [
    # Backend metadata
    "handle_backend_info",
    # File Processing
    "handle_get_file_info_async",
    "handle_generate_placeholder_image_async",
    "handle_query_file_processing_history_async",
    "handle_clear_file_cache_async",
    # Database
    "handle_database_namespace_negotiation_async",
    "handle_database_register_and_connect_async",
    "handle_database_execute_query_async",
    "handle_database_batch_operations_async",
    "handle_database_schema_inspection_async",
    "handle_database_get_statistics_async",
    "handle_database_health_check_async",
    # Codebase
    "handle_codebase_get_directory_tree_async",
    "handle_codebase_find_files_by_pattern_async",
    "handle_codebase_search_content_async",
    "handle_codebase_get_file_content_async",
    "handle_codebase_analyze_statistics_async",
    "handle_codebase_describe_directory_async",
    "handle_codebase_scan_framework_apps_async",
    "handle_codebase_health_check_async"
]
