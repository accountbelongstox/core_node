#!/usr/bin/env python3
"""
SpeechTTSCacheModel - Speech TTS cache lookup table.
"""

import hashlib
from datetime import datetime
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces
from pycore.database.models.util_speech.base_cache_model import SpeechCacheBaseModel


class SpeechTTSCacheModel(SpeechCacheBaseModel):
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

    KEY_FIELD = "text_md5"
    INPUT_FIELD = "text"

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

            # Metadata (using String to avoid JSON serialization issues)
            sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column('last_accessed_at', sqlalchemy.String(32), nullable=False),
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
        verify_file: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Backward-compatible wrapper for SpeechCacheBaseModel."""
        return super().query_cache(conn, text_md5, language, provider, verify_file)

    @classmethod
    def add_cache_entry(
        cls,
        conn,
        text_md5: str,
        text: str,
        language: str,
        provider: str,
        file_path: str,
    ) -> int:
        """Insert or update cache entries while storing original text."""
        extra_fields = {cls.INPUT_FIELD: text}
        return super().add_cache_entry(
            conn,
            key_value=text_md5,
            language=language,
            provider=provider,
            file_path=file_path,
            extra_fields=extra_fields,
        )
