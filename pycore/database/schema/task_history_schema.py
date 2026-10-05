# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


TASK_HISTORY_TABLE = TableKeys.get_full_table_name(TableKeys.TASK_HISTORY)
TASK_HISTORY_META_TABLE = TableKeys.get_full_table_name(TableKeys.TASK_HISTORY_META)
TASK_HISTORY_SCHEMA_VERSION = 1


def init_task_history_schema(connection: sqlite3.Connection) -> int:
    """Create the schema; returns the version found before."""
    previous = int(connection.execute("PRAGMA user_version").fetchone()[0])
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TASK_HISTORY_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{TASK_HISTORY_TABLE}_record ON {TASK_HISTORY_TABLE}(record_id)"
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TASK_HISTORY_META_TABLE} (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL
        )
        """
    )
    if previous < TASK_HISTORY_SCHEMA_VERSION:
        connection.execute(f"PRAGMA user_version={TASK_HISTORY_SCHEMA_VERSION}")
    return previous


__all__ = [
    "TASK_HISTORY_META_TABLE",
    "TASK_HISTORY_SCHEMA_VERSION",
    "TASK_HISTORY_TABLE",
    "init_task_history_schema",
]
