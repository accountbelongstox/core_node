# -*- coding: utf-8 -*-
"""
MCP Backend Configuration

Port configuration and tool list for MCP Backend
"""

# Port configuration
SINGLETON_PORT_START = 58000
SINGLETON_PORT_RANGE = 100
RPC_SERVICE_PORT = 58100

# Backend info template
BACKEND_INFO_TEMPLATE = {
    "backend_id": None,  # Will be set after launch
    "status": "initializing",
    "singleton_port": None,
    "rpc_port": RPC_SERVICE_PORT,
    "rpc_version": "v2",
    "tools": [
        # File Processing (4 tools)
        "img_ocr_doc_allfile_parser_info_tool",
        "generate_placeholder_image_with_ocr_tool",
        "query_file_processing_history_tool",
        "clear_file_cache_tool",
        # Database (7 tools)
        "database_namespace_negotiation_tool",
        "database_register_and_connect_tool",
        "database_execute_query_with_safety_tool",
        "database_batch_operations_tool",
        "database_schema_inspection_tool",
        "database_get_statistics_tool",
        "database_health_check_tool",
        # Codebase (8 tools)
        "codebase_get_directory_tree_tool",
        "codebase_find_files_by_pattern_tool",
        "codebase_search_content_tool",
        "codebase_get_file_content_tool",
        "codebase_analyze_statistics_tool",
        "codebase_describe_directory_tool",
        "codebase_scan_framework_apps_tool",
        "codebase_health_check_tool"
    ]
}
