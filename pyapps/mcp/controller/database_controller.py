#!/usr/bin/env python3
"""
Database controller for MCP unified server
Provides simplified interface to database operations
"""

from typing import Dict, List, Optional, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.mcp.database import (
    get_database_namespace_manager_singleton,
    get_database_operations_manager_singleton
)


class DatabaseController:
    """
    Controller for database operations in MCP unified server
    Provides high-level interface to database namespace and operations managers
    """

    def __init__(self):
        self.namespace_manager = get_database_namespace_manager_singleton()
        self.operations_manager = get_database_operations_manager_singleton()
        ColorPrint.green("[DatabaseController] Initialized")

    async def create_and_negotiate_namespace(
        self,
        client_identifier: str = "default_client",
        custom_namespace: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create or negotiate a namespace for the client

        Args:
            client_identifier: Client ID (e.g., "claude_desktop", "cursor")
            custom_namespace: Optional custom namespace

        Returns:
            Namespace creation result with session info
        """
        try:
            session_info = self.namespace_manager.create_namespace_for_client(
                client_identifier=client_identifier,
                custom_namespace=custom_namespace
            )

            return {
                'success': True,
                'namespace': session_info['namespace'],
                'session_key': session_info['session_key'],
                'session_info': session_info
            }

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Namespace creation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def register_database_connection(
        self,
        namespace: str,
        database_name: str,
        connection_string: str
    ) -> Dict[str, Any]:
        """
        Register a database connection to a namespace

        Args:
            namespace: Namespace identifier
            database_name: Friendly database name
            connection_string: SQLAlchemy connection string

        Returns:
            Registration result
        """
        try:
            result = self.namespace_manager.register_database_to_namespace(
                namespace=namespace,
                database_name=database_name,
                connection_string=connection_string
            )

            return {
                'success': True,
                **result
            }

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Database registration failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def execute_safe_query(
        self,
        namespace: str,
        database_name: str,
        query: str,
        params: Optional[Dict[str, Any]] = None,
        max_rows: int = 1000,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Execute SQL query with safety checks

        Args:
            namespace: Namespace identifier
            database_name: Database name
            query: SQL query
            params: Query parameters
            max_rows: Maximum rows to return
            timeout_seconds: Query timeout

        Returns:
            Query results
        """
        try:
            # Get connection string from namespace
            connection_string = self.namespace_manager.get_database_connection_string(
                namespace=namespace,
                database_name=database_name
            )

            if not connection_string:
                return {
                    'success': False,
                    'error': f"Database '{database_name}' not found in namespace '{namespace}'"
                }

            # Execute query with safety checks
            result = self.operations_manager.execute_query_with_safety_checks(
                connection_string=connection_string,
                query=query,
                params=params,
                max_rows=max_rows,
                timeout_seconds=timeout_seconds
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Query execution failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def execute_batch_operations(
        self,
        namespace: str,
        database_name: str,
        operation_type: str,
        table_name: str,
        data: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Execute batch database operations

        Args:
            namespace: Namespace identifier
            database_name: Database name
            operation_type: 'insert', 'update', 'delete', 'upsert'
            table_name: Target table
            data: Data to process
            batch_size: Batch size

        Returns:
            Batch operation results
        """
        try:
            connection_string = self.namespace_manager.get_database_connection_string(
                namespace=namespace,
                database_name=database_name
            )

            if not connection_string:
                return {
                    'success': False,
                    'error': f"Database '{database_name}' not found in namespace '{namespace}'"
                }

            result = self.operations_manager.execute_batch_operations(
                connection_string=connection_string,
                operation_type=operation_type,
                table_name=table_name,
                data=data,
                batch_size=batch_size
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Batch operation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def get_database_schema(
        self,
        namespace: str,
        database_name: str,
        table_pattern: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get database schema information

        Args:
            namespace: Namespace identifier
            database_name: Database name
            table_pattern: Optional table name pattern

        Returns:
            Schema information
        """
        try:
            connection_string = self.namespace_manager.get_database_connection_string(
                namespace=namespace,
                database_name=database_name
            )

            if not connection_string:
                return {
                    'success': False,
                    'error': f"Database '{database_name}' not found in namespace '{namespace}'"
                }

            result = self.operations_manager.get_schema_information(
                connection_string=connection_string,
                table_pattern=table_pattern
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Schema inspection failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def get_database_statistics(
        self,
        namespace: str,
        database_name: str
    ) -> Dict[str, Any]:
        """
        Get database statistics

        Args:
            namespace: Namespace identifier
            database_name: Database name

        Returns:
            Database statistics
        """
        try:
            connection_string = self.namespace_manager.get_database_connection_string(
                namespace=namespace,
                database_name=database_name
            )

            if not connection_string:
                return {
                    'success': False,
                    'error': f"Database '{database_name}' not found in namespace '{namespace}'"
                }

            result = self.operations_manager.get_database_statistics(
                connection_string=connection_string
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Statistics failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def list_namespace_databases(
        self,
        namespace: str
    ) -> Dict[str, Any]:
        """
        List all databases in a namespace

        Args:
            namespace: Namespace identifier

        Returns:
            List of databases
        """
        try:
            result = self.namespace_manager.list_namespace_databases(namespace)
            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Database listing failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on database subsystem

        Returns:
            Health check results
        """
        try:
            all_namespaces = self.namespace_manager.get_all_namespaces()
            query_history = self.operations_manager.get_query_history(limit=10)

            return {
                'success': True,
                'subsystem': 'database',
                'namespaces': all_namespaces,
                'recent_queries_count': len(query_history),
                'active_connections': len(self.operations_manager.engines)
            }

        except Exception as e:
            ColorPrint.red(f"[DatabaseController] Health check failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
_database_controller_singleton: Optional[DatabaseController] = None


def get_database_controller_singleton() -> DatabaseController:
    """Get singleton instance of DatabaseController"""
    global _database_controller_singleton
    if _database_controller_singleton is None:
        _database_controller_singleton = DatabaseController()
    return _database_controller_singleton
