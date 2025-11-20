# -*- coding: utf-8 -*-
"""
Database Routes

Handles database connections, queries, batch operations, and schema inspection
(Extracted from rpc_routes.py, reuses handlers)
"""

from typing import Any, Dict
from pycore.pyctl.mcpctl.backend import handlers


def register_database_routes(rpc_server: Any) -> None:
    """
    Register database routes (reuses handlers)

    Routes:
    - database_namespace_negotiation: Namespace negotiation
    - database_register_and_connect: Register and connect
    - database_execute_query: Execute query
    - database_batch_operations: Batch operations
    - database_schema_inspection: Schema inspection
    - database_get_statistics: Get statistics
    - database_health_check: Health check
    """

    @rpc_server.route("database_namespace_negotiation", sync=True, description="Database namespace negotiation")
    async def route_database_namespace_negotiation(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database namespace negotiation (reuses handlers.handle_database_namespace_negotiation_async)"""
        result = await handlers.handle_database_namespace_negotiation_async(params, None, None)
        return result

    @rpc_server.route("database_register_and_connect", sync=True, description="Register and connect to database")
    async def route_database_register_and_connect(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database register and connect (reuses handlers.handle_database_register_and_connect_async)"""
        result = await handlers.handle_database_register_and_connect_async(params, None, None)
        return result

    @rpc_server.route("database_execute_query", sync=True, description="Execute database query")
    async def route_database_execute_query(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database execute query (reuses handlers.handle_database_execute_query_async)"""
        result = await handlers.handle_database_execute_query_async(params, None, None)
        return result

    @rpc_server.route("database_batch_operations", sync=True, description="Database batch operations")
    async def route_database_batch_operations(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database batch operations (reuses handlers.handle_database_batch_operations_async)"""
        result = await handlers.handle_database_batch_operations_async(params, None, None)
        return result

    @rpc_server.route("database_schema_inspection", sync=True, description="Database schema inspection")
    async def route_database_schema_inspection(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database schema inspection (reuses handlers.handle_database_schema_inspection_async)"""
        result = await handlers.handle_database_schema_inspection_async(params, None, None)
        return result

    @rpc_server.route("database_get_statistics", sync=True, description="Get database statistics")
    async def route_database_get_statistics(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database get statistics (reuses handlers.handle_database_get_statistics_async)"""
        result = await handlers.handle_database_get_statistics_async(params, None, None)
        return result

    @rpc_server.route("database_health_check", sync=True, description="Database health check")
    async def route_database_health_check(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Database health check (reuses handlers.handle_database_health_check_async)"""
        result = await handlers.handle_database_health_check_async(params, None, None)
        return result
