#!/usr/bin/env python3
"""
UtilCacheModel - Cache utility table
Shared cache storage for all apps and utilities
"""

from typing import Optional, Dict, Any
from datetime import datetime

from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class UtilCacheModel(BaseModel):
    """
    Cache utility table

    Provides simple key-value cache storage with expiration

    Schema:
        - id: Integer primary key (auto-increment)
        - key: String (unique) - Cache key
        - value: String - Cached value (JSON string for complex data)
        - expires_at: DateTime (optional) - Expiration timestamp
        - created_at: DateTime - Creation timestamp
        - updated_at: DateTime - Last update timestamp
    """

    __table_key__ = TableKeys.CACHE_ITEMS
    __namespace__ = "util_cache"
    __table_name__ = "items"
    __full_table_name__ = "util_cache_items"
    __schema_version__ = 1

    @classmethod
    def define_table_structure(cls, metadata):
        """
        Define table structure

        Args:
            metadata: SQLAlchemy metadata

        Returns:
            SQLAlchemy Table object
        """
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True, autoincrement=True),
            sqlalchemy.Column('key', sqlalchemy.String(255), unique=True, nullable=False, index=True),
            sqlalchemy.Column('value', sqlalchemy.Text, nullable=False),
            sqlalchemy.Column('expires_at', sqlalchemy.String(50), nullable=True, index=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.String(50), nullable=False),
        )

    # ===== Custom Methods (Differentiated Functionality) =====

    @classmethod
    def get_cache(cls, conn, key: str) -> Optional[str]:
        """
        Get cached value by key (returns None if expired or not found)

        Args:
            conn: Database connection
            key: Cache key

        Returns:
            Cached value or None if not found or expired
        """
        result = cls.select(conn, where={"key": key}, limit=1)

        if not result:
            return None

        cache_item = result[0]

        # Check expiration
        if cache_item["expires_at"] is not None:
            if datetime.utcnow() > cache_item["expires_at"]:
                # Expired, delete and return None
                cls.delete(conn, where={"key": key})
                return None

        return cache_item["value"]

    @classmethod
    def set_cache(cls, conn, key: str, value: str, ttl_seconds: Optional[int] = None):
        """
        Set cache value (insert or update)

        Args:
            conn: Database connection
            key: Cache key
            value: Value to cache
            ttl_seconds: Time to live in seconds (None for no expiration)
        """
        expires_at = None
        if ttl_seconds is not None:
            expires_at = datetime.utcnow() + __import__('datetime').timedelta(seconds=ttl_seconds)

        existing = cls.select(conn, where={"key": key}, limit=1)

        if existing:
            # Update existing
            update_data = {
                "value": value,
                "expires_at": expires_at,
                "updated_at": datetime.utcnow()
            }
            cls.update(conn, update_data, where={"key": key})
        else:
            # Insert new
            insert_data = {
                "key": key,
                "value": value,
                "expires_at": expires_at,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            cls.insert(conn, insert_data)

    @classmethod
    def delete_cache(cls, conn, key: str) -> int:
        """
        Delete cache by key

        Args:
            conn: Database connection
            key: Cache key

        Returns:
            Number of rows deleted
        """
        return cls.delete(conn, where={"key": key})

    @classmethod
    def clear_expired(cls, conn) -> int:
        """
        Clear all expired cache entries

        Args:
            conn: Database connection

        Returns:
            Number of deleted rows
        """
        # Use raw SQL for date comparison
        delete_stmt = cls.__table__.delete().where(
            sqlalchemy.and_(
                cls.__table__.c.expires_at.isnot(None),
                cls.__table__.c.expires_at < datetime.utcnow()
            )
        )

        result = conn.execute(delete_stmt)
        return result.rowcount

    @classmethod
    def clear_all(cls, conn) -> int:
        """
        Clear all cache entries

        Args:
            conn: Database connection

        Returns:
            Number of deleted rows
        """
        delete_stmt = cls.__table__.delete()
        result = conn.execute(delete_stmt)
        return result.rowcount

    @classmethod
    def key_exists(cls, conn, key: str) -> bool:
        """
        Check if cache key exists and is not expired

        Args:
            conn: Database connection
            key: Cache key

        Returns:
            True if key exists and not expired, False otherwise
        """
        value = cls.get_cache(conn, key)
        return value is not None

    @classmethod
    def get_cache_info(cls, conn, key: str) -> Optional[Dict[str, Any]]:
        """
        Get full cache item information (including metadata)

        Args:
            conn: Database connection
            key: Cache key

        Returns:
            Cache item record or None if not found
        """
        result = cls.select(conn, where={"key": key}, limit=1)
        return result[0] if result else None
