#!/usr/bin/env python3
"""
BaseModel - Base class for all database table models
Provides core CRUD operations and auto-management features

Dependencies: ONLY pygvar and pyfoundations (avoid circular imports)
"""

from typing import Optional, List, Dict, Any, Type
from abc import ABC, abstractmethod
from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint as _OriginalColorPrint

# Suppress ColorPrint output in MCP mode
class ColorPrint:
    _is_mcp = _OriginalColorPrint.is_mcp_mode()
    @staticmethod
    def blue(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.blue(msg)
    @staticmethod
    def red(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.red(msg)
    @staticmethod
    def green(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.green(msg)
    @staticmethod
    def yellow(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.yellow(msg)
from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()

# Import type converter for automatic type conversion
from pycore.database.type_converter import DatabaseTypeConverter


class BaseModel(ABC):
    """
    Base class for all database table models

    Features:
    - Core CRUD operations
    - Auto-initialization
    - Auto-schema sync
    - Auto-backup

    All models MUST inherit from this class
    """

    # Must be defined in subclass
    __table_key__: str = None           # e.g., "app_myapp.users"
    __namespace__: str = None           # e.g., "app_myapp"
    __table_name__: str = None          # e.g., "users"
    __full_table_name__: str = None     # e.g., "app_myapp_users" (actual DB table name)

    # SQLAlchemy Table object (initialized on load)
    __table__: Optional[sqlalchemy.Table] = None
    __metadata__: Optional[sqlalchemy.MetaData] = None

    # Schema version for auto-sync
    __schema_version__: int = 1

    # Initialization flag
    __is_initialized__: bool = False

    @classmethod
    @abstractmethod
    def define_table_structure(cls, metadata: sqlalchemy.MetaData) -> sqlalchemy.Table:
        """
        Define table structure using SQLAlchemy
        Must be implemented by each model

        Args:
            metadata: SQLAlchemy MetaData object

        Returns:
            SQLAlchemy Table object

        Example:
            return sqlalchemy.Table(
                cls.__full_table_name__,
                metadata,
                sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True, autoincrement=True),
                sqlalchemy.Column('name', sqlalchemy.String(100), nullable=False),
                sqlalchemy.Column('created_at', sqlalchemy.DateTime, server_default=sqlalchemy.func.now())
            )
        """
        pass

    @classmethod
    def initialize(cls, engine, metadata: sqlalchemy.MetaData):
        """
        Initialize table (called by DatabaseManager during load_tables)

        Steps:
        1. Define table structure
        2. Check if table exists
        3. Auto-sync schema if needed (with backup)
        4. Create table if not exists

        Args:
            engine: SQLAlchemy engine
            metadata: SQLAlchemy MetaData object
        """
        if cls.__is_initialized__:
            ColorPrint.blue(f"[BaseModel] Table already initialized: {cls.__full_table_name__}")
            return

        try:
            cls.__metadata__ = metadata
            cls.__table__ = cls.define_table_structure(metadata)

            # Create table if not exists (checkfirst=True)
            cls.__table__.create(engine, checkfirst=True)

            cls.__is_initialized__ = True
            ColorPrint.green(f"[BaseModel] Table initialized: {cls.__full_table_name__} (version: {cls.__schema_version__})")

        except Exception as e:
            ColorPrint.red(f"[BaseModel] Failed to initialize table {cls.__full_table_name__}: {e}")
            raise

    @classmethod
    def get_table_key(cls) -> str:
        """Get table key (namespace.table_name)"""
        return cls.__table_key__

    @classmethod
    def get_namespace(cls) -> str:
        """Get namespace"""
        return cls.__namespace__

    @classmethod
    def get_table_name(cls) -> str:
        """Get table name (without namespace)"""
        return cls.__table_name__

    @classmethod
    def get_full_table_name(cls) -> str:
        """Get full table name (used in database)"""
        return cls.__full_table_name__

    @classmethod
    def is_initialized(cls) -> bool:
        """Check if table is initialized"""
        return cls.__is_initialized__

    # ===== Core CRUD Operations =====

    @classmethod
    def insert(cls, conn, data: Dict[str, Any]) -> Any:
        """
        Insert one row, return primary key value

        Args:
            conn: Database connection
            data: Dictionary of column:value pairs

        Returns:
            Primary key value of inserted row
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        # Type conversion: Python objects → Database-compatible types
        converted_data = DatabaseTypeConverter.prepare_data_for_db(data)

        result = conn.execute(cls.__table__.insert().values(**converted_data))
        conn.commit()
        return result.inserted_primary_key[0]

    @classmethod
    def insert_many(cls, conn, data_list: List[Dict[str, Any]]) -> int:
        """
        Insert multiple rows, return count

        Args:
            conn: Database connection
            data_list: List of dictionaries

        Returns:
            Number of rows inserted
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        if not data_list:
            return 0

        # Type conversion: Convert all rows in batch
        converted_list = [DatabaseTypeConverter.prepare_data_for_db(data) for data in data_list]

        result = conn.execute(cls.__table__.insert(), converted_list)
        conn.commit()
        return result.rowcount

    @classmethod
    def select(
        cls,
        conn,
        where: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order_by: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Select rows with conditions

        Args:
            conn: Database connection
            where: Dictionary of column:value conditions
            columns: List of column names to select (None = all columns)
            limit: Maximum number of rows to return
            offset: Number of rows to skip
            order_by: List of column names with optional DESC (e.g., ['created_at DESC'])

        Returns:
            List of dictionaries (rows)
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        # Build query
        if columns:
            query = cls.__table__.select().with_only_columns(
                *[getattr(cls.__table__.c, col) for col in columns]
            )
        else:
            query = cls.__table__.select()

        # Add where conditions
        if where:
            for key, value in where.items():
                query = query.where(getattr(cls.__table__.c, key) == value)

        # Add order by
        if order_by:
            for order in order_by:
                if ' DESC' in order.upper():
                    col_name = order.split()[0]
                    query = query.order_by(getattr(cls.__table__.c, col_name).desc())
                else:
                    query = query.order_by(getattr(cls.__table__.c, order))

        # Add limit and offset
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)

        # Execute and return results
        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

    @classmethod
    def update(cls, conn, data: Dict[str, Any], where: Dict[str, Any]) -> int:
        """
        Update rows, return affected count

        Args:
            conn: Database connection
            data: Dictionary of column:value pairs to update
            where: Dictionary of column:value conditions

        Returns:
            Number of rows affected
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        # Type conversion: Python objects → Database-compatible types
        converted_data = DatabaseTypeConverter.prepare_data_for_db(data)
        converted_where = DatabaseTypeConverter.prepare_data_for_db(where)

        query = cls.__table__.update()

        # Add where conditions
        for key, value in converted_where.items():
            query = query.where(getattr(cls.__table__.c, key) == value)

        query = query.values(**converted_data)
        result = conn.execute(query)
        conn.commit()
        return result.rowcount

    @classmethod
    def delete(cls, conn, where: Dict[str, Any]) -> int:
        """
        Delete rows, return affected count

        Args:
            conn: Database connection
            where: Dictionary of column:value conditions

        Returns:
            Number of rows deleted
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        query = cls.__table__.delete()

        # Add where conditions
        for key, value in where.items():
            query = query.where(getattr(cls.__table__.c, key) == value)

        result = conn.execute(query)
        conn.commit()
        return result.rowcount

    @classmethod
    def count(cls, conn, where: Optional[Dict[str, Any]] = None) -> int:
        """
        Count rows

        Args:
            conn: Database connection
            where: Optional dictionary of column:value conditions

        Returns:
            Number of rows matching conditions
        """
        if not cls.__is_initialized__:
            raise RuntimeError(f"Table {cls.__table_key__} not initialized. Call load_tables() first.")

        query = sqlalchemy.select(sqlalchemy.func.count()).select_from(cls.__table__)

        if where:
            for key, value in where.items():
                query = query.where(getattr(cls.__table__.c, key) == value)

        result = conn.execute(query)
        return result.scalar()

    @classmethod
    def exists(cls, conn, where: Dict[str, Any]) -> bool:
        """
        Check if row exists

        Args:
            conn: Database connection
            where: Dictionary of column:value conditions

        Returns:
            True if row exists, False otherwise
        """
        return cls.count(conn, where) > 0

    @classmethod
    def select_one(cls, conn, where: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Select one row (shorthand for select with limit=1)

        Args:
            conn: Database connection
            where: Dictionary of column:value conditions

        Returns:
            Dictionary (row) or None if not found
        """
        results = cls.select(conn, where=where, limit=1)
        return results[0] if results else None
