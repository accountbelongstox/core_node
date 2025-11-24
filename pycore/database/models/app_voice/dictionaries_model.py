#!/usr/bin/env python3
"""
VoiceDictionariesModel - Vocabulary dictionary storage
Stores word/phrase entries with translations, phonetics, and voice files
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class VoiceDictionariesModel(BaseModel):
    """
    Voice dictionaries table

    Stores vocabulary entries with translations, phonetics, voice files, and metadata

    Schema:
        - id: Integer primary key (auto-increment)
        - content: Text (unique) - Word or phrase content
        - md5: Text - MD5 hash of content
        - translation: JSON - Translation data
        - is_translation: Boolean - Has translation
        - translation_provider: Integer - Translation provider ID
        - last_modified: DateTime - Last modification time
        - last_insert_time: DateTime - Initial insert time
        - last_update_time: DateTime - Last update time
        - last_query_time: DateTime - Last query time
        - query_count: Integer - Number of queries
        - us_phonetic: Text - US phonetic notation
        - uk_phonetic: Text - UK phonetic notation
        - voice_files: JSON - Voice file paths
        - image_files: JSON - Image file paths
        - is_exist_local: Boolean - Local file existence flag
        - voice_files_provider: Integer - Voice provider ID
        - image_files_provider: Integer - Image provider ID
        - has_operations: Boolean - Has pending operations
        - is_valid: Boolean - Word validity status
        - valid_provider: String - Validity check provider
        - created_at: DateTime - Creation timestamp
    """

    __table_key__ = TableKeys.VOICE_DICTIONARIES
    __namespace__ = "app_voice"
    __table_name__ = "dictionaries"
    __full_table_name__ = "app_voice_dictionaries"
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
            sqlalchemy.Column('content', sqlalchemy.Text, nullable=False, unique=True, index=True),
            sqlalchemy.Column('md5', sqlalchemy.Text, nullable=False, index=True),
            sqlalchemy.Column('translation', sqlalchemy.JSON, nullable=True),
            sqlalchemy.Column('is_translation', sqlalchemy.Boolean, default=False, nullable=True),
            sqlalchemy.Column('translation_provider', sqlalchemy.Integer, default=0, nullable=True),
            sqlalchemy.Column('last_modified', sqlalchemy.String(50), nullable=True),
            sqlalchemy.Column('last_insert_time', sqlalchemy.String(50), nullable=True),
            sqlalchemy.Column('last_update_time', sqlalchemy.String(50), nullable=True),
            sqlalchemy.Column('last_query_time', sqlalchemy.String(50), nullable=True),
            sqlalchemy.Column('query_count', sqlalchemy.Integer, default=0, nullable=True),
            sqlalchemy.Column('us_phonetic', sqlalchemy.Text, nullable=True),
            sqlalchemy.Column('uk_phonetic', sqlalchemy.Text, nullable=True),
            sqlalchemy.Column('voice_files', sqlalchemy.JSON, nullable=True),
            sqlalchemy.Column('image_files', sqlalchemy.JSON, nullable=True),
            sqlalchemy.Column('is_exist_local', sqlalchemy.Boolean, default=False, nullable=True),
            sqlalchemy.Column('voice_files_provider', sqlalchemy.Integer, default=0, nullable=True),
            sqlalchemy.Column('image_files_provider', sqlalchemy.Integer, default=0, nullable=True),
            sqlalchemy.Column('has_operations', sqlalchemy.Boolean, default=True, nullable=True),
            sqlalchemy.Column('is_valid', sqlalchemy.Boolean, nullable=True),
            sqlalchemy.Column('valid_provider', sqlalchemy.String(50), nullable=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
        )

    @classmethod
    def get_by_content(cls, conn, content: str) -> Optional[Dict]:
        """
        Get dictionary entry by content

        Args:
            conn: Database connection
            content: Word or phrase content

        Returns:
            Dictionary entry or None if not found
        """
        result = cls.select(conn, where={"content": content}, limit=1)
        return result[0] if result else None

    @classmethod
    def get_untranslated(cls, conn, limit: int = 100) -> List[Dict]:
        """
        Get entries without translation

        Args:
            conn: Database connection
            limit: Maximum number of results

        Returns:
            List of dictionary entries
        """
        return cls.select(
            conn,
            where={"is_translation": False},
            limit=limit,
            order_by="last_insert_time ASC"
        )

    @classmethod
    def get_without_voice(cls, conn, limit: int = 100) -> List[Dict]:
        """
        Get entries without voice files

        Args:
            conn: Database connection
            limit: Maximum number of results

        Returns:
            List of dictionary entries
        """
        return cls.select(
            conn,
            where={"is_exist_local": False},
            limit=limit,
            order_by="last_insert_time ASC"
        )

    @classmethod
    def get_unvalidated(cls, conn, limit: int = 100) -> List[Dict]:
        """
        Get entries without validity check

        Args:
            conn: Database connection
            limit: Maximum number of results

        Returns:
            List of dictionary entries
        """
        return cls.select(
            conn,
            where={"is_valid": None},
            limit=limit,
            order_by="last_insert_time ASC"
        )

    @classmethod
    def update_translation(cls, conn, content: str, translation: Dict, provider: int = 0):
        """
        Update translation for entry

        Args:
            conn: Database connection
            content: Word or phrase content
            translation: Translation data
            provider: Translation provider ID
        """
        update_data = {
            "translation": translation,
            "is_translation": True,
            "translation_provider": provider,
            "last_update_time": datetime.utcnow(),
            "last_modified": datetime.utcnow()
        }
        cls.update(conn, update_data, where={"content": content})

    @classmethod
    def update_voice_files(cls, conn, content: str, voice_files: Dict, provider: int = 0):
        """
        Update voice files for entry

        Args:
            conn: Database connection
            content: Word or phrase content
            voice_files: Voice file paths
            provider: Voice provider ID
        """
        update_data = {
            "voice_files": voice_files,
            "is_exist_local": True,
            "voice_files_provider": provider,
            "last_update_time": datetime.utcnow(),
            "last_modified": datetime.utcnow()
        }
        cls.update(conn, update_data, where={"content": content})

    @classmethod
    def update_validity(cls, conn, content: str, is_valid: bool, provider: str = "openai"):
        """
        Update validity status for entry

        Args:
            conn: Database connection
            content: Word or phrase content
            is_valid: Validity status
            provider: Validation provider name
        """
        update_data = {
            "is_valid": is_valid,
            "valid_provider": provider,
            "last_update_time": datetime.utcnow(),
            "last_modified": datetime.utcnow()
        }
        cls.update(conn, update_data, where={"content": content})

    @classmethod
    def increment_query_count(cls, conn, content: str):
        """
        Increment query count for entry

        Args:
            conn: Database connection
            content: Word or phrase content
        """
        entry = cls.get_by_content(conn, content)
        if entry:
            new_count = entry.get("query_count", 0) + 1
            update_data = {
                "query_count": new_count,
                "last_query_time": datetime.utcnow()
            }
            cls.update(conn, update_data, where={"content": content})

    @classmethod
    def get_all_contents(cls, conn) -> List[str]:
        """
        Get all content values

        Args:
            conn: Database connection

        Returns:
            List of content strings
        """
        results = cls.select(conn, columns=["content"])
        return [row["content"] for row in results]

    @classmethod
    def batch_insert_contents(cls, conn, contents: List[str]):
        """
        Batch insert content entries

        Args:
            conn: Database connection
            contents: List of content strings
        """
        import hashlib

        insert_data = []
        for content in contents:
            md5_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
            insert_data.append({
                "content": content,
                "md5": md5_hash,
                "created_at": datetime.utcnow(),
                "last_insert_time": datetime.utcnow(),
                "last_modified": datetime.utcnow()
            })

        if insert_data:
            cls.batch_insert(conn, insert_data)
