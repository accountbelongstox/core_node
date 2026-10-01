# -*- coding: utf-8 -*-
"""SQLite repository of agent-history prompt records.

Two record kinds share one database:
- feeds: bounded, id-keyed prompt feeds (``feed`` names the feed, e.g. new
  prompts or an AI transform output); rows carry indexed ``tool``/``ts``
  columns plus the free-form JSON ``body``;
- archive: append-only backup of every scanned prompt keyed by a content
  key, never trimmed.
Every query is keyed or indexed and bounded.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.prompt_record_schema import (
    PROMPT_ARCHIVE_TABLE,
    PROMPT_FEED_TABLE,
    PROMPT_META_TABLE,
    init_prompt_record_schema,
)

# Feed trim order: by record time, or by insertion (latest write kept).
TRIM_BY_TS = "ts"
TRIM_BY_INSERTION = "rowid"
_TRIM_ORDERS = (TRIM_BY_TS, TRIM_BY_INSERTION)

FeedRow = Tuple[str, str, int, Dict[str, Any]]
ArchiveRow = Tuple[str, str, int, Dict[str, Any]]


class PromptRecordRepository:
    def __init__(self, database_path: Path) -> None:
        self.path = Path(database_path)
        self._connection = open_wal_connection(database_path)
        init_prompt_record_schema(self._connection)
        self._connection.commit()

    # ------------------------------------------------------------------ #
    # meta                                                                #
    # ------------------------------------------------------------------ #
    def meta(self, key: str) -> str:
        values = self._connection.execute(
            f"SELECT meta_value FROM {PROMPT_META_TABLE} WHERE meta_key = ?", (key,),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def set_meta(self, key: str, value: str) -> None:
        with self._connection:
            self._connection.execute(
                f"INSERT OR REPLACE INTO {PROMPT_META_TABLE} (meta_key, meta_value) VALUES (?, ?)",
                (key, str(value)),
            )

    # ------------------------------------------------------------------ #
    # feeds                                                               #
    # ------------------------------------------------------------------ #
    def feed_write(self, feed: str, rows: Iterable[FeedRow], replace: bool) -> int:
        """Insert ``(id, tool, ts, body)`` rows; ``replace`` overwrites (and
        re-orders) an existing id, otherwise existing ids are kept. Returns
        the number of rows written."""
        verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
        written = 0
        with self._connection:
            for row_id, tool, ts, body in rows:
                cursor = self._connection.execute(
                    f"{verb} INTO {PROMPT_FEED_TABLE} (feed, id, tool, ts, body) VALUES (?, ?, ?, ?, ?)",
                    (feed, row_id, tool, int(ts), json.dumps(body, ensure_ascii=False)),
                )
                written += cursor.rowcount
        return written

    def feed_trim(self, feed: str, keep: int, order: str, tool: Optional[str] = None) -> None:
        """Keep the newest ``keep`` rows of a feed (or of one tool in it)."""
        if order not in _TRIM_ORDERS:
            raise ValueError(f"unknown feed trim order: {order}")
        scope, params = ("feed = ? AND tool = ?", (feed, tool)) if tool is not None else ("feed = ?", (feed,))
        with self._connection:
            self._connection.execute(
                f"DELETE FROM {PROMPT_FEED_TABLE} WHERE {scope} AND rowid NOT IN ("
                f"SELECT rowid FROM {PROMPT_FEED_TABLE} WHERE {scope} ORDER BY {order} DESC LIMIT ?)",
                (*params, *params, int(keep)),
            )

    def feed_counts(self, feed: str) -> Dict[str, int]:
        rows = self._connection.execute(
            f"SELECT tool, COUNT(*) FROM {PROMPT_FEED_TABLE} WHERE feed = ? GROUP BY tool ORDER BY tool", (feed,),
        ).fetchall()
        return {str(tool): int(count) for tool, count in rows}

    def feed_count(self, feed: str, tool: Optional[str] = None) -> int:
        if tool is None:
            row = self._connection.execute(
                f"SELECT COUNT(*) FROM {PROMPT_FEED_TABLE} WHERE feed = ?", (feed,),
            ).fetchone()
        else:
            row = self._connection.execute(
                f"SELECT COUNT(*) FROM {PROMPT_FEED_TABLE} WHERE feed = ? AND tool = ?", (feed, tool),
            ).fetchone()
        return int(row[0])

    def feed_page(self, feed: str, offset: int, limit: int, tool: Optional[str] = None) -> List[Dict[str, Any]]:
        """Newest-first (by ts) bodies of one feed page."""
        if tool is None:
            rows = self._connection.execute(
                f"SELECT body FROM {PROMPT_FEED_TABLE} WHERE feed = ? ORDER BY ts DESC, rowid DESC LIMIT ? OFFSET ?",
                (feed, int(limit), int(offset)),
            ).fetchall()
        else:
            rows = self._connection.execute(
                f"SELECT body FROM {PROMPT_FEED_TABLE} WHERE feed = ? AND tool = ? "
                f"ORDER BY ts DESC, rowid DESC LIMIT ? OFFSET ?",
                (feed, tool, int(limit), int(offset)),
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    # ------------------------------------------------------------------ #
    # archive                                                             #
    # ------------------------------------------------------------------ #
    def archive_write(self, rows: Iterable[ArchiveRow]) -> int:
        """Insert ``(key, tool, ts, body)`` rows whose key is new; returns the count."""
        written = 0
        with self._connection:
            for key, tool, ts, body in rows:
                cursor = self._connection.execute(
                    f"INSERT OR IGNORE INTO {PROMPT_ARCHIVE_TABLE} (key, tool, ts, body) VALUES (?, ?, ?, ?)",
                    (key, tool, int(ts), json.dumps(body, ensure_ascii=False)),
                )
                written += cursor.rowcount
        return written


__all__ = ["PromptRecordRepository", "TRIM_BY_INSERTION", "TRIM_BY_TS"]
