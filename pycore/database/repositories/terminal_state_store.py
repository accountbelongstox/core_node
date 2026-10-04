# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Generator, List, Optional, Tuple

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.terminal_state_schema import (
    TERMINAL_STATE_TABLE,
    init_terminal_state_schema,
)


LEGACY_TEXT_SUFFIX = ".txt"
RETIRED_TERMINAL_SCHEDULE_KEY_SEGMENT = ".queue."


class TerminalStateStore:
    def __init__(self, database_path: Path, legacy_directory: Path) -> None:
        self._legacy_directory = legacy_directory.resolve()
        self._connection = open_wal_connection(database_path, synchronous="FULL")
        init_terminal_state_schema(self._connection)
        self._connection.commit()
        self._import_legacy_values()

    @contextmanager
    def transaction(self) -> Generator[None, None, None]:
        with self._connection:
            yield

    def scan(
        self,
        size_only_key_suffixes: Tuple[str, ...] = (),
    ) -> Dict[str, str]:
        # One aggregate row: the sqlite3 module releases the GIL around every
        # fetched row, and each release costs a full interpreter switch
        # interval while other threads are busy, so a row-per-key result took
        # seconds inside a loaded process.
        if not size_only_key_suffixes:
            row = self._connection.execute(
                f"SELECT json_group_object(key, value) FROM {TERMINAL_STATE_TABLE}"
            ).fetchone()
            return {str(key): str(value) for key, value in json.loads(row[0]).items()}
        size_patterns = tuple(f"%{suffix}" for suffix in size_only_key_suffixes)
        size_predicate = " OR ".join("key LIKE ?" for _suffix in size_patterns)
        row = self._connection.execute(
            f"""
            SELECT json_group_object(key,
                CASE
                    WHEN {size_predicate}
                    THEN length(CAST(value AS BLOB))
                    ELSE value
                END)
            FROM {TERMINAL_STATE_TABLE}
            """,
            size_patterns,
        ).fetchone()
        return {str(key): str(value) for key, value in json.loads(row[0]).items()}

    def read(self, key: str) -> Optional[str]:
        row = self._connection.execute(
            f"SELECT value FROM {TERMINAL_STATE_TABLE} WHERE key = ?",
            (key,),
        ).fetchone()
        return str(row[0]) if row is not None else None

    def search_values(self, key_suffix: str, needle: str) -> List[Tuple[str, str]]:
        """(key, value) of the keys ending in key_suffix whose value contains needle (ASCII case-insensitive)."""
        rows = self._connection.execute(
            f"SELECT key, value FROM {TERMINAL_STATE_TABLE} WHERE key LIKE ? AND instr(lower(value), lower(?)) > 0",
            (f"%{key_suffix}", needle),
        ).fetchall()
        return [(str(key), str(value)) for key, value in rows]

    def delete(self, key: str) -> None:
        self._connection.execute(
            f"DELETE FROM {TERMINAL_STATE_TABLE} WHERE key = ?",
            (key,),
        )

    def write(
        self,
        key: str,
        value: str,
        known_values: Optional[Dict[str, str]] = None,
    ) -> None:
        if known_values is not None and known_values.get(key) == value:
            return
        self._connection.execute(
            f"""
            INSERT INTO {TERMINAL_STATE_TABLE} (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            WHERE value <> excluded.value
            """,
            (key, value),
        )
        if known_values is not None:
            known_values[key] = value

    def _import_legacy_values(self) -> None:
        if not self._legacy_directory.is_dir():
            return
        paths = sorted(self._legacy_directory.glob(f"*{LEGACY_TEXT_SUFFIX}"))
        if not paths:
            return
        with self.transaction():
            for path in paths:
                if (
                    not path.is_file()
                    or RETIRED_TERMINAL_SCHEDULE_KEY_SEGMENT in path.stem
                ):
                    continue
                self._connection.execute(
                    f"""
                    INSERT OR IGNORE INTO {TERMINAL_STATE_TABLE} (key, value)
                    VALUES (?, ?)
                    """,
                    (
                        path.stem,
                        path.read_text(encoding="utf-8", errors="replace"),
                    ),
                )


__all__ = ["TerminalStateStore"]
