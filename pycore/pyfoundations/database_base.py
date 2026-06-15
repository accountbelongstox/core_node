#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Base Class

Provides base database functionality for SQLite operations.
This is a foundation module - only uses Python standard library.
"""

import sqlite3
import threading
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from contextlib import contextmanager

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class DatabaseBase:
    """
    Base database class for SQLite operations
    
    Features:
    - Thread-safe connection management
    - Automatic connection pooling
    - Transaction support
    - Query execution with error handling
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
        self._lock = threading.RLock()
        self._connection = None
        self._is_connected = False
        
        # Ensure database directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
    
    def connect(self) -> bool:
        """
        Connect to database
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        with self._lock:
            if self._is_connected and self._connection:
                return True
            
            self._connection = sqlite3.connect(
                str(self.db_path),
                timeout=self.timeout,
                check_same_thread=False
            )
            self._connection.row_factory = sqlite3.Row
            self._is_connected = True
            return True
    
    def disconnect(self):
        """Disconnect from database"""
        with self._lock:
            if self._connection:
                self._connection.close()
                self._connection = None
                self._is_connected = False
    
    @contextmanager
    def transaction(self):
        """
        Context manager for database transactions
        
        Usage:
            with db.transaction():
                db.execute("INSERT INTO ...")
                db.execute("UPDATE ...")
        """
        with self._lock:
            if not self._is_connected:
                self.connect()
            
            try:
                yield self._connection
                self._connection.commit()
            except Exception as e:
                self._connection.rollback()
                ColorPrint.red(f"[Database] Transaction failed: {e}")
                raise
    
    def execute(self, query: str, params: Optional[Tuple] = None) -> sqlite3.Cursor:
        """
        Execute a query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            sqlite3.Cursor: Query result cursor
        """
        with self._lock:
            if not self._is_connected:
                self.connect()
            
            if params:
                return self._connection.execute(query, params)
            else:
                return self._connection.execute(query)
    
    def executemany(self, query: str, params_list: List[Tuple]) -> sqlite3.Cursor:
        """
        Execute a query multiple times with different parameters
        
        Args:
            query: SQL query string
            params_list: List of parameter tuples
        
        Returns:
            sqlite3.Cursor: Query result cursor
        """
        with self._lock:
            if not self._is_connected:
                self.connect()
            
            return self._connection.executemany(query, params_list)
    
    def fetchone(self, query: str, params: Optional[Tuple] = None) -> Optional[sqlite3.Row]:
        """
        Fetch one row from query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            sqlite3.Row or None: Single row result
        """
        cursor = self.execute(query, params)
        return cursor.fetchone()
    
    def fetchall(self, query: str, params: Optional[Tuple] = None) -> List[sqlite3.Row]:
        """
        Fetch all rows from query
        
        Args:
            query: SQL query string
            params: Query parameters (optional)
        
        Returns:
            List[sqlite3.Row]: All row results
        """
        cursor = self.execute(query, params)
        return cursor.fetchall()
    
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

