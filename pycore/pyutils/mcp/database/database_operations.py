#!/usr/bin/env python3
"""
Database operations with safety checks and resource limits
Simplified and streamlined from McpAlchemy
"""

import hashlib
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.pyfoundations.color_print import ColorPrint


class DatabaseOperationsManager:
    """
    Manages safe database operations with resource limits
    Connection pooling and query execution with safety checks
    """

    def __init__(self):
        self.engines: Dict[str, Any] = {}  # connection_string -> engine
        self.query_history: List[Dict[str, Any]] = []
        self.max_history_size = 1000
        ColorPrint.blue("[DatabaseOperationsManager] Initialized")

    def get_or_create_engine(self, connection_string: str) -> Any:
        """
        Get or create SQLAlchemy engine with connection pooling

        Args:
            connection_string: SQLAlchemy connection string

        Returns:
            SQLAlchemy engine
        """
        conn_hash = hashlib.md5(connection_string.encode()).hexdigest()

        if conn_hash not in self.engines:
            try:
                # Create engine with connection pooling
                engine = sqlalchemy.create_engine(
                    connection_string,
                    pool_size=5,
                    max_overflow=10,
                    pool_pre_ping=True,  # Verify connections before using
                    pool_recycle=3600    # Recycle connections after 1 hour
                )
                self.engines[conn_hash] = engine
                ColorPrint.green(f"[DatabaseOperationsManager] Created engine: {conn_hash}")
            except Exception as e:
                ColorPrint.red(f"[DatabaseOperationsManager] Failed to create engine: {e}")
                raise

        return self.engines[conn_hash]

    def execute_query_with_safety_checks(
        self,
        connection_string: str,
        query: str,
        params: Optional[Dict[str, Any]] = None,
        max_rows: int = 1000,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Execute SQL query with comprehensive safety checks

        Args:
            connection_string: Database connection string
            query: SQL query to execute
            params: Query parameters (for parameterized queries)
            max_rows: Maximum rows to return
            timeout_seconds: Query timeout in seconds

        Returns:
            Query results with metadata
        """
        start_time = time.time()
        query_hash = hashlib.md5(query.encode()).hexdigest()[:8]

        try:
            engine = self.get_or_create_engine(connection_string)

            with engine.connect() as conn:
                # Set query timeout
                if 'sqlite' not in connection_string.lower():
                    try:
                        conn.execute(sqlalchemy.text(f"SET statement_timeout = {timeout_seconds * 1000}"))
                    except Exception:
                        pass  # Some databases don't support this

                # Execute query
                if params:
                    result = conn.execute(sqlalchemy.text(query), params)
                else:
                    result = conn.execute(sqlalchemy.text(query))

                # Fetch results with row limit
                if result.returns_rows:
                    rows = result.fetchmany(max_rows)
                    column_names = list(result.keys())

                    # Convert rows to list of dicts
                    data = [
                        {col: self._serialize_value(row[i]) for i, col in enumerate(column_names)}
                        for row in rows
                    ]

                    # Check if more rows available
                    has_more = result.fetchone() is not None

                    execution_time = time.time() - start_time

                    result_data = {
                        'success': True,
                        'query_hash': query_hash,
                        'rows_returned': len(data),
                        'columns': column_names,
                        'data': data,
                        'truncated': has_more,
                        'max_rows_limit': max_rows,
                        'execution_time_seconds': round(execution_time, 4),
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    # Non-SELECT query (INSERT, UPDATE, DELETE, etc.)
                    conn.commit()
                    execution_time = time.time() - start_time

                    result_data = {
                        'success': True,
                        'query_hash': query_hash,
                        'rows_affected': result.rowcount,
                        'execution_time_seconds': round(execution_time, 4),
                        'timestamp': datetime.now().isoformat()
                    }

                # Add to query history
                self._add_to_history(query, query_hash, execution_time, result_data['success'])

                return result_data

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = str(e)

            ColorPrint.red(f"[DatabaseOperationsManager] Query failed: {error_msg}")

            # Add to query history
            self._add_to_history(query, query_hash, execution_time, False, error_msg)

            return {
                'success': False,
                'query_hash': query_hash,
                'error': error_msg,
                'error_type': type(e).__name__,
                'execution_time_seconds': round(execution_time, 4),
                'timestamp': datetime.now().isoformat()
            }

    def execute_batch_operations(
        self,
        connection_string: str,
        operation_type: str,  # 'insert', 'update', 'delete', 'upsert'
        table_name: str,
        data: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Execute batch database operations efficiently

        Args:
            connection_string: Database connection string
            operation_type: Type of operation ('insert', 'update', 'delete', 'upsert')
            table_name: Target table name
            data: List of data dictionaries
            batch_size: Number of operations per batch

        Returns:
            Batch operation results
        """
        start_time = time.time()

        try:
            engine = self.get_or_create_engine(connection_string)
            total_processed = 0

            with engine.connect() as conn:
                # Process in batches
                for i in range(0, len(data), batch_size):
                    batch = data[i:i + batch_size]

                    if operation_type == 'insert':
                        # Bulk insert
                        columns = list(batch[0].keys())
                        placeholders = ", ".join([f":{col}" for col in columns])
                        query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"

                        for row in batch:
                            conn.execute(sqlalchemy.text(query), row)
                            total_processed += 1

                    elif operation_type == 'update':
                        # Batch update (requires 'id' or primary key)
                        for row in batch:
                            set_clause = ", ".join([f"{k} = :{k}" for k in row.keys() if k != 'id'])
                            query = f"UPDATE {table_name} SET {set_clause} WHERE id = :id"
                            conn.execute(sqlalchemy.text(query), row)
                            total_processed += 1

                    elif operation_type == 'delete':
                        # Batch delete (requires 'id' field)
                        ids = [row['id'] for row in batch if 'id' in row]
                        if ids:
                            query = f"DELETE FROM {table_name} WHERE id IN :ids"
                            conn.execute(sqlalchemy.text(query), {"ids": tuple(ids)})
                            total_processed += len(ids)

                conn.commit()

            execution_time = time.time() - start_time

            return {
                'success': True,
                'operation_type': operation_type,
                'table_name': table_name,
                'total_processed': total_processed,
                'batch_size': batch_size,
                'execution_time_seconds': round(execution_time, 4),
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = str(e)

            ColorPrint.red(f"[DatabaseOperationsManager] Batch operation failed: {error_msg}")

            return {
                'success': False,
                'operation_type': operation_type,
                'table_name': table_name,
                'error': error_msg,
                'error_type': type(e).__name__,
                'execution_time_seconds': round(execution_time, 4),
                'timestamp': datetime.now().isoformat()
            }

    def get_schema_information(
        self,
        connection_string: str,
        table_pattern: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get database schema information with table and column details

        Args:
            connection_string: Database connection string
            table_pattern: Optional pattern to filter tables (SQL LIKE pattern)

        Returns:
            Schema information including tables and columns
        """
        try:
            engine = self.get_or_create_engine(connection_string)
            inspector = sqlalchemy.inspect(engine)

            table_names = inspector.get_table_names()

            # Filter by pattern if provided
            if table_pattern:
                import re
                pattern = table_pattern.replace('%', '.*')
                table_names = [t for t in table_names if re.match(pattern, t, re.IGNORECASE)]

            tables_info = {}

            for table_name in table_names:
                columns = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                indexes = inspector.get_indexes(table_name)

                tables_info[table_name] = {
                    'columns': [
                        {
                            'name': col['name'],
                            'type': str(col['type']),
                            'nullable': col['nullable'],
                            'default': str(col.get('default', None))
                        }
                        for col in columns
                    ],
                    'primary_key': pk_constraint.get('constrained_columns', []),
                    'indexes': [idx['name'] for idx in indexes],
                    'column_count': len(columns)
                }

            return {
                'success': True,
                'total_tables': len(tables_info),
                'tables': tables_info,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            ColorPrint.red(f"[DatabaseOperationsManager] Schema inspection failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'timestamp': datetime.now().isoformat()
            }

    def get_database_statistics(
        self,
        connection_string: str
    ) -> Dict[str, Any]:
        """
        Get database statistics including row counts and sizes

        Args:
            connection_string: Database connection string

        Returns:
            Database statistics
        """
        try:
            engine = self.get_or_create_engine(connection_string)
            inspector = sqlalchemy.inspect(engine)

            table_names = inspector.get_table_names()
            table_stats = {}

            with engine.connect() as conn:
                for table_name in table_names:
                    try:
                        # Get row count
                        result = conn.execute(sqlalchemy.text(f"SELECT COUNT(*) as cnt FROM {table_name}"))
                        row_count = result.fetchone()[0]

                        table_stats[table_name] = {
                            'row_count': row_count,
                            'columns': len(inspector.get_columns(table_name))
                        }
                    except Exception:
                        table_stats[table_name] = {'error': 'Failed to get statistics'}

            return {
                'success': True,
                'total_tables': len(table_names),
                'table_statistics': table_stats,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            ColorPrint.red(f"[DatabaseOperationsManager] Statistics failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'timestamp': datetime.now().isoformat()
            }

    def _serialize_value(self, value: Any) -> Any:
        """Serialize database values to JSON-compatible types"""
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, bytes):
            return value.hex()
        return str(value)

    def _add_to_history(
        self,
        query: str,
        query_hash: str,
        execution_time: float,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Add query to execution history"""
        history_entry = {
            'query_hash': query_hash,
            'query_preview': query[:200],  # First 200 chars
            'execution_time_seconds': round(execution_time, 4),
            'success': success,
            'timestamp': datetime.now().isoformat()
        }

        if error:
            history_entry['error'] = error

        self.query_history.append(history_entry)

        # Keep history size limited
        if len(self.query_history) > self.max_history_size:
            self.query_history = self.query_history[-self.max_history_size:]

    def get_query_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent query execution history"""
        return self.query_history[-limit:]


# Singleton instance
_database_operations_singleton: Optional[DatabaseOperationsManager] = None


def get_database_operations_manager_singleton() -> DatabaseOperationsManager:
    """Get singleton instance of DatabaseOperationsManager"""
    global _database_operations_singleton
    if _database_operations_singleton is None:
        _database_operations_singleton = DatabaseOperationsManager()
    return _database_operations_singleton
