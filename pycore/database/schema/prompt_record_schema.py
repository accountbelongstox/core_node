# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


PROMPT_FEED_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_PROMPT_FEED)
PROMPT_ARCHIVE_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_PROMPT_ARCHIVE)
PROMPT_META_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_PROMPT_META)
PROMPT_RECORD_SCHEMA_VERSION = 1


def init_prompt_record_schema(connection: sqlite3.Connection) -> int:
    """Create the schema; returns the version found before."""
    previous = int(connection.execute("PRAGMA user_version").fetchone()[0])
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {PROMPT_FEED_TABLE} (
            feed TEXT NOT NULL,
            id TEXT NOT NULL,
            tool TEXT NOT NULL DEFAULT '',
            ts INTEGER NOT NULL DEFAULT 0,
            body TEXT NOT NULL,
            PRIMARY KEY (feed, id)
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{PROMPT_FEED_TABLE}_tool_ts "
        f"ON {PROMPT_FEED_TABLE}(feed, tool, ts)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{PROMPT_FEED_TABLE}_ts ON {PROMPT_FEED_TABLE}(feed, ts)"
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {PROMPT_ARCHIVE_TABLE} (
            key TEXT PRIMARY KEY,
            tool TEXT NOT NULL DEFAULT '',
            ts INTEGER NOT NULL DEFAULT 0,
            body TEXT NOT NULL
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{PROMPT_ARCHIVE_TABLE}_tool_ts ON {PROMPT_ARCHIVE_TABLE}(tool, ts)"
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {PROMPT_META_TABLE} (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL
        )
        """
    )
    if previous < PROMPT_RECORD_SCHEMA_VERSION:
        connection.execute(f"PRAGMA user_version={PROMPT_RECORD_SCHEMA_VERSION}")
    return previous


__all__ = [
    "PROMPT_ARCHIVE_TABLE",
    "PROMPT_FEED_TABLE",
    "PROMPT_META_TABLE",
    "PROMPT_RECORD_SCHEMA_VERSION",
    "init_prompt_record_schema",
]
