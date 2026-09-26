# -*- coding: utf-8 -*-
"""Indexed SQLite repository of the local word/sentence clip ledger.

One row per ``(kind, resource_key)``: the newest local file of that clip and
the text/language/variant needed to upload it. Reads are keyed or paged by
primary key; nothing loads the whole table.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from pycore.database.adapters.sqlite_local import connect_writable
from pycore.database.schema.audio_resource_schema import AUDIO_RESOURCES_TABLE, init_audio_resource_schema


SQLITE_BUSY_TIMEOUT_MS = 30000
_FIELDS = ("kind", "resource_key", "language", "variant", "text", "path", "provider", "recorded_at")


class AudioResourceRepository:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = connect_writable(
            database_path.resolve(),
            timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
            check_same_thread=False,
        )
        self._connection.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        self._connection.execute("PRAGMA journal_mode=WAL")
        init_audio_resource_schema(self._connection)
        self._connection.commit()

    def upsert_many(self, rows: List[Dict[str, Any]]) -> None:
        placeholders = ", ".join("?" for _ in _FIELDS)
        with self._connection:
            self._connection.executemany(
                f"INSERT OR REPLACE INTO {AUDIO_RESOURCES_TABLE} ({', '.join(_FIELDS)}) VALUES ({placeholders})",
                [tuple(row.get(field, "") for field in _FIELDS) for row in rows],
            )

    def page(self, after_kind: str, after_key: str, limit: int) -> List[Dict[str, Any]]:
        """Rows ordered by primary key after ``(after_kind, after_key)``."""
        rows = self._connection.execute(
            f"SELECT {', '.join(_FIELDS)} FROM {AUDIO_RESOURCES_TABLE} "
            "WHERE (kind, resource_key) > (?, ?) ORDER BY kind, resource_key LIMIT ?",
            (after_kind, after_key, max(1, int(limit))),
        ).fetchall()
        return [dict(zip(_FIELDS, values)) for values in rows]

    def count(self) -> int:
        return int(self._connection.execute(f"SELECT COUNT(*) FROM {AUDIO_RESOURCES_TABLE}").fetchone()[0])


__all__ = ["AudioResourceRepository"]
