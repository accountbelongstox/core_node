#!/usr/bin/env python3
"""
CommonConfigModel - Key-value configuration storage
Shared configuration table for all apps and utilities
"""

from typing import Optional, Dict, Any
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class CommonConfigModel(BaseModel):
    """
    Common configuration table

    Stores key-value pairs for application configuration

    Schema:
        - id: Integer primary key (auto-increment)
        - key: String (unique) - Configuration key
        - value: String - Configuration value (JSON string for complex data)
        - description: String (optional) - Description of config key
        - created_at: DateTime - Creation timestamp
        - updated_at: DateTime - Last update timestamp
    """

    __table_key__ = TableKeys.COMMON_CONFIG
    __namespace__ = "common"
    __table_name__ = "config"
    __full_table_name__ = "common_config"
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
            sqlalchemy.Column('description', sqlalchemy.String(500), nullable=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.String(50), nullable=False),
        )

    # ===== Custom Methods (Differentiated Functionality) =====

    @classmethod
    def get_value(cls, conn, key: str) -> Optional[str]:
        """
        Get configuration value by key

        Args:
            conn: Database connection
            key: Configuration key

        Returns:
            Configuration value or None if not found
        """
        result = cls.select(conn, where={"key": key}, limit=1)
        if result:
            return result[0]["value"]
        return None

    @classmethod
    def set_value(cls, conn, key: str, value: str, description: Optional[str] = None):
        """
        Set configuration value (insert or update)

        Args:
            conn: Database connection
            key: Configuration key
            value: Configuration value
            description: Optional description
        """
        existing = cls.select(conn, where={"key": key}, limit=1)

        if existing:
            # Update existing
            update_data = {"value": value, "updated_at": datetime.utcnow()}
            if description is not None:
                update_data["description"] = description
            cls.update(conn, update_data, where={"key": key})
        else:
            # Insert new
            insert_data = {
                "key": key,
                "value": value,
                "description": description,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            cls.insert(conn, insert_data)

    @classmethod
    def delete_key(cls, conn, key: str) -> int:
        """
        Delete configuration by key

        Args:
            conn: Database connection
            key: Configuration key

        Returns:
            Number of rows deleted
        """
        return cls.delete(conn, where={"key": key})

    @classmethod
    def get_all_configs(cls, conn) -> Dict[str, Any]:
        """
        Get all configurations as dictionary

        Args:
            conn: Database connection

        Returns:
            Dictionary mapping keys to their full config data
        """
        all_configs = cls.select(conn)
        return {config["key"]: config for config in all_configs}

    @classmethod
    def key_exists(cls, conn, key: str) -> bool:
        """
        Check if configuration key exists

        Args:
            conn: Database connection
            key: Configuration key

        Returns:
            True if key exists, False otherwise
        """
        count = cls.count(conn, where={"key": key})
        return count > 0
