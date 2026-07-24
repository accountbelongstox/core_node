# -*- coding: utf-8 -*-
"""Database Handlers (7 tools)"""

from typing import Dict, Any
from pycore.pyctl.mcpctl.backend.handlers.context import get_database_context

async def handle_database_namespace_negotiation_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database namespace negotiation tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.create_and_negotiate_namespace(
            client_identifier=params.get("client_identifier", "default_client"),
            custom_namespace=params.get("custom_namespace")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_register_and_connect_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database register and connect tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.register_database_connection(
            namespace=params.get("namespace"),
            database_name=params.get("database_name"),
            connection_string=params.get("connection_string")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_execute_query_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database execute query with safety tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.execute_safe_query(
            namespace=params.get("namespace"),
            database_name=params.get("database_name"),
            query=params.get("query"),
            params=params.get("params"),
            max_rows=params.get("max_rows", 1000),
            timeout_seconds=params.get("timeout_seconds", 30)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_batch_operations_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database batch operations tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.execute_batch_operations(
            namespace=params.get("namespace"),
            database_name=params.get("database_name"),
            operation_type=params.get("operation_type"),
            table_name=params.get("table_name"),
            data=params.get("data"),
            batch_size=params.get("batch_size", 100)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_schema_inspection_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database schema inspection tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.get_database_schema(
            namespace=params.get("namespace"),
            database_name=params.get("database_name"),
            table_pattern=params.get("table_pattern")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_get_statistics_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database get statistics tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.get_database_statistics(
            namespace=params.get("namespace"),
            database_name=params.get("database_name")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_database_health_check_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Database health check tool handler"""
    backend_info, db_controller = get_database_context()
    try:
        result = await db_controller.health_check()
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}
