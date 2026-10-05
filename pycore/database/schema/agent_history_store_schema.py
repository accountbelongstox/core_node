# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


AGENT_HISTORY_SESSION_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_SESSIONS)
AGENT_HISTORY_PROMPT_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_PROMPTS)
AGENT_HISTORY_SOURCE_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_SOURCES)
AGENT_HISTORY_STORE_META_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_STORE_META)
AGENT_HISTORY_PROMPT_SEARCH_TABLE = f"{AGENT_HISTORY_PROMPT_TABLE}_search"
AGENT_HISTORY_STORE_SCHEMA_VERSION = 1


def init_agent_history_store_schema(connection: sqlite3.Connection) -> int:
    """Create the schema; returns the version found before."""
    previous = int(connection.execute("PRAGMA user_version").fetchone()[0])
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AGENT_HISTORY_SESSION_TABLE} (
            id TEXT PRIMARY KEY,
            tool TEXT NOT NULL DEFAULT '',
            os_user TEXT NOT NULL DEFAULT '',
            started_ts INTEGER NOT NULL DEFAULT 0,
            summary TEXT NOT NULL
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{AGENT_HISTORY_SESSION_TABLE}_started "
        f"ON {AGENT_HISTORY_SESSION_TABLE}(started_ts DESC)"
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AGENT_HISTORY_PROMPT_TABLE} (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL DEFAULT '',
            tool TEXT NOT NULL DEFAULT '',
            os_user TEXT NOT NULL DEFAULT '',
            project TEXT NOT NULL DEFAULT '',
            ts INTEGER NOT NULL DEFAULT 0,
            time TEXT NOT NULL DEFAULT '',
            lang TEXT NOT NULL DEFAULT '',
            edited INTEGER NOT NULL DEFAULT 0,
            text TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{AGENT_HISTORY_PROMPT_TABLE}_ts "
        f"ON {AGENT_HISTORY_PROMPT_TABLE}(ts DESC)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{AGENT_HISTORY_PROMPT_TABLE}_session "
        f"ON {AGENT_HISTORY_PROMPT_TABLE}(session_id)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{AGENT_HISTORY_PROMPT_TABLE}_tool_ts "
        f"ON {AGENT_HISTORY_PROMPT_TABLE}(tool, ts DESC)"
    )
    search_missing = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (AGENT_HISTORY_PROMPT_SEARCH_TABLE,),
    ).fetchone() is None
    connection.execute(
        f"CREATE VIRTUAL TABLE IF NOT EXISTS {AGENT_HISTORY_PROMPT_SEARCH_TABLE} USING fts5("
        f"text, content='{AGENT_HISTORY_PROMPT_TABLE}', content_rowid='rowid', tokenize='trigram')"
    )
    connection.execute(
        f"CREATE TRIGGER IF NOT EXISTS {AGENT_HISTORY_PROMPT_SEARCH_TABLE}_ai AFTER INSERT ON {AGENT_HISTORY_PROMPT_TABLE} "
        f"BEGIN INSERT INTO {AGENT_HISTORY_PROMPT_SEARCH_TABLE}(rowid, text) VALUES (new.rowid, new.text); END"
    )
    connection.execute(
        f"CREATE TRIGGER IF NOT EXISTS {AGENT_HISTORY_PROMPT_SEARCH_TABLE}_ad AFTER DELETE ON {AGENT_HISTORY_PROMPT_TABLE} "
        f"BEGIN INSERT INTO {AGENT_HISTORY_PROMPT_SEARCH_TABLE}({AGENT_HISTORY_PROMPT_SEARCH_TABLE}, rowid, text) "
        f"VALUES ('delete', old.rowid, old.text); END"
    )
    connection.execute(
        f"CREATE TRIGGER IF NOT EXISTS {AGENT_HISTORY_PROMPT_SEARCH_TABLE}_au AFTER UPDATE OF text ON {AGENT_HISTORY_PROMPT_TABLE} "
        f"BEGIN INSERT INTO {AGENT_HISTORY_PROMPT_SEARCH_TABLE}({AGENT_HISTORY_PROMPT_SEARCH_TABLE}, rowid, text) "
        f"VALUES ('delete', old.rowid, old.text); "
        f"INSERT INTO {AGENT_HISTORY_PROMPT_SEARCH_TABLE}(rowid, text) VALUES (new.rowid, new.text); END"
    )
    if search_missing:
        connection.execute(
            f"INSERT INTO {AGENT_HISTORY_PROMPT_SEARCH_TABLE}({AGENT_HISTORY_PROMPT_SEARCH_TABLE}) VALUES ('rebuild')"
        )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AGENT_HISTORY_SOURCE_TABLE} (
            path TEXT PRIMARY KEY,
            tool TEXT NOT NULL DEFAULT '',
            info TEXT NOT NULL
        )
        """
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AGENT_HISTORY_STORE_META_TABLE} (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL
        )
        """
    )
    if previous < AGENT_HISTORY_STORE_SCHEMA_VERSION:
        connection.execute(f"PRAGMA user_version={AGENT_HISTORY_STORE_SCHEMA_VERSION}")
    return previous


__all__ = [
    "AGENT_HISTORY_PROMPT_SEARCH_TABLE",
    "AGENT_HISTORY_PROMPT_TABLE",
    "AGENT_HISTORY_SESSION_TABLE",
    "AGENT_HISTORY_SOURCE_TABLE",
    "AGENT_HISTORY_STORE_META_TABLE",
    "AGENT_HISTORY_STORE_SCHEMA_VERSION",
    "init_agent_history_store_schema",
]
