#!/usr/bin/env python3
"""
ExampleTaskModel - Example task table for demo app
Demonstrates app-specific task management
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys


class ExampleTaskModel(BaseModel):
    """
    Example task table

    Demonstrates app-specific task tracking

    Schema:
        - id: Integer primary key (auto-increment)
        - user_id: Integer - Foreign key to users table
        - title: String - Task title
        - description: String (optional) - Task description
        - status: String - Task status (pending, in_progress, completed, cancelled)
        - priority: Integer - Priority level (1=low, 2=medium, 3=high)
        - created_at: DateTime - Creation timestamp
        - updated_at: DateTime - Last update timestamp
        - completed_at: DateTime (optional) - Completion timestamp
    """

    __table_key__ = TableKeys.EXAMPLE_TASKS
    __namespace__ = "app_example"
    __table_name__ = "tasks"
    __full_table_name__ = "app_example_tasks"
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
            sqlalchemy.Column('user_id', sqlalchemy.Integer, nullable=False, index=True),
            sqlalchemy.Column('title', sqlalchemy.String(255), nullable=False),
            sqlalchemy.Column('description', sqlalchemy.Text, nullable=True),
            sqlalchemy.Column('status', sqlalchemy.String(20), default='pending', nullable=False, index=True),
            sqlalchemy.Column('priority', sqlalchemy.Integer, default=2, nullable=False),
            sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow, nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False),
            sqlalchemy.Column('completed_at', sqlalchemy.DateTime, nullable=True),
        )

    # ===== Custom Methods (Differentiated Functionality) =====

    @classmethod
    def create_task(cls, conn, user_id: int, title: str, description: Optional[str] = None, priority: int = 2) -> int:
        """
        Create new task

        Args:
            conn: Database connection
            user_id: User ID who owns the task
            title: Task title
            description: Optional task description
            priority: Priority level (1=low, 2=medium, 3=high)

        Returns:
            New task ID
        """
        task_data = {
            "user_id": user_id,
            "title": title,
            "description": description,
            "status": "pending",
            "priority": priority,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        return cls.insert(conn, task_data)

    @classmethod
    def get_user_tasks(cls, conn, user_id: int, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get tasks for a specific user

        Args:
            conn: Database connection
            user_id: User ID
            status: Optional status filter

        Returns:
            List of task records
        """
        where_clause = {"user_id": user_id}
        if status:
            where_clause["status"] = status

        return cls.select(
            conn,
            where=where_clause,
            order_by="priority DESC, created_at DESC"
        )

    @classmethod
    def update_status(cls, conn, task_id: int, status: str):
        """
        Update task status

        Args:
            conn: Database connection
            task_id: Task ID
            status: New status (pending, in_progress, completed, cancelled)
        """
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }

        if status == "completed":
            update_data["completed_at"] = datetime.utcnow()

        cls.update(conn, update_data, where={"id": task_id})

    @classmethod
    def complete_task(cls, conn, task_id: int):
        """
        Mark task as completed

        Args:
            conn: Database connection
            task_id: Task ID
        """
        cls.update_status(conn, task_id, "completed")

    @classmethod
    def get_pending_tasks(cls, conn, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get pending tasks

        Args:
            conn: Database connection
            user_id: Optional user ID to filter

        Returns:
            List of pending task records
        """
        where_clause = {"status": "pending"}
        if user_id is not None:
            where_clause["user_id"] = user_id

        return cls.select(
            conn,
            where=where_clause,
            order_by="priority DESC, created_at ASC"
        )

    @classmethod
    def get_high_priority_tasks(cls, conn, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get high priority tasks

        Args:
            conn: Database connection
            user_id: Optional user ID to filter

        Returns:
            List of high priority task records
        """
        where_clause = {"priority": 3}
        if user_id is not None:
            where_clause["user_id"] = user_id

        return cls.select(
            conn,
            where=where_clause,
            order_by="created_at DESC"
        )

    @classmethod
    def get_task_stats(cls, conn, user_id: int) -> Dict[str, int]:
        """
        Get task statistics for a user

        Args:
            conn: Database connection
            user_id: User ID

        Returns:
            Dictionary with task counts by status
        """
        stats = {
            "total": cls.count(conn, where={"user_id": user_id}),
            "pending": cls.count(conn, where={"user_id": user_id, "status": "pending"}),
            "in_progress": cls.count(conn, where={"user_id": user_id, "status": "in_progress"}),
            "completed": cls.count(conn, where={"user_id": user_id, "status": "completed"}),
            "cancelled": cls.count(conn, where={"user_id": user_id, "status": "cancelled"}),
        }
        return stats
