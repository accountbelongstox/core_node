#!/usr/bin/env python3
"""
ExampleUserModel - Example user table for demo app
Demonstrates app-specific table implementation
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class ExampleUserModel(BaseModel):
    """
    Example user table

    Demonstrates app-specific user management

    Schema:
        - id: Integer primary key (auto-increment)
        - username: String (unique) - Username
        - email: String (unique) - Email address
        - password_hash: String - Hashed password
        - is_active: Boolean - Active status
        - created_at: DateTime - Creation timestamp
        - last_login: DateTime (optional) - Last login timestamp
    """

    __table_key__ = TableKeys.EXAMPLE_USERS
    __namespace__ = "app_example"
    __table_name__ = "users"
    __full_table_name__ = "app_example_users"
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
            sqlalchemy.Column('username', sqlalchemy.String(100), unique=True, nullable=False, index=True),
            sqlalchemy.Column('email', sqlalchemy.String(255), unique=True, nullable=False, index=True),
            sqlalchemy.Column('password_hash', sqlalchemy.String(255), nullable=False),
            sqlalchemy.Column('is_active', sqlalchemy.Boolean, default=True, nullable=False),
            sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
            sqlalchemy.Column('last_login', sqlalchemy.String(50), nullable=True),
        )

    # ===== Custom Methods (Differentiated Functionality) =====

    @classmethod
    def get_by_username(cls, conn, username: str) -> Optional[Dict[str, Any]]:
        """
        Get user by username

        Args:
            conn: Database connection
            username: Username to search

        Returns:
            User record or None if not found
        """
        result = cls.select(conn, where={"username": username}, limit=1)
        return result[0] if result else None

    @classmethod
    def get_by_email(cls, conn, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email

        Args:
            conn: Database connection
            email: Email to search

        Returns:
            User record or None if not found
        """
        result = cls.select(conn, where={"email": email}, limit=1)
        return result[0] if result else None

    @classmethod
    def create_user(cls, conn, username: str, email: str, password_hash: str) -> int:
        """
        Create new user

        Args:
            conn: Database connection
            username: Username
            email: Email address
            password_hash: Hashed password

        Returns:
            New user ID
        """
        user_data = {
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        return cls.insert(conn, user_data)

    @classmethod
    def update_last_login(cls, conn, user_id: int):
        """
        Update user's last login timestamp

        Args:
            conn: Database connection
            user_id: User ID
        """
        cls.update(
            conn,
            {"last_login": datetime.utcnow()},
            where={"id": user_id}
        )

    @classmethod
    def deactivate_user(cls, conn, user_id: int):
        """
        Deactivate user account

        Args:
            conn: Database connection
            user_id: User ID
        """
        cls.update(
            conn,
            {"is_active": False},
            where={"id": user_id}
        )

    @classmethod
    def get_active_users(cls, conn, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all active users

        Args:
            conn: Database connection
            limit: Maximum number of users to return

        Returns:
            List of active user records
        """
        return cls.select(
            conn,
            where={"is_active": True},
            order_by="created_at DESC",
            limit=limit
        )

    @classmethod
    def username_exists(cls, conn, username: str) -> bool:
        """
        Check if username exists

        Args:
            conn: Database connection
            username: Username to check

        Returns:
            True if username exists, False otherwise
        """
        count = cls.count(conn, where={"username": username})
        return count > 0

    @classmethod
    def email_exists(cls, conn, email: str) -> bool:
        """
        Check if email exists

        Args:
            conn: Database connection
            email: Email to check

        Returns:
            True if email exists, False otherwise
        """
        count = cls.count(conn, where={"email": email})
        return count > 0
