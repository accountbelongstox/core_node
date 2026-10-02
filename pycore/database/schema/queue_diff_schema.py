# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


QUEUE_DIFF_TASKS_TABLE = TableKeys.get_full_table_name(TableKeys.QUEUE_DIFF_TASKS)
QUEUE_DIFF_CURSORS_TABLE = TableKeys.get_full_table_name(TableKeys.QUEUE_DIFF_CURSORS)


def init_queue_diff_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {QUEUE_DIFF_TASKS_TABLE} (
            scope TEXT NOT NULL,
            task_id TEXT NOT NULL,
            task_type TEXT NOT NULL,
            body TEXT NOT NULL,
            staged_at REAL NOT NULL,
            PRIMARY KEY (scope, task_id)
        ) WITHOUT ROWID
        """
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {QUEUE_DIFF_CURSORS_TABLE} (
            scope TEXT NOT NULL,
            task_type TEXT NOT NULL,
            revision INTEGER NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (scope, task_type)
        ) WITHOUT ROWID
        """
    )


__all__ = ["QUEUE_DIFF_CURSORS_TABLE", "QUEUE_DIFF_TASKS_TABLE", "init_queue_diff_schema"]
