# -*- coding: utf-8 -*-
"""
MCP Backend FastAPI Route Registration System

Register all RPC routes for the MCP backend
"""

from typing import Any
from pycore.pyctl.mcpctl.backend import handlers


def register_routes(app: Any, fastapi_module: Any) -> None:
    """
    Register all FastAPI routes for MCP backend

    Args:
        app: FastAPI application instance
        fastapi_module: FastAPI module (imported via third_party)
    """
    JSONResponse = fastapi_module.responses.JSONResponse

    # Route: backend_info (metadata)
    @app.post("/rpc/backend_info")
    async def rpc_backend_info(request: fastapi_module.Request):
        result = handlers.handle_backend_info({}, None, None)
        return JSONResponse({
            "type": "RESPONSE",
            "route": "backend_info",
            "id": str(__import__('uuid').uuid4()),
            "result": result,
            "success": True,
            "sync_response": True,
            "error": None
        })

    # File Processing Routes (4 tools)
    @app.post("/rpc/get_file_info")
    async def rpc_get_file_info(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_get_file_info_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "get_file_info", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/generate_placeholder_image")
    async def rpc_generate_placeholder_image(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_generate_placeholder_image_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "generate_placeholder_image", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/query_file_processing_history")
    async def rpc_query_file_processing_history(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_query_file_processing_history_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "query_file_processing_history", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/clear_file_cache")
    async def rpc_clear_file_cache(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_clear_file_cache_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "clear_file_cache", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    # Database Routes (7 tools)
    @app.post("/rpc/database_namespace_negotiation")
    async def rpc_database_namespace_negotiation(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_namespace_negotiation_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_namespace_negotiation", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_register_and_connect")
    async def rpc_database_register_and_connect(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_register_and_connect_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_register_and_connect", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_execute_query")
    async def rpc_database_execute_query(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_execute_query_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_execute_query", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_batch_operations")
    async def rpc_database_batch_operations(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_batch_operations_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_batch_operations", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_schema_inspection")
    async def rpc_database_schema_inspection(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_schema_inspection_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_schema_inspection", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_get_statistics")
    async def rpc_database_get_statistics(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_get_statistics_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_get_statistics", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/database_health_check")
    async def rpc_database_health_check(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_database_health_check_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "database_health_check", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    # Codebase Routes (8 tools)
    @app.post("/rpc/codebase_get_directory_tree")
    async def rpc_codebase_get_directory_tree(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_get_directory_tree_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_get_directory_tree", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_find_files_by_pattern")
    async def rpc_codebase_find_files_by_pattern(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_find_files_by_pattern_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_find_files_by_pattern", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_search_content")
    async def rpc_codebase_search_content(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_search_content_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_search_content", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_get_file_content")
    async def rpc_codebase_get_file_content(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_get_file_content_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_get_file_content", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_analyze_statistics")
    async def rpc_codebase_analyze_statistics(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_analyze_statistics_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_analyze_statistics", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_describe_directory")
    async def rpc_codebase_describe_directory(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_describe_directory_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_describe_directory", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_scan_framework_apps")
    async def rpc_codebase_scan_framework_apps(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_scan_framework_apps_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_scan_framework_apps", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})

    @app.post("/rpc/codebase_health_check")
    async def rpc_codebase_health_check(request: fastapi_module.Request):
        params = await request.json()
        result = await handlers.handle_codebase_health_check_async(params, None, None)
        return JSONResponse({"type": "RESPONSE", "route": "codebase_health_check", "id": str(__import__('uuid').uuid4()), "result": result, "success": result.get("success", True), "sync_response": True, "error": result.get("error", None)})
