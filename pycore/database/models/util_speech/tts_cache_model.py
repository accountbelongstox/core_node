#!/usr/bin/env python3
"""
SpeechTTSCacheModel - Speech TTS cache lookup table
Provides fast database lookup for TTS cache with file verification
"""

import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.pyfoundations.color_print import ColorPrint
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces


class SpeechTTSCacheModel(BaseModel):
    """
    Speech TTS Cache Model

    Database table for fast TTS cache lookup
    File is the source of truth - database is just an index

    Schema:
        - id: Integer primary key (auto-increment)
        - text_md5: String(32) - MD5 hash of text content
        - text: Text - Original text content
        - language: String(20) - Language code (e.g., zh-CN, en-US)
        - provider: String(20) - TTS provider (e.g., edge, azure)
        - file_path: String(500) - Absolute path to cached audio file
        - file_size: Integer - File size in bytes
        - file_exists: Boolean - Cached file existence flag
        - created_at: DateTime - Creation timestamp
        - last_accessed_at: DateTime - Last access timestamp
        - access_count: Integer - Number of times accessed

    Indexes:
        - Unique constraint on (text_md5, language, provider)
        - Index on text_md5
        - Index on language
        - Index on provider
        - Composite index on (text_md5, language)

    Design Principles:
        - File is source of truth
        - Database is lookup index only
        - Missing files trigger automatic record deletion
        - Graceful fallback if database unavailable
    """

    __table_key__ = TableKeys.SPEECH_TTS_CACHE
    __namespace__ = TableNamespaces.UTIL_SPEECH
    __table_name__ = "tts_cache"
    __full_table_name__ = "util_speech_tts_cache"
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

            # Cache identification
            sqlalchemy.Column('text_md5', sqlalchemy.String(32), nullable=False, index=True),
            sqlalchemy.Column('text', sqlalchemy.Text, nullable=False),
            sqlalchemy.Column('language', sqlalchemy.String(20), nullable=False, index=True),
            sqlalchemy.Column('provider', sqlalchemy.String(20), nullable=False, index=True),

            # File information
            sqlalchemy.Column('file_path', sqlalchemy.String(500), nullable=False),
            sqlalchemy.Column('file_size', sqlalchemy.Integer, nullable=True),
            sqlalchemy.Column('file_exists', sqlalchemy.Boolean, default=True, nullable=False),

            # Metadata
            sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
            sqlalchemy.Column('last_accessed_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
            sqlalchemy.Column('access_count', sqlalchemy.Integer, default=0, nullable=False),

            # Unique constraint on (text_md5, language, provider)
            sqlalchemy.UniqueConstraint('text_md5', 'language', 'provider', name='uq_tts_cache_lookup'),

            # Composite index for faster queries
            sqlalchemy.Index('idx_tts_md5_lang', 'text_md5', 'language'),
        )

    # ===== Custom Methods =====

    @staticmethod
    def calculate_text_md5(text: str) -> str:
        """
        Calculate MD5 hash of text

        Args:
            text: Text content

        Returns:
            MD5 hash string (32 characters)
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    @classmethod
    def query_cache(
        cls,
        conn,
        text_md5: str,
        language: str,
        provider: str,
        verify_file: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Query cache by MD5, language, and provider

        File-First Approach:
        1. Query database for record
        2. If verify_file=True, check if file actually exists
        3. If file missing, delete record and return None
        4. If file exists, update access metadata and return record

        Args:
            conn: Database connection
            text_md5: MD5 hash of text
            language: Language code
            provider: TTS provider
            verify_file: Whether to verify file exists (default True)

        Returns:
            Cache record dict if found and valid, None otherwise
        """
        # Query database
        results = cls.select(
            conn,
            where={
                'text_md5': text_md5,
                'language': language,
                'provider': provider
            },
            limit=1
        )

        if not results:
            return None

        record = results[0]

        # Verify file exists if requested
        if verify_file:
            file_path = Path(record['file_path'])

            if not file_path.exists():
                # File missing - delete record (file is source of truth)
                ColorPrint.yellow(f"[SpeechTTSCache] File missing, deleting record: {file_path}")
                cls.delete(conn, where={'id': record['id']})
                return None

            # Update file size if changed
            actual_size = file_path.stat().st_size
            if record['file_size'] != actual_size:
                record['file_size'] = actual_size

        # Update access metadata
        update_data = {
            'last_accessed_at': datetime.utcnow(),
            'access_count': record['access_count'] + 1,
            'file_exists': True
        }

        if verify_file:
            update_data['file_size'] = record['file_size']

        cls.update(conn, update_data, where={'id': record['id']})

        # Update record with new values
        record['last_accessed_at'] = update_data['last_accessed_at']
        record['access_count'] = update_data['access_count']

        return record

    @classmethod
    def add_cache_entry(
        cls,
        conn,
        text_md5: str,
        text: str,
        language: str,
        provider: str,
        file_path: str
    ) -> int:
        """
        Add new cache entry or update existing

        Args:
            conn: Database connection
            text_md5: MD5 hash of text
            text: Original text content
            language: Language code
            provider: TTS provider
            file_path: Absolute path to cached audio file

        Returns:
            Record ID (newly inserted or existing)
        """
        # Check if file exists
        path = Path(file_path)
        file_exists = path.exists()
        file_size = path.stat().st_size if file_exists else None

        # Check if entry already exists
        existing = cls.select(
            conn,
            where={
                'text_md5': text_md5,
                'language': language,
                'provider': provider
            },
            limit=1
        )

        if existing:
            # Update existing entry
            record_id = existing[0]['id']
            update_data = {
                'text': text,
                'file_path': file_path,
                'file_size': file_size,
                'file_exists': file_exists,
                'last_accessed_at': datetime.utcnow()
            }
            cls.update(conn, update_data, where={'id': record_id})
            ColorPrint.blue(f"[SpeechTTSCache] Updated cache entry: {text_md5[:8]}...")
            return record_id
        else:
            # Insert new entry
            insert_data = {
                'text_md5': text_md5,
                'text': text,
                'language': language,
                'provider': provider,
                'file_path': file_path,
                'file_size': file_size,
                'file_exists': file_exists,
                'created_at': datetime.utcnow(),
                'last_accessed_at': datetime.utcnow(),
                'access_count': 0
            }
            record_id = cls.insert(conn, insert_data)
            ColorPrint.green(f"[SpeechTTSCache] Added cache entry: {text_md5[:8]}...")
            return record_id

    @classmethod
    def verify_all_files(cls, conn) -> Dict[str, int]:
        """
        Verify all cached files exist

        Scans all records and checks if files exist
        Deletes orphaned records where files are missing

        Args:
            conn: Database connection

        Returns:
            Statistics dict with:
                - total: Total records checked
                - exists: Files that exist
                - missing: Files missing (deleted from DB)
        """
        # Get all records
        all_records = cls.select(conn)

        stats = {
            'total': len(all_records),
            'exists': 0,
            'missing': 0
        }

        for record in all_records:
            file_path = Path(record['file_path'])

            if file_path.exists():
                stats['exists'] += 1

                # Update file_exists flag and size
                actual_size = file_path.stat().st_size
                update_data = {
                    'file_exists': True,
                    'file_size': actual_size
                }
                cls.update(conn, update_data, where={'id': record['id']})

            else:
                stats['missing'] += 1

                # File missing - delete record
                ColorPrint.yellow(f"[SpeechTTSCache] Deleting orphaned record: {file_path}")
                cls.delete(conn, where={'id': record['id']})

        ColorPrint.blue(f"[SpeechTTSCache] File verification complete:")
        ColorPrint.blue(f"  Total: {stats['total']}")
        ColorPrint.green(f"  Exists: {stats['exists']}")
        ColorPrint.yellow(f"  Missing (deleted): {stats['missing']}")

        return stats

    @classmethod
    def get_cache_statistics(cls, conn) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Statistics dict with:
                - total_entries: Total cache entries
                - by_language: Count by language
                - by_provider: Count by provider
                - avg_access_count: Average access count
                - total_cache_size: Total file size in bytes
        """
        all_records = cls.select(conn)

        if not all_records:
            return {
                'total_entries': 0,
                'by_language': {},
                'by_provider': {},
                'avg_access_count': 0.0,
                'total_cache_size_bytes': 0,
                'total_cache_size_mb': 0.0
            }

        # Count by language
        by_language = {}
        for record in all_records:
            lang = record['language']
            by_language[lang] = by_language.get(lang, 0) + 1

        # Count by provider
        by_provider = {}
        for record in all_records:
            prov = record['provider']
            by_provider[prov] = by_provider.get(prov, 0) + 1

        # Calculate averages
        total_access = sum(r['access_count'] for r in all_records)
        avg_access = total_access / len(all_records) if all_records else 0.0

        # Calculate total size
        total_size = sum(r['file_size'] or 0 for r in all_records)

        return {
            'total_entries': len(all_records),
            'by_language': by_language,
            'by_provider': by_provider,
            'avg_access_count': avg_access,
            'total_cache_size_bytes': total_size,
            'total_cache_size_mb': total_size / (1024 * 1024)
        }

    @classmethod
    def delete_by_provider(cls, conn, provider: str) -> int:
        """
        Delete all cache entries for a specific provider

        Args:
            conn: Database connection
            provider: TTS provider name

        Returns:
            Number of deleted records
        """
        count = cls.count(conn, where={'provider': provider})
        if count > 0:
            cls.delete(conn, where={'provider': provider})
            ColorPrint.blue(f"[SpeechTTSCache] Deleted {count} entries for provider: {provider}")
        return count

    @classmethod
    def delete_by_language(cls, conn, language: str) -> int:
        """
        Delete all cache entries for a specific language

        Args:
            conn: Database connection
            language: Language code

        Returns:
            Number of deleted records
        """
        count = cls.count(conn, where={'language': language})
        if count > 0:
            cls.delete(conn, where={'language': language})
            ColorPrint.blue(f"[SpeechTTSCache] Deleted {count} entries for language: {language}")
        return count

    @classmethod
    def clear_all_cache(cls, conn) -> int:
        """
        Clear all cache entries

        Args:
            conn: Database connection

        Returns:
            Number of deleted records
        """
        count = cls.count(conn)
        if count > 0:
            delete_stmt = cls.__table__.delete()
            result = conn.execute(delete_stmt)
            ColorPrint.yellow(f"[SpeechTTSCache] Cleared all {count} cache entries")
            return result.rowcount
        return 0
