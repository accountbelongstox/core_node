# -*- coding: utf-8 -*-
"""SQLite repository of finished task records: an append-only capped ring
(newest kept), one row per record, deduplicated by ``record_id``."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.task_history_schema import (
    TASK_HISTORY_META_TABLE,
    TASK_HISTORY_TABLE,
    init_task_history_schema,
)


class TaskHistoryRepository:
    def __init__(self, database_path: Path) -> None:
        self.path = Path(database_path)
        self._connection = open_wal_connection(database_path, synchronous="NORMAL")
        init_task_history_schema(self._connection)
        self._connection.commit()

    def meta(self, key: str) -> str:
        values = self._connection.execute(
            f"SELECT meta_value FROM {TASK_HISTORY_META_TABLE} WHERE meta_key = ?", (key,),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def append_many(self, rows: Iterable[Dict[str, Any]], max_entries: int, meta: Dict[str, str]) -> int:
        """Append rows oldest first (a row replaces an earlier one with the
        same ``record_id``), trim to the newest ``max_entries``, write meta."""
        written = 0
        with self._connection:
            for row in rows:
                record_id = str(row.get("record_id") or "").strip()
                if record_id:
                    self._connection.execute(
                        f"DELETE FROM {TASK_HISTORY_TABLE} WHERE record_id = ?", (record_id,),
                    )
                self._connection.execute(
                    f"INSERT INTO {TASK_HISTORY_TABLE} (record_id, body) VALUES (?, ?)",
                    (record_id, json.dumps(row, ensure_ascii=False)),
                )
                written += 1
            self._connection.execute(
                f"DELETE FROM {TASK_HISTORY_TABLE} WHERE id <= ("
                f"SELECT id FROM {TASK_HISTORY_TABLE} ORDER BY id DESC LIMIT 1 OFFSET ?)",
                (max(1, int(max_entries)),),
            )
            for key, value in meta.items():
                self._connection.execute(
                    f"INSERT OR REPLACE INTO {TASK_HISTORY_META_TABLE} (meta_key, meta_value) VALUES (?, ?)",
                    (key, str(value)),
                )
        return written

    def list_records(self) -> List[Dict[str, Any]]:
        """Every stored record, newest first."""
        rows = self._connection.execute(f"SELECT body FROM {TASK_HISTORY_TABLE} ORDER BY id DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def clear(self) -> int:
        with self._connection:
            cursor = self._connection.execute(f"DELETE FROM {TASK_HISTORY_TABLE}")
        return int(cursor.rowcount)


__all__ = ["TaskHistoryRepository"]
