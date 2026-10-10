# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.terminal_state_schema import (
    ACTIVE_TERMINAL_VIEW,
    DRAFT_BYTES_COLUMN,
    DRAFT_COLUMN,
    LOG_CONTENT_COLUMN,
    LOG_TABLE,
    LOG_TEXT_COLUMNS,
    SQLITE_MAX_INTEGER,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)


LOG_ROW_COLUMNS = ("terminal_number", "log_id", *LOG_TEXT_COLUMNS, LOG_CONTENT_COLUMN)
LOG_ROW_JSON_COLUMNS = ", ".join(LOG_ROW_COLUMNS)
DRAFT_ROW_COLUMNS = ("terminal_number", "title", "custom_title", "updated_at", DRAFT_COLUMN)
DRAFT_ROW_JSON_COLUMNS = ", ".join(DRAFT_ROW_COLUMNS)


def _fits(*numbers: int) -> bool:
    return all(0 <= number <= SQLITE_MAX_INTEGER for number in numbers)


class TerminalStateReader:
    """Read-only WAL connection on its own owner: point reads never queue behind the writer owner."""

    def __init__(self, database_path: Path) -> None:
        self._connection = open_wal_connection(database_path, query_only=True)
        init_serialized_owner(
            self,
            "terminal.state.reader",
            "TerminalStateReader",
        )

    @serialized_method
    def read_draft(self, terminal_number: int) -> Optional[str]:
        if not _fits(terminal_number):
            return None
        row = self._connection.execute(
            f"SELECT {DRAFT_COLUMN} FROM {ACTIVE_TERMINAL_VIEW} WHERE terminal_number = ?",
            (terminal_number,),
        ).fetchone()
        return str(row[0]) if row is not None else None

    @serialized_method
    def read_log_content(self, terminal_number: int, log_id: int) -> Optional[str]:
        if not _fits(terminal_number, log_id):
            return None
        row = self._connection.execute(
            f"""
            SELECT log.{LOG_CONTENT_COLUMN}
            FROM {LOG_TABLE} AS log
            JOIN {ACTIVE_TERMINAL_VIEW} AS terminal
              ON terminal.terminal_number = log.terminal_number
            WHERE log.terminal_number = ? AND log.log_id = ?
            """,
            (terminal_number, log_id),
        ).fetchone()
        return str(row[0]) if row is not None else None

    @serialized_method
    def read_log_contents(
        self,
        terminal_number: int,
        log_ids: Sequence[int],
    ) -> Dict[str, str]:
        wanted = sorted({log_id for log_id in log_ids if _fits(log_id)})
        if not wanted or not _fits(terminal_number):
            return {}
        placeholders = ", ".join("?" for _log_id in wanted)
        row = self._connection.execute(
            f"""
            SELECT json_group_object(CAST(log.log_id AS TEXT), log.{LOG_CONTENT_COLUMN})
            FROM {LOG_TABLE} AS log
            JOIN {ACTIVE_TERMINAL_VIEW} AS terminal
              ON terminal.terminal_number = log.terminal_number
            WHERE log.terminal_number = ? AND log.log_id IN ({placeholders})
            """,
            (terminal_number, *wanted),
        ).fetchone()
        return {str(log_id): str(content) for log_id, content in json.loads(row[0]).items()}

    @serialized_method
    def window_id(self, terminal_number: int) -> str:
        if not _fits(terminal_number):
            return ""
        row = self._connection.execute(
            f"SELECT window_id FROM {ACTIVE_TERMINAL_VIEW} WHERE terminal_number = ?",
            (terminal_number,),
        ).fetchone()
        return str(row[0]) if row is not None else ""

    @serialized_method
    def matching_logs(self, needle: str) -> List[Dict[str, Any]]:
        """Log entries whose content contains needle (ASCII case-insensitive), newest first."""
        row = self._connection.execute(
            f"""
            SELECT json_group_array(json_array({LOG_ROW_JSON_COLUMNS}))
            FROM {LOG_TABLE}
            WHERE instr(lower({LOG_CONTENT_COLUMN}), lower(?)) > 0
            """,
            (needle,),
        ).fetchone()
        entries = [dict(zip(LOG_ROW_COLUMNS, stored)) for stored in json.loads(row[0])]
        entries.sort(
            key=lambda entry: (int(entry["log_id"]), int(entry["terminal_number"])),
            reverse=True,
        )
        return entries

    @serialized_method
    def matching_drafts(self, needle: str) -> List[Dict[str, Any]]:
        """Unsent drafts of active terminals containing needle (ASCII case-insensitive), newest first."""
        row = self._connection.execute(
            f"""
            SELECT json_group_array(json_array({DRAFT_ROW_JSON_COLUMNS}))
            FROM {ACTIVE_TERMINAL_VIEW}
            WHERE {DRAFT_BYTES_COLUMN} > 0 AND instr(lower({DRAFT_COLUMN}), lower(?)) > 0
            """,
            (needle,),
        ).fetchone()
        entries = [dict(zip(DRAFT_ROW_COLUMNS, stored)) for stored in json.loads(row[0])]
        entries.sort(key=lambda entry: str(entry["updated_at"]), reverse=True)
        return entries

    @serialized_method
    def logs_page(self, after_terminal: int, after_log: int, limit: int) -> List[Dict[str, Any]]:
        """Log entries after the ``(terminal_number, log_id)`` keyset cursor, in key order."""
        rows = self._connection.execute(
            f"""
            SELECT {LOG_ROW_JSON_COLUMNS} FROM {LOG_TABLE}
            WHERE (terminal_number, log_id) > (?, ?)
            ORDER BY terminal_number, log_id
            LIMIT ?
            """,
            (after_terminal, after_log, limit),
        ).fetchall()
        return [dict(zip(LOG_ROW_COLUMNS, row)) for row in rows]

    @serialized_method
    def drafts(self) -> List[Dict[str, Any]]:
        """Unsent drafts of every active terminal."""
        rows = self._connection.execute(
            f"SELECT {DRAFT_ROW_JSON_COLUMNS} FROM {ACTIVE_TERMINAL_VIEW} WHERE {DRAFT_BYTES_COLUMN} > 0"
        ).fetchall()
        return [dict(zip(DRAFT_ROW_COLUMNS, row)) for row in rows]


__all__ = ["TerminalStateReader"]
