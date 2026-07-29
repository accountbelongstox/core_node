# -*- coding: utf-8 -*-
"""Native RPC v2 routes for module, client, upload, and MCP services."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.module_call_controller import ModuleCallController
from pycore.callmodule.controllers.client.controller import ClientController
from pycore.callmodule.controllers.upload.controller import UploadController
from pycore.callmodule.models.request_models import ModuleCallRequest
import pycore.pyctl.mcpctl.backend.handlers.codebase as codebase_handlers
import pycore.pyctl.mcpctl.backend.handlers.database as database_handlers
import pycore.pyctl.mcpctl.backend.handlers.file_processing as file_processing_handlers
from pycore.pyctl.mcpctl.backend.config import BACKEND_INFO_TEMPLATE
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM


def register_system_routes(server) -> None:
    module = ModuleCallController()
    client = ClientController()
    upload = UploadController()
    mcp_handlers = {
        "get_file_info": file_processing_handlers.handle_get_file_info_async,
        "generate_placeholder_image": file_processing_handlers.handle_generate_placeholder_image_async,
        "query_file_processing_history": file_processing_handlers.handle_query_file_processing_history_async,
        "clear_file_cache": file_processing_handlers.handle_clear_file_cache_async,
        "clear_file_cache_tool": file_processing_handlers.handle_clear_file_cache_async,
        "database_namespace_negotiation": database_handlers.handle_database_namespace_negotiation_async,
        "database_register_and_connect": database_handlers.handle_database_register_and_connect_async,
        "database_execute_query": database_handlers.handle_database_execute_query_async,
        "database_batch_operations": database_handlers.handle_database_batch_operations_async,
        "database_schema_inspection": database_handlers.handle_database_schema_inspection_async,
        "database_get_statistics": database_handlers.handle_database_get_statistics_async,
        "database_health_check": database_handlers.handle_database_health_check_async,
        "codebase_get_directory_tree": codebase_handlers.handle_codebase_get_directory_tree_async,
        "codebase_find_files_by_pattern": codebase_handlers.handle_codebase_find_files_by_pattern_async,
        "codebase_search_content": codebase_handlers.handle_codebase_search_content_async,
        "codebase_get_file_content": codebase_handlers.handle_codebase_get_file_content_async,
        "codebase_analyze_statistics": codebase_handlers.handle_codebase_analyze_statistics_async,
        "codebase_describe_directory": codebase_handlers.handle_codebase_describe_directory_async,
        "codebase_scan_framework_apps": codebase_handlers.handle_codebase_scan_framework_apps_async,
        "codebase_health_check": codebase_handlers.handle_codebase_health_check_async,
    }

    async def handler(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "module_call":
            return await asyncio.to_thread(module.call_module, ModuleCallRequest(**(params.get("request") or {})))
        if action == "module_history":
            return await asyncio.to_thread(module.get_history)
        if action == "client_forward":
            return await asyncio.to_thread(client.forward, params.get("endpoint"), params.get("method", "POST"), params.get("data"))
        if action == "client_status":
            return await asyncio.to_thread(client.get_connection_status)
        if action == "upload_tasks":
            return await asyncio.to_thread(upload.get_tasks)
        if action == "upload_servers":
            return await asyncio.to_thread(upload.get_servers)
        if action == "mcp_backend_info":
            return dict(BACKEND_INFO_TEMPLATE)
        if action == "mcp_backend_state":
            return get_backend_state_dict()
        if action == "mcp_tools_list":
            return {"tools": []}
        target = mcp_handlers.get(action)
        if target:
            return await target(params, None, None)
        raise ValueError(f"Unsupported system operation: {action}")

    server.route(name=UI_SYSTEM, handler=handler, sync=False, description="Native module/client/upload/MCP operation")
    ColorPrint.green("[ConfigBuilder] Registered native system RPC route")


__all__ = ["register_system_routes"]
