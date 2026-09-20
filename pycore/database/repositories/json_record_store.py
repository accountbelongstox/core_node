# -*- coding: utf-8 -*-

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, Optional

from pycore.database.adapters.sqlite_local import connect_writable
from pycore.database.models.table_keys import TableKeys


JSON_RECORD_TABLE = '"' + TableKeys.JSON_RECORDS + '"'
JSON_RECORD_MIGRATION_KEY = ""


class JsonRecordStore:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = connect_writable(path.resolve())
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA synchronous=FULL")
        with self._connection:
            self._connection.execute(
                f"CREATE TABLE IF NOT EXISTS {JSON_RECORD_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        row = self._connection.execute(
            f"SELECT value FROM {JSON_RECORD_TABLE} WHERE key = ?", (key,),
        ).fetchone()
        return json.loads(row[0]) if row is not None else None

    def put(self, key: str, value: Dict[str, Any]) -> None:
        with self.transaction():
            self._write(key, value)

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if self._connection.in_transaction:
            yield
            return
        with self._connection:
            self._connection.execute("BEGIN IMMEDIATE")
            yield

    def _write(self, key: str, value: Dict[str, Any]) -> None:
        self._connection.execute(
            f"INSERT INTO {JSON_RECORD_TABLE} (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(value, ensure_ascii=True, separators=(",", ":"))),
        )

    def delete(self, key: str) -> None:
        with self.transaction():
            self._connection.execute(f"DELETE FROM {JSON_RECORD_TABLE} WHERE key = ?", (key,))

    def records(self) -> Dict[str, Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT key, value FROM {JSON_RECORD_TABLE} WHERE key <> ?", (JSON_RECORD_MIGRATION_KEY,),
        ).fetchall()
        return {key: json.loads(value) for key, value in rows}

    def migration_complete(self) -> bool:
        return self.get(JSON_RECORD_MIGRATION_KEY) is not None

    def import_once(self, records: Dict[str, Dict[str, Any]]) -> None:
        with self.transaction():
            if self.migration_complete():
                return
            for key, record in records.items():
                self._connection.execute(
                    f"INSERT OR IGNORE INTO {JSON_RECORD_TABLE} (key, value) VALUES (?, ?)",
                    (key, json.dumps(record, ensure_ascii=True, separators=(",", ":"))),
                )
            self._write(JSON_RECORD_MIGRATION_KEY, {"complete": True})
