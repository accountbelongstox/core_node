# -*- coding: utf-8 -*-
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Generator, Optional, Tuple

from pycore.database.adapters.sqlite_local import connect_writable
from pycore.database.schema.terminal_state_schema import (
    TERMINAL_STATE_TABLE,
    init_terminal_state_schema,
)


SQLITE_BUSY_TIMEOUT_MS = 30000
LEGACY_TEXT_SUFFIX = ".txt"
RETIRED_TERMINAL_SCHEDULE_KEY_SEGMENT = ".queue."


class TerminalStateStore:
    def __init__(self, database_path: Path, legacy_directory: Path) -> None:
        self._legacy_directory = legacy_directory.resolve()
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = connect_writable(
            database_path.resolve(),
            timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
            check_same_thread=False,
        )
        self._connection.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA synchronous=FULL")
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
        values: Dict[str, str] = {}
        if not size_only_key_suffixes:
            rows = self._connection.execute(
                f"SELECT key, value FROM {TERMINAL_STATE_TABLE}"
            ).fetchall()
            return {str(key): str(value) for key, value in rows}
        size_patterns = tuple(f"%{suffix}" for suffix in size_only_key_suffixes)
        size_predicate = " OR ".join("key LIKE ?" for _suffix in size_patterns)
        rows = self._connection.execute(
            f"""
            SELECT key,
                CASE
                    WHEN {size_predicate}
                    THEN length(CAST(value AS BLOB))
                    ELSE value
                END
            FROM {TERMINAL_STATE_TABLE}
            """,
            size_patterns,
        ).fetchall()
        return {str(key): str(value) for key, value in rows}

    def read(self, key: str) -> Optional[str]:
        row = self._connection.execute(
            f"SELECT value FROM {TERMINAL_STATE_TABLE} WHERE key = ?",
            (key,),
        ).fetchone()
        return str(row[0]) if row is not None else None

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
