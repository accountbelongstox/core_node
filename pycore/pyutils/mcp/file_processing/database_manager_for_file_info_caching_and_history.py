#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Manager for File Info Caching and History
Provides SQLite-based caching and history tracking for processed files
"""

import os
import json
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

from pycore.database.adapters.sqlite_local import Row, open_writable_db

from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider
from pycore.pygvar import PYTOOLS_TMP_DIR

logger = logging.getLogger(__name__)


class DatabaseManagerForFileInfoCachingAndHistory:
    """
    Database manager for caching file processing results and tracking history
    """

    def __init__(self, db_path: str = None):
        """
        Initialize database manager

        Args:
            db_path: Path to SQLite database file (default: uses PYTOOLS_TMP_DIR from pygvar)
        """
        if db_path is None:
            db_path = os.path.join(PYTOOLS_TMP_DIR, "mcp_file_info_cache.db")

        self.db_path = db_path
        self._initialize_database_schema()

    def _initialize_database_schema(self):
        """Initialize database schema if not exists"""
        with self._get_database_connection() as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS file_info_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    file_hash_sha256 TEXT NOT NULL UNIQUE,
                    file_size_bytes INTEGER,
                    file_type TEXT,
                    mime_type TEXT,
                    file_info_json TEXT NOT NULL,
                    created_timestamp_utc TEXT NOT NULL,
                    last_accessed_timestamp_utc TEXT NOT NULL,
                    access_count INTEGER DEFAULT 1,
                    processing_duration_seconds REAL
                )
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_file_path ON file_info_cache(file_path)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_file_hash ON file_info_cache(file_hash_sha256)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_file_type ON file_info_cache(file_type)
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS processing_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    file_hash_sha256 TEXT NOT NULL,
                    processing_timestamp_utc TEXT NOT NULL,
                    processing_duration_seconds REAL,
                    processing_methods TEXT,
                    processing_engine_versions TEXT,
                    error_occurred BOOLEAN DEFAULT 0,
                    error_message TEXT
                )
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_processing_timestamp ON processing_history(processing_timestamp_utc)
            ''')

            conn.commit()

    @contextmanager
    def _get_database_connection(self):
        """Context manager for database connections"""
        with open_writable_db(self.db_path, row_factory=Row) as conn:
            yield conn

    async def save_file_info_to_database_with_caching_and_version_tracking(
        self,
        file_path: str,
        file_info: Dict[str, Any]
    ) -> bool:
        """
        Save file info to database with caching and version tracking

        Args:
            file_path: Path to file
            file_info: File information dictionary

        Returns:
            True if saved successfully
        """
        file_hash = await self._calculate_file_hash_sha256(file_path)
        file_size = os.path.getsize(file_path)
        file_info_json = json.dumps(file_info, ensure_ascii=False)
        timestamp_utc = datetime.utcnow().isoformat()

        with self._get_database_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                'SELECT id FROM file_info_cache WHERE file_hash_sha256 = ?',
                (file_hash,)
            )
            existing = cursor.fetchone()

            if existing:
                cursor.execute('''
                    UPDATE file_info_cache
                    SET file_path = ?,
                        file_info_json = ?,
                        last_accessed_timestamp_utc = ?,
                        access_count = access_count + 1
                    WHERE file_hash_sha256 = ?
                ''', (file_path, file_info_json, timestamp_utc, file_hash))
            else:
                cursor.execute('''
                    INSERT INTO file_info_cache (
                        file_path, file_hash_sha256, file_size_bytes,
                        file_type, mime_type, file_info_json,
                        created_timestamp_utc, last_accessed_timestamp_utc,
                        processing_duration_seconds
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_path,
                    file_hash,
                    file_size,
                    file_info.get('file_type'),
                    file_info.get('mime_type'),
                    file_info_json,
                    timestamp_utc,
                    timestamp_utc,
                    file_info.get('processing_comprehensive_stats', {}).get('processing_duration_seconds')
                ))

            self._add_to_processing_history(cursor, file_path, file_hash, file_info)
            conn.commit()
            logger.info("Saved file info to database: %s", file_path)
            return True

    def _add_to_processing_history(
        self,
        cursor,
        file_path: str,
        file_hash: str,
        file_info: Dict[str, Any]
    ):
        """Add entry to processing history"""
        timestamp_utc = datetime.utcnow().isoformat()
        processing_stats = file_info.get('processing_comprehensive_stats', {})

        cursor.execute('''
            INSERT INTO processing_history (
                file_path, file_hash_sha256, processing_timestamp_utc,
                processing_duration_seconds, processing_methods,
                processing_engine_versions, error_occurred, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            file_path,
            file_hash,
            timestamp_utc,
            processing_stats.get('processing_duration_seconds'),
            json.dumps(processing_stats.get('processing_methods_applied', [])),
            json.dumps(processing_stats.get('processing_engine_versions', {})),
            len(processing_stats.get('errors_and_warnings', [])) > 0,
            json.dumps(processing_stats.get('errors_and_warnings', []))
        ))

    async def retrieve_cached_file_info_from_database_by_path_or_hash(
        self,
        file_path: str = None,
        file_hash: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached file info from database by path or hash

        Args:
            file_path: File path to search
            file_hash: File hash to search

        Returns:
            File info dictionary or None if not found
        """
        if file_path and os.path.exists(file_path):
            file_hash = await self._calculate_file_hash_sha256(file_path)

        if not file_hash:
            return None

        with self._get_database_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT file_info_json FROM file_info_cache WHERE file_hash_sha256 = ?',
                (file_hash,)
            )
            row = cursor.fetchone()

            if row:
                timestamp_utc = datetime.utcnow().isoformat()
                cursor.execute('''
                    UPDATE file_info_cache
                    SET last_accessed_timestamp_utc = ?,
                        access_count = access_count + 1
                    WHERE file_hash_sha256 = ?
                ''', (timestamp_utc, file_hash))
                conn.commit()

                file_info = json.loads(row['file_info_json'])
                logger.info("Retrieved cached file info for hash: %s", file_hash)
                return file_info

            return None

    async def query_file_processing_history_with_filters_and_pagination(
        self,
        file_type: str = None,
        date_from: str = None,
        date_to: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Query file processing history with filters and pagination

        Args:
            file_type: Filter by file type
            date_from: Filter by start date (ISO format)
            date_to: Filter by end date (ISO format)
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Dictionary with results and pagination info
        """
        with self._get_database_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM processing_history WHERE 1=1'
            params = []

            if date_from:
                query += ' AND processing_timestamp_utc >= ?'
                params.append(date_from)

            if date_to:
                query += ' AND processing_timestamp_utc <= ?'
                params.append(date_to)

            count_query = query.replace('SELECT *', 'SELECT COUNT(*)')
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]

            query += ' ORDER BY processing_timestamp_utc DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])

            cursor.execute(query, params)
            rows = cursor.fetchall()

            results = []
            for row in rows:
                results.append({
                    'id': row['id'],
                    'file_path': row['file_path'],
                    'file_hash_sha256': row['file_hash_sha256'],
                    'processing_timestamp_utc': row['processing_timestamp_utc'],
                    'processing_duration_seconds': row['processing_duration_seconds'],
                    'processing_methods': json.loads(row['processing_methods']) if row['processing_methods'] else [],
                    'error_occurred': bool(row['error_occurred']),
                    'error_message': json.loads(row['error_message']) if row['error_message'] else None
                })

            return {
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'results': results
            }

    async def _calculate_file_hash_sha256(self, file_path: str) -> str:
        """Calculate SHA256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()


_DATABASE_MANAGER_PROVIDER = SerializedSingletonProvider(
    DatabaseManagerForFileInfoCachingAndHistory,
    "mcp.file_database.provider",
    "MCPFileDatabaseProviderThread",
    timeout=300.0,
)


def get_database_manager_singleton() -> DatabaseManagerForFileInfoCachingAndHistory:
    """Get singleton instance of database manager"""
    return _DATABASE_MANAGER_PROVIDER.get()
