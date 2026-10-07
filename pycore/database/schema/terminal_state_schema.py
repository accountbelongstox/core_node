# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3
from typing import Dict

from pycore.database.models.table_keys import TableKeys


TERMINAL_STATE_LEGACY_TABLE = TableKeys.get_full_table_name(TableKeys.TERMINAL_STATE)
TERMINAL_TABLE = TableKeys.get_full_table_name(TableKeys.TERMINAL_STATE_TERMINALS)
LOG_TABLE = TableKeys.get_full_table_name(TableKeys.TERMINAL_STATE_LOGS)
ACTIVE_TERMINAL_VIEW = f"{TERMINAL_TABLE}_active"
TERMINAL_STATE_SCHEMA_VERSION = 1
SQLITE_MAX_INTEGER = 2 ** 63 - 1
DEFAULT_LOG_SOURCE = "input"
TERMINAL_TEXT_COLUMNS = (
    "platform",
    "window_key",
    "window_id",
    "native_id",
    "title",
    "app",
    "class_name",
    "created_at",
    "updated_at",
    "last_seen_at",
    "slot_version",
    "custom_title",
)
TERMINAL_INTEGER_COLUMNS = (
    "process_id",
    "rect_x",
    "rect_y",
    "rect_width",
    "rect_height",
    "preview_expanded",
)
TERMINAL_INTEGER_DEFAULTS: Dict[str, int] = {
    "process_id": 0,
    "rect_x": 0,
    "rect_y": 0,
    "rect_width": 1,
    "rect_height": 1,
    "preview_expanded": 0,
}
MERGED_INTO_COLUMN = "merged_into"
DRAFT_COLUMN = "draft"
DRAFT_BYTES_COLUMN = "draft_bytes"
LOG_TEXT_COLUMNS = ("date", "error_code", "preview", "source", "status", "title")
LOG_CONTENT_COLUMN = "content"


def init_terminal_state_schema(connection: sqlite3.Connection) -> None:
    text_columns = ",\n            ".join(
        f"{column} TEXT NOT NULL DEFAULT ''" for column in TERMINAL_TEXT_COLUMNS
    )
    integer_columns = ",\n            ".join(
        f"{column} INTEGER NOT NULL DEFAULT {TERMINAL_INTEGER_DEFAULTS[column]}"
        for column in TERMINAL_INTEGER_COLUMNS
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TERMINAL_TABLE} (
            terminal_number INTEGER PRIMARY KEY,
            {text_columns},
            {integer_columns},
            {MERGED_INTO_COLUMN} INTEGER,
            {DRAFT_BYTES_COLUMN} INTEGER NOT NULL DEFAULT 0,
            {DRAFT_COLUMN} TEXT NOT NULL DEFAULT ''
        )
        """
    )
    log_text_columns = ",\n            ".join(
        f"{column} TEXT NOT NULL DEFAULT ''" for column in LOG_TEXT_COLUMNS
    )
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {LOG_TABLE} (
            terminal_number INTEGER NOT NULL,
            log_id INTEGER NOT NULL,
            {log_text_columns},
            {LOG_CONTENT_COLUMN} TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (terminal_number, log_id)
        ) WITHOUT ROWID
        """
    )
    connection.execute(
        f"""
        CREATE VIEW IF NOT EXISTS {ACTIVE_TERMINAL_VIEW} AS
        SELECT terminal.* FROM {TERMINAL_TABLE} AS terminal
        WHERE NOT (
            terminal.{MERGED_INTO_COLUMN} IS NOT NULL
            AND terminal.{MERGED_INTO_COLUMN} <> terminal.terminal_number
            AND EXISTS (
                SELECT 1 FROM {TERMINAL_TABLE} AS target
                WHERE target.terminal_number = terminal.{MERGED_INTO_COLUMN}
            )
        )
        """
    )


__all__ = [
    "ACTIVE_TERMINAL_VIEW",
    "DEFAULT_LOG_SOURCE",
    "DRAFT_BYTES_COLUMN",
    "DRAFT_COLUMN",
    "LOG_CONTENT_COLUMN",
    "LOG_TABLE",
    "LOG_TEXT_COLUMNS",
    "MERGED_INTO_COLUMN",
    "SQLITE_MAX_INTEGER",
    "TERMINAL_INTEGER_COLUMNS",
    "TERMINAL_INTEGER_DEFAULTS",
    "TERMINAL_STATE_LEGACY_TABLE",
    "TERMINAL_STATE_SCHEMA_VERSION",
    "TERMINAL_TABLE",
    "TERMINAL_TEXT_COLUMNS",
    "init_terminal_state_schema",
]
