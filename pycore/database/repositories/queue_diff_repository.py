# -*- coding: utf-8 -*-
"""Indexed SQLite repository of the claimed-task staging of the typed
Laravel pull: one row per ``(scope, task_id)`` and one remote cursor per
``(scope, task_type)``. Every write touches only its own rows."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.queue_diff_schema import (
    QUEUE_DIFF_CURSORS_TABLE,
    QUEUE_DIFF_TASKS_TABLE,
    init_queue_diff_schema,
)


SQLITE_IN_LIMIT = 500


def _encode(task: Dict[str, Any]) -> str:
    return json.dumps(task, ensure_ascii=False, separators=(",", ":"), default=str)


class QueueDiffRepository:
    def __init__(self, database_path: Path) -> None:
        self._connection = open_wal_connection(database_path)
        init_queue_diff_schema(self._connection)
        self._connection.commit()

    def remote_cursor(self, scope: str, task_type: str) -> int:
        row = self._connection.execute(
            f"SELECT revision FROM {QUEUE_DIFF_CURSORS_TABLE} WHERE scope = ? AND task_type = ?",
            (scope, task_type),
        ).fetchone()
        return int(row[0]) if row is not None else 0

    def set_remote_cursor(self, scope: str, task_type: str, revision: int) -> None:
        with self._connection:
            self._connection.execute(
                f"INSERT OR REPLACE INTO {QUEUE_DIFF_CURSORS_TABLE} (scope, task_type, revision, updated_at) "
                "VALUES (?, ?, ?, ?)",
                (scope, task_type, max(0, int(revision)), time.time()),
            )

    def forget_worker(self, worker_id: str) -> int:
        """Rows and cursors of every scope that embeds ``worker_id``."""
        marker = f":{worker_id}:"
        with self._connection:
            dropped = self._connection.execute(
                f"DELETE FROM {QUEUE_DIFF_TASKS_TABLE} WHERE instr(scope, ?) > 0", (marker,),
            ).rowcount
            dropped += self._connection.execute(
                f"DELETE FROM {QUEUE_DIFF_CURSORS_TABLE} WHERE instr(scope, ?) > 0", (marker,),
            ).rowcount
        return int(dropped)

    def count(self, scope: str) -> int:
        return int(self._connection.execute(
            f"SELECT COUNT(*) FROM {QUEUE_DIFF_TASKS_TABLE} WHERE scope = ?", (scope,),
        ).fetchone()[0])

    def insert_new(self, scope: str, tasks: List[Dict[str, Any]], room: int) -> List[Dict[str, Any]]:
        """Insert the tasks the scope does not hold yet (at most ``room``);
        returns the ones inserted."""
        inserted: List[Dict[str, Any]] = []
        now = time.time()
        with self._connection:
            for task in tasks:
                if len(inserted) >= room:
                    break
                cursor = self._connection.execute(
                    f"INSERT OR IGNORE INTO {QUEUE_DIFF_TASKS_TABLE} (scope, task_id, task_type, body, staged_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (scope, str(task["task_id"]), str(task.get("task_type") or ""), _encode(task), now),
                )
                if cursor.rowcount:
                    inserted.append(task)
        return inserted

    def tasks(self, scope: str, task_types: List[str]) -> List[Dict[str, Any]]:
        """Staged tasks of one scope restricted to ``task_types``."""
        rows: List[Dict[str, Any]] = []
        for start in range(0, len(task_types), SQLITE_IN_LIMIT):
            chunk = task_types[start:start + SQLITE_IN_LIMIT]
            marks = ", ".join("?" for _ in chunk)
            rows.extend(
                json.loads(values[0]) for values in self._connection.execute(
                    f"SELECT body FROM {QUEUE_DIFF_TASKS_TABLE} WHERE scope = ? AND task_type IN ({marks})",
                    (scope, *chunk),
                ).fetchall()
            )
        return rows

    def task(self, scope: str, task_id: str) -> Optional[Dict[str, Any]]:
        row = self._connection.execute(
            f"SELECT body FROM {QUEUE_DIFF_TASKS_TABLE} WHERE scope = ? AND task_id = ?", (scope, task_id),
        ).fetchone()
        return json.loads(row[0]) if row is not None else None

    def replace_body(self, scope: str, task_id: str, task: Dict[str, Any]) -> None:
        with self._connection:
            self._connection.execute(
                f"UPDATE {QUEUE_DIFF_TASKS_TABLE} SET body = ? WHERE scope = ? AND task_id = ?",
                (_encode(task), scope, task_id),
            )

    def delete(self, scope: str, task_ids: List[str]) -> None:
        with self._connection:
            for start in range(0, len(task_ids), SQLITE_IN_LIMIT):
                chunk = task_ids[start:start + SQLITE_IN_LIMIT]
                marks = ", ".join("?" for _ in chunk)
                self._connection.execute(
                    f"DELETE FROM {QUEUE_DIFF_TASKS_TABLE} WHERE scope = ? AND task_id IN ({marks})",
                    (scope, *chunk),
                )


__all__ = ["QueueDiffRepository"]
