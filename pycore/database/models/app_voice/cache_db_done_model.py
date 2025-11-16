#!/usr/bin/env python3
"""
VoiceCacheDbDoneModel - Cache database import status tracking
Tracks which cache databases have been imported to prevent duplicate imports
"""

from typing import Optional, List
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class VoiceCacheDbDoneModel(BaseModel):
    """
    Cache database done tracking table

    Tracks which cache databases have been successfully imported

    Schema:
        - id: Integer primary key (auto-increment)
        - cache_db_name: Text - Name of cache database file
        - done: Boolean - Import completion status
        - created_at: DateTime - Creation timestamp
    """

    __table_key__ = TableKeys.VOICE_CACHE_DB_DONE
    __namespace__ = "app_voice"
    __table_name__ = "cache_db_done"
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
            sqlalchemy.Column('cache_db_name', sqlalchemy.Text, nullable=False, unique=True, index=True),
            sqlalchemy.Column('done', sqlalchemy.Boolean, default=False, nullable=False),
            sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
        )

    @classmethod
    def is_db_imported(cls, conn, db_name: str) -> bool:
        """
        Check if database has been imported

        Args:
            conn: Database connection
            db_name: Cache database name

        Returns:
            True if imported, False otherwise
        """
        result = cls.select(conn, where={"cache_db_name": db_name, "done": True}, limit=1)
        return len(result) > 0

    @classmethod
    def mark_db_done(cls, conn, db_name: str):
        """
        Mark database as imported

        Args:
            conn: Database connection
            db_name: Cache database name
        """
        existing = cls.select(conn, where={"cache_db_name": db_name}, limit=1)

        if existing:
            cls.update(conn, {"done": True}, where={"cache_db_name": db_name})
        else:
            cls.insert(conn, {
                "cache_db_name": db_name,
                "done": True,
                "created_at": datetime.utcnow()
            })

    @classmethod
    def get_all_done_dbs(cls, conn) -> List[str]:
        """
        Get all imported database names

        Args:
            conn: Database connection

        Returns:
            List of database names
        """
        results = cls.select(conn, where={"done": True}, columns=["cache_db_name"])
        return [row["cache_db_name"] for row in results]

    @classmethod
    def get_pending_dbs(cls, conn) -> List[str]:
        """
        Get all pending database names

        Args:
            conn: Database connection

        Returns:
            List of database names
        """
        results = cls.select(conn, where={"done": False}, columns=["cache_db_name"])
        return [row["cache_db_name"] for row in results]

    @classmethod
    def reset_db_status(cls, conn, db_name: str):
        """
        Reset database import status

        Args:
            conn: Database connection
            db_name: Cache database name
        """
        cls.update(conn, {"done": False}, where={"cache_db_name": db_name})
