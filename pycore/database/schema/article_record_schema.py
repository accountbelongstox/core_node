# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


ARTICLE_RECORD_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_ARTICLE_RECORDS)
ARTICLE_META_TABLE = TableKeys.get_full_table_name(TableKeys.AGENT_HISTORY_ARTICLE_META)
ARTICLE_RECORD_SCHEMA_VERSION = 1

# Indexed projections of the JSON body; the body stays authoritative.
ARTICLE_RECORD_COLUMNS = (
    "created_at",
    "uploaded",
    "audio_status",
    "tts_chunked",
    "audio_rebuilt",
    "rebuild_upload_current",
    "video_status",
    "has_article",
)


def init_article_record_schema(connection: sqlite3.Connection) -> int:
    """Create the schema; returns the version found before."""
    previous = int(connection.execute("PRAGMA user_version").fetchone()[0])
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {ARTICLE_RECORD_TABLE} (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT '',
            uploaded INTEGER NOT NULL DEFAULT 0,
            audio_status TEXT NOT NULL DEFAULT '',
            tts_chunked INTEGER NOT NULL DEFAULT 0,
            audio_rebuilt INTEGER NOT NULL DEFAULT 0,
            rebuild_upload_current INTEGER NOT NULL DEFAULT 0,
            video_status TEXT NOT NULL DEFAULT '',
            has_article INTEGER NOT NULL DEFAULT 0,
            body TEXT NOT NULL
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{ARTICLE_RECORD_TABLE}_created "
        f"ON {ARTICLE_RECORD_TABLE}(created_at DESC, id DESC)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{ARTICLE_RECORD_TABLE}_rebuild "
        f"ON {ARTICLE_RECORD_TABLE}(has_article, tts_chunked)"
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {ARTICLE_META_TABLE} (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL
        )
        """
    )
    if previous < ARTICLE_RECORD_SCHEMA_VERSION:
        connection.execute(f"PRAGMA user_version={ARTICLE_RECORD_SCHEMA_VERSION}")
    return previous


__all__ = [
    "ARTICLE_META_TABLE",
    "ARTICLE_RECORD_COLUMNS",
    "ARTICLE_RECORD_SCHEMA_VERSION",
    "ARTICLE_RECORD_TABLE",
    "init_article_record_schema",
]
