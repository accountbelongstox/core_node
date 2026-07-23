#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Base Class

Provides base database functionality for SQLite operations.
This is a foundation module - only uses Python standard library.
"""

import sqlite3
import threading
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS


class DatabaseWorkerThread(threading.Thread):
    """Own one SQLite connection and process requests from THREAD_BUS."""

    def __init__(self, queue_name: str) -> None:
        super().__init__(name=f"DatabaseWorker-{queue_name[-8:]}", daemon=True)
        self._queue_name = queue_name
        self._connection: Optional[sqlite3.Connection] = None
        self._db_path: Optional[Path] = None
        self._timeout = 5.0
        self._in_transaction = False

    def run(self) -> None:
        while not THREAD_BUS.is_shutdown_requested():
            request = THREAD_BUS.receive_message(
                self._queue_name,
                block=True,
                timeout=0.1,
            )
            if not isinstance(request, dict):
                continue

            response_signal = request.get('response_signal', '')
            try:
                result = self._handle_request(request)
                response = {'success': True, 'result': result}
            except Exception as exc:
                response = {'success': False, 'error': str(exc)}
            if response_signal:
                THREAD_BUS.signal(response_signal, response)

        if self._connection is not None:
            self._connection.close()

    def _handle_request(self, request: Dict[str, Any]) -> Any:
        operation = request.get('operation')
        if operation == 'configure':
            self._db_path = Path(request['db_path'])
            self._timeout = float(request.get('timeout', 5.0))
            return True
        if operation == 'connect':
            return self._connect()
        if operation == 'disconnect':
            return self._disconnect()

        connection = self._require_connection()
        query = request.get('query', '')
        params = request.get('params')
        if operation == 'execute':
            cursor = connection.execute(query, params) if params else connection.execute(query)
            if not self._in_transaction:
                connection.commit()
            return cursor.rowcount
        if operation == 'executemany':
            cursor = connection.executemany(query, request.get('params_list', []))
            if not self._in_transaction:
                connection.commit()
            return cursor.rowcount
        if operation == 'fetchone':
            cursor = connection.execute(query, params) if params else connection.execute(query)
            return cursor.fetchone()
        if operation == 'fetchall':
            cursor = connection.execute(query, params) if params else connection.execute(query)
            return cursor.fetchall()
        if operation == 'begin':
            connection.execute('BEGIN')
            self._in_transaction = True
            return True
        if operation == 'commit':
            connection.commit()
            self._in_transaction = False
            return True
        if operation == 'rollback':
            connection.rollback()
            self._in_transaction = False
            return True
        raise ValueError(f"Unsupported database operation: {operation}")

    def _connect(self) -> bool:
        if self._connection is not None:
            return True
        if self._db_path is None:
            raise RuntimeError('Database worker is not configured')
        self._connection = sqlite3.connect(
            str(self._db_path),
            timeout=self._timeout,
        )
        self._connection.row_factory = sqlite3.Row
        return True

    def _disconnect(self) -> bool:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
            self._in_transaction = False
        return True

    def _require_connection(self) -> sqlite3.Connection:
        self._connect()
        if self._connection is None:
            raise RuntimeError('Database connection is unavailable')
        return self._connection


class DatabaseBase:
    """
    Base database class for SQLite operations
    
    SQLite facade whose connection is isolated in DatabaseWorkerThread.
    """
    
    def __init__(self, db_path: Path, timeout: float = 5.0):
        """
        Initialize database base
        
        Args:
            db_path: Path to SQLite database file
            timeout: Connection timeout in seconds
        """
        self.db_path = Path(db_path)
        self.timeout = timeout
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._queue_name = f"database.requests.{uuid.uuid4().hex}"
        self._worker = DatabaseWorkerThread(self._queue_name)
        self._worker.start()
        self._request(
            'configure',
            db_path=str(self.db_path),
            timeout=self.timeout,
        )
    
    def connect(self) -> bool:
        """
        Connect to database
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        return bool(self._request('connect'))
    
    def disconnect(self):
        """Disconnect from database"""
        self._request('disconnect')
    
    @contextmanager
    def transaction(self):
        """
        Context manager for database transactions
        
        Usage:
            with db.transaction():
                db.execute("INSERT INTO ...")
                db.execute("UPDATE ...")
        """
        self._request('begin')
        try:
            yield self
            self._request('commit')
        except Exception as exc:
            self._request('rollback')
            ColorPrint.red(f"[Database] Transaction failed: {exc}")
            raise
    
    def execute(self, query: str, params: Optional[Tuple] = None) -> int:
        """
        Execute a query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            Number of affected rows
        """
        return int(self._request('execute', query=query, params=params))
    
    def executemany(self, query: str, params_list: List[Tuple]) -> int:
        """
        Execute a query multiple times with different parameters
        
        Args:
            query: SQL query string
            params_list: List of parameter tuples
        
        Returns:
            Number of affected rows
        """
        return int(self._request(
            'executemany',
            query=query,
            params_list=params_list,
        ))
    
    def fetchone(self, query: str, params: Optional[Tuple] = None) -> Optional[sqlite3.Row]:
        """
        Fetch one row from query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            sqlite3.Row or None: Single row result
        """
        return self._request('fetchone', query=query, params=params)
    
    def fetchall(self, query: str, params: Optional[Tuple] = None) -> List[sqlite3.Row]:
        """
        Fetch all rows from query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            List[sqlite3.Row]: All row results
        """
        rows = self._request('fetchall', query=query, params=params)
        return list(rows or [])

    def _request(self, operation: str, **payload: Any) -> Any:
        """Send one request and wait for its THREAD_BUS response."""
        response_signal = (
            f"{self._queue_name}.response.{uuid.uuid4().hex}"
        )
        request = {
            'operation': operation,
            'response_signal': response_signal,
            **payload,
        }
        THREAD_BUS.send_message(self._queue_name, request)
        response = THREAD_BUS.wait_signal(
            response_signal,
            timeout=max(5.0, self.timeout + 1.0),
        )
        THREAD_BUS.clear_signal(response_signal)
        if not isinstance(response, dict):
            raise TimeoutError(f"Database operation timed out: {operation}")
        if not response.get('success'):
            raise RuntimeError(response.get('error', 'Database operation failed'))
        return response.get('result')
    
    def create_table(self, table_name: str, schema: Dict[str, str]):
        """
        Create a table with given schema
        
        Args:
            table_name: Name of the table
            schema: Dictionary mapping column names to SQL types
        """
        columns = [f"{name} {type_def}" for name, type_def in schema.items()]
        query = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)})"
        self.execute(query)
    
    def table_exists(self, table_name: str) -> bool:
        """
        Check if table exists
        
        Args:
            table_name: Name of the table
        
        Returns:
            bool: True if table exists, False otherwise
        """
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        result = self.fetchone(query, (table_name,))
        return result is not None
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
