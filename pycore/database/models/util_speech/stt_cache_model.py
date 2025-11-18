#!/usr/bin/env python3
"""
SpeechSTTCacheModel - Speech STT cache lookup table.
"""

import hashlib
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces
from pycore.database.models.util_speech.base_cache_model import SpeechCacheBaseModel


class SpeechSTTCacheModel(SpeechCacheBaseModel):
    """
    Speech STT Cache Model

    Stores cached transcriptions so repeated audio files can be resolved
    without reprocessing.

    Schema additions (beyond the base fields):
        - audio_md5: Hash of the audio content
        - recognized_text: Transcription output
        - confidence: Optional confidence score
    """

    __table_key__ = TableKeys.SPEECH_STT_CACHE
    __namespace__ = TableNamespaces.UTIL_SPEECH
    __table_name__ = "stt_cache"
    __full_table_name__ = "util_speech_stt_cache"
    __schema_version__ = 1

    KEY_FIELD = "audio_md5"
    OUTPUT_FIELD = "recognized_text"

    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),

            # Cache identification
            sqlalchemy.Column("audio_md5", sqlalchemy.String(32), nullable=False, index=True),
            sqlalchemy.Column("language", sqlalchemy.String(20), nullable=False, index=True),
            sqlalchemy.Column("provider", sqlalchemy.String(20), nullable=False, index=True),

            # Output
            sqlalchemy.Column("recognized_text", sqlalchemy.Text, nullable=False),
            sqlalchemy.Column("confidence", sqlalchemy.Float, nullable=True),

            # File information
            sqlalchemy.Column("file_path", sqlalchemy.String(500), nullable=False),
            sqlalchemy.Column("file_size", sqlalchemy.Integer, nullable=True),
            sqlalchemy.Column("file_exists", sqlalchemy.Boolean, default=True, nullable=False),

            # Metadata (using String to avoid JSON serialization issues)
            sqlalchemy.Column("created_at", sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column("last_accessed_at", sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column("access_count", sqlalchemy.Integer, default=0, nullable=False),

            sqlalchemy.UniqueConstraint("audio_md5", "language", "provider", name="uq_stt_cache_lookup"),
            sqlalchemy.Index("idx_stt_md5_lang", "audio_md5", "language"),
        )

    @staticmethod
    def calculate_audio_md5(audio_bytes: bytes) -> str:
        """Calculate MD5 hash of raw audio bytes."""
        return hashlib.md5(audio_bytes).hexdigest()

    @classmethod
    def query_cache(
        cls,
        conn,
        audio_md5: str,
        language: str,
        provider: str,
        verify_file: bool = True,
    ) -> Optional[Dict[str, Any]]:
        return super().query_cache(conn, audio_md5, language, provider, verify_file)

    @classmethod
    def add_cache_entry(
        cls,
        conn,
        audio_md5: str,
        language: str,
        provider: str,
        file_path: str,
        recognized_text: str,
        confidence: Optional[float] = None,
    ) -> int:
        extra_fields = {
            cls.OUTPUT_FIELD: recognized_text,
            "confidence": confidence,
        }
        return super().add_cache_entry(
            conn,
            key_value=audio_md5,
            language=language,
            provider=provider,
            file_path=file_path,
            extra_fields=extra_fields,
        )
