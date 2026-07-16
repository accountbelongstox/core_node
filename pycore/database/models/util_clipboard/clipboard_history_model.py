#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard History Database Model

Table: util_clipboard.history
Stores clipboard history with file support.
"""

import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List
from pycore.pyfoundations.third_party import get_third_package_sqlalchemy
from pycore.database.base_model import BaseModel
from pycore.database.models import TableNamespaces, TableKeys

import time


sqlalchemy = get_third_package_sqlalchemy()


class ClipboardHistoryModel(BaseModel):
    """
    Clipboard history model with file support

    Table: util_clipboard_history

    Schema:
        id: INTEGER PRIMARY KEY AUTOINCREMENT
        content: TEXT - Clipboard content (text or file path)
        content_type: VARCHAR(20) - Type: text, file, image
        content_hash: VARCHAR(32) - MD5 hash for deduplication
        file_path: VARCHAR(500) - Path to uploaded file (if applicable)
        file_size: INTEGER - File size in bytes
        client_id: VARCHAR(100) - Client identifier
        timestamp: REAL - Unix timestamp
        created_at: DATETIME - Human-readable timestamp
    """

    __table_key__ = TableKeys.CLIPBOARD_HISTORY
    __namespace__ = TableNamespaces.UTIL_CLIPBOARD
    __table_name__ = "history"
    __full_table_name__ = "util_clipboard_history"
    __schema_version__ = 1

    @classmethod
    def define_table_structure(cls, metadata):
        """
        Define table structure using SQLAlchemy

        Args:
            metadata: SQLAlchemy metadata

        Returns:
            SQLAlchemy Table object
        """
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True, autoincrement=True),
            sqlalchemy.Column('content', sqlalchemy.Text, nullable=False),
            sqlalchemy.Column('content_type', sqlalchemy.String(20), default='text', nullable=False),
            sqlalchemy.Column('content_hash', sqlalchemy.String(32), nullable=True, index=True),
            sqlalchemy.Column('file_path', sqlalchemy.String(500), nullable=True),
            sqlalchemy.Column('file_name', sqlalchemy.String(255), nullable=True),
            sqlalchemy.Column('file_size', sqlalchemy.Integer, nullable=True),
            sqlalchemy.Column('client_id', sqlalchemy.String(100), nullable=False, index=True),
            sqlalchemy.Column('timestamp', sqlalchemy.Float, nullable=False, index=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False),

            # Indexes
            sqlalchemy.Index('idx_clipboard_timestamp', 'timestamp'),
            sqlalchemy.Index('idx_clipboard_client', 'client_id'),
            sqlalchemy.Index('idx_clipboard_hash', 'content_hash'),
        )

    @classmethod
    def calculate_content_hash(cls, content: str) -> str:
        """Calculate MD5 hash of content"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    @classmethod
    def add_clipboard_item(
        cls,
        conn,
        content: str,
        client_id: str,
        content_type: str = "text",
        file_path: Optional[str] = None,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None
    ) -> Optional[int]:
        """
        Add clipboard item to history

        Args:
            conn: Database connection
            content: Clipboard content
            client_id: Client identifier
            content_type: Content type (text, file, image)
            file_path: Path to file (if applicable)
            file_name: Original file name
            file_size: File size in bytes

        Returns:
            Item ID or None if duplicate
        """

        # Calculate hash
        content_hash = cls.calculate_content_hash(content)

        # Check for recent duplicates (within last 10 items from same client)
        recent_items = cls.select(
            conn,
            where={'client_id': client_id},
            order_by=['id DESC'],
            limit=10
        )

        for item in recent_items:
            if item.get('content_hash') == content_hash:
                return None  # Duplicate, skip

        # Insert new item
        item_id = cls.insert(
            conn,
            {
                'content': content,
                'content_type': content_type,
                'content_hash': content_hash,
                'file_path': file_path,
                'file_name': file_name,
                'file_size': file_size,
                'client_id': client_id,
                'timestamp': time.time()
            }
        )

        return item_id

    @classmethod
    def get_recent_items(
        cls,
        conn,
        limit: int = 50,
        client_id: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent clipboard items

        Args:
            conn: Database connection
            limit: Maximum items to return
            client_id: Filter by client ID
            content_type: Filter by content type

        Returns:
            List of clipboard items (newest first)
        """
        where = {}
        if client_id:
            where['client_id'] = client_id
        if content_type:
            where['content_type'] = content_type

        items = cls.select(
            conn,
            where=where if where else None,
            order_by=['timestamp DESC'],
            limit=limit
        )

        return items

    @classmethod
    def get_items_since(
        cls,
        conn,
        timestamp: float,
        client_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get clipboard items since timestamp

        Args:
            conn: Database connection
            timestamp: Unix timestamp
            client_id: Filter by client ID

        Returns:
            List of items since timestamp
        """
        query = f"""
            SELECT * FROM {cls.get_full_table_name()}
            WHERE timestamp > :timestamp
        """
        params = {'timestamp': timestamp}

        if client_id:
            query += " AND client_id = :client_id"
            params['client_id'] = client_id

        query += " ORDER BY timestamp DESC"

        result = conn.execute(sqlalchemy.text(query), params)
        return [dict(row._mapping) for row in result]

    @classmethod
    def search_items(
        cls,
        conn,
        query: str,
        limit: int = 20,
        client_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search clipboard history

        Args:
            conn: Database connection
            query: Search query
            limit: Maximum results
            client_id: Filter by client ID

        Returns:
            List of matching items
        """
        sql = f"""
            SELECT * FROM {cls.get_full_table_name()}
            WHERE content LIKE :search_query
        """
        params = {'search_query': f"%{query}%"}

        if client_id:
            sql += " AND client_id = :client_id"
            params['client_id'] = client_id

        sql += " ORDER BY timestamp DESC LIMIT :limit"
        params['limit'] = limit

        result = conn.execute(sqlalchemy.text(sql), params)
        return [dict(row._mapping) for row in result]

    @classmethod
    def delete_old_items(cls, conn, days: int = 30) -> int:
        """
        Delete items older than specified days

        Args:
            conn: Database connection
            days: Age threshold in days

        Returns:
            Number of deleted items
        """
        threshold = time.time() - (days * 24 * 60 * 60)

        # Custom delete query for < condition
        query = cls.__table__.delete().where(cls.__table__.c.timestamp < threshold)
        result = conn.execute(query)
        conn.commit()

        return result.rowcount

    @classmethod
    def get_statistics(cls, conn) -> Dict[str, Any]:
        """Get clipboard history statistics"""
        table_name = cls.get_full_table_name()

        # Total items
        cursor = conn.execute(sqlalchemy.text(f"SELECT COUNT(*) FROM {table_name}"))
        total = cursor.fetchone()[0]

        if total == 0:
            return {
                'total_items': 0,
                'by_type': {},
                'by_client': {},
                'total_file_size': 0
            }

        # By content type
        cursor = conn.execute(sqlalchemy.text(f"""
            SELECT content_type, COUNT(*) as count
            FROM {table_name}
            GROUP BY content_type
        """))
        by_type = {row[0]: row[1] for row in cursor.fetchall()}

        # By client
        cursor = conn.execute(sqlalchemy.text(f"""
            SELECT client_id, COUNT(*) as count
            FROM {table_name}
            GROUP BY client_id
        """))
        by_client = {row[0]: row[1] for row in cursor.fetchall()}

        # Total file size
        cursor = conn.execute(sqlalchemy.text(f"""
            SELECT SUM(file_size)
            FROM {table_name}
            WHERE file_size IS NOT NULL
        """))
        total_file_size = cursor.fetchone()[0] or 0

        return {
            'total_items': total,
            'by_type': by_type,
            'by_client': by_client,
            'total_file_size': total_file_size,
            'total_file_size_mb': total_file_size / (1024 * 1024)
        }
