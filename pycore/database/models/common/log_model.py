#!/usr/bin/env python3
"""
CommonLogModel - Application logging table
Shared logging table for all apps and utilities
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class CommonLogModel(BaseModel):
    """
    Common logging table

    Stores application logs from all apps and utilities

    Schema:
        - id: Integer primary key (auto-increment)
        - timestamp: DateTime - Log timestamp
        - level: String - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        - source: String - Log source (app/util name)
        - message: String - Log message
        - details: String (optional) - Additional details (JSON string)
        - created_at: DateTime - Record creation timestamp
    """

    __table_key__ = TableKeys.COMMON_LOGS
    __namespace__ = "common"
    __table_name__ = "logs"
    __full_table_name__ = "common_logs"
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
            sqlalchemy.Column('timestamp', sqlalchemy.String(50), nullable=False, index=True),
            sqlalchemy.Column('level', sqlalchemy.String(20), nullable=False, index=True),
            sqlalchemy.Column('source', sqlalchemy.String(100), nullable=False, index=True),
            sqlalchemy.Column('message', sqlalchemy.Text, nullable=False),
            sqlalchemy.Column('details', sqlalchemy.Text, nullable=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
        )

    # ===== Custom Methods (Differentiated Functionality) =====

    @classmethod
    def log(cls, conn, level: str, source: str, message: str, details: Optional[str] = None):
        """
        Add log entry

        Args:
            conn: Database connection
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            source: Log source (app/util name)
            message: Log message
            details: Optional additional details (JSON string)
        """
        log_data = {
            "timestamp": datetime.utcnow(),
            "level": level.upper(),
            "source": source,
            "message": message,
            "details": details,
            "created_at": datetime.utcnow()
        }
        cls.insert(conn, log_data)

    @classmethod
    def get_logs_by_level(cls, conn, level: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get logs by level

        Args:
            conn: Database connection
            level: Log level to filter
            limit: Maximum number of logs to return

        Returns:
            List of log entries
        """
        return cls.select(
            conn,
            where={"level": level.upper()},
            order_by="timestamp DESC",
            limit=limit
        )

    @classmethod
    def get_logs_by_source(cls, conn, source: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get logs by source

        Args:
            conn: Database connection
            source: Source to filter
            limit: Maximum number of logs to return

        Returns:
            List of log entries
        """
        return cls.select(
            conn,
            where={"source": source},
            order_by="timestamp DESC",
            limit=limit
        )

    @classmethod
    def get_recent_logs(cls, conn, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent logs

        Args:
            conn: Database connection
            limit: Maximum number of logs to return

        Returns:
            List of log entries ordered by timestamp (newest first)
        """
        return cls.select(
            conn,
            order_by="timestamp DESC",
            limit=limit
        )

    @classmethod
    def get_error_logs(cls, conn, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get error and critical logs

        Args:
            conn: Database connection
            limit: Maximum number of logs to return

        Returns:
            List of error/critical log entries
        """
        # Note: This uses raw SQL for OR condition
        # In a real implementation, you might extend BaseModel to support OR conditions
        query = cls.__table__.select().where(
            sqlalchemy.or_(
                cls.__table__.c.level == "ERROR",
                cls.__table__.c.level == "CRITICAL"
            )
        ).order_by(
            cls.__table__.c.timestamp.desc()
        ).limit(limit)

        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

    @classmethod
    def clear_old_logs(cls, conn, days: int = 30) -> int:
        """
        Clear logs older than specified days

        Args:
            conn: Database connection
            days: Number of days to keep

        Returns:
            Number of deleted rows
        """
        cutoff_date = datetime.utcnow() - __import__('datetime').timedelta(days=days)

        # Use raw SQL for date comparison
        delete_stmt = cls.__table__.delete().where(
            cls.__table__.c.timestamp < cutoff_date
        )

        result = conn.execute(delete_stmt)
        return result.rowcount
