# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, Iterable, List, Tuple

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.repositories.terminal_state_legacy import (
    read_legacy_terminal_state,
)
from pycore.database.schema.terminal_state_schema import (
    DEFAULT_LOG_SOURCE,
    DRAFT_BYTES_COLUMN,
    DRAFT_COLUMN,
    LOG_CONTENT_COLUMN,
    LOG_TABLE,
    LOG_TEXT_COLUMNS,
    MERGED_INTO_COLUMN,
    TERMINAL_INTEGER_COLUMNS,
    TERMINAL_INTEGER_DEFAULTS,
    TERMINAL_STATE_LEGACY_TABLE,
    TERMINAL_STATE_SCHEMA_VERSION,
    TERMINAL_TABLE,
    TERMINAL_TEXT_COLUMNS,
    init_terminal_state_schema,
)


SCALAR_COLUMNS = TERMINAL_TEXT_COLUMNS + TERMINAL_INTEGER_COLUMNS
UPDATABLE_COLUMNS = frozenset((*SCALAR_COLUMNS, MERGED_INTO_COLUMN))
LOG_UPDATABLE_COLUMNS = frozenset(LOG_TEXT_COLUMNS)
LOG_INSERT_COLUMNS = ("terminal_number", "log_id", *LOG_TEXT_COLUMNS, LOG_CONTENT_COLUMN)
LOG_COPY_COLUMNS = ", ".join(LOG_TEXT_COLUMNS + (LOG_CONTENT_COLUMN,))
TERMINAL_JSON_FIELDS = ", ".join(
    f"'{column}', {column}"
    for column in ("terminal_number", *SCALAR_COLUMNS, MERGED_INTO_COLUMN, DRAFT_BYTES_COLUMN)
)
LOG_METADATA_JSON_COLUMNS = ", ".join(("terminal_number", "log_id", *LOG_TEXT_COLUMNS))
DEFAULT_LOG_METADATA = {column: "" for column in LOG_TEXT_COLUMNS}


def _integer(value: Any, default: int) -> int:
    text = str(value if value is not None else "").strip()
    try:
        return int(text)
    except ValueError:
        return default


def _column_value(column: str, value: Any) -> Any:
    if column == MERGED_INTO_COLUMN:
        text = str(value if value is not None else "")
        return int(text) if text.isdigit() else None
    if column in TERMINAL_INTEGER_COLUMNS:
        return _integer(value, TERMINAL_INTEGER_DEFAULTS[column])
    return str(value if value is not None else "")


class TerminalStateStore:
    def __init__(self, database_path: Path, legacy_directory: Path) -> None:
        self._legacy_directory = legacy_directory.resolve()
        self._connection = open_wal_connection(database_path, synchronous="NORMAL")
        init_terminal_state_schema(self._connection)
        self._connection.commit()
        self._migrate_legacy_layout()

    @contextmanager
    def transaction(self) -> Generator[None, None, None]:
        with self._connection:
            yield

    # The sqlite3 module releases the GIL around every fetched row, and each
    # release costs a full interpreter switch interval while other threads are
    # busy, so a bulk read is one aggregate JSON row.
    def load_terminals(self) -> List[Dict[str, Any]]:
        row = self._connection.execute(
            f"SELECT json_group_array(json_object({TERMINAL_JSON_FIELDS})) FROM {TERMINAL_TABLE}"
        ).fetchone()
        terminals = []
        for stored in json.loads(row[0]):
            record: Dict[str, Any] = {"terminal_number": int(stored["terminal_number"])}
            for column in SCALAR_COLUMNS:
                record[column] = str(stored[column])
            if stored[MERGED_INTO_COLUMN] is not None:
                record[MERGED_INTO_COLUMN] = str(stored[MERGED_INTO_COLUMN])
            record[DRAFT_COLUMN] = str(stored[DRAFT_BYTES_COLUMN])
            terminals.append(record)
        return terminals

    def load_log_metadata(self) -> List[Tuple[int, int, Dict[str, str]]]:
        row = self._connection.execute(
            f"SELECT json_group_array(json_array({LOG_METADATA_JSON_COLUMNS})) FROM {LOG_TABLE}"
        ).fetchone()
        return [
            (
                int(stored[0]),
                int(stored[1]),
                {column: str(value) for column, value in zip(LOG_TEXT_COLUMNS, stored[2:])},
            )
            for stored in json.loads(row[0])
        ]

    def insert_terminal(self, record: Dict[str, Any], draft: str = "") -> None:
        columns = ("terminal_number", *SCALAR_COLUMNS, MERGED_INTO_COLUMN, DRAFT_BYTES_COLUMN, DRAFT_COLUMN)
        values = (
            int(record["terminal_number"]),
            *(_column_value(column, record.get(column)) for column in SCALAR_COLUMNS),
            _column_value(MERGED_INTO_COLUMN, record.get(MERGED_INTO_COLUMN)),
            len(draft.encode("utf-8")),
            draft,
        )
        self._connection.execute(
            f"INSERT INTO {TERMINAL_TABLE} ({', '.join(columns)}) "
            f"VALUES ({', '.join('?' for _column in columns)})",
            values,
        )

    def update_terminal(self, terminal_number: int, values: Dict[str, Any]) -> None:
        unknown = set(values) - UPDATABLE_COLUMNS
        if unknown:
            raise ValueError(f"unknown terminal state columns: {sorted(unknown)}")
        if not values:
            return
        assignments = ", ".join(f"{column} = ?" for column in values)
        self._connection.execute(
            f"UPDATE {TERMINAL_TABLE} SET {assignments} WHERE terminal_number = ?",
            (*(_column_value(column, value) for column, value in values.items()), terminal_number),
        )

    def write_draft(self, terminal_number: int, text: str) -> None:
        self._connection.execute(
            f"UPDATE {TERMINAL_TABLE} SET {DRAFT_COLUMN} = ?, {DRAFT_BYTES_COLUMN} = ? "
            "WHERE terminal_number = ?",
            (text, len(text.encode("utf-8")), terminal_number),
        )

    def copy_draft(self, source_number: int, target_number: int) -> None:
        self._connection.execute(
            f"""
            UPDATE {TERMINAL_TABLE} SET
                {DRAFT_COLUMN} = (SELECT source.{DRAFT_COLUMN} FROM {TERMINAL_TABLE} AS source WHERE source.terminal_number = ?),
                {DRAFT_BYTES_COLUMN} = (SELECT source.{DRAFT_BYTES_COLUMN} FROM {TERMINAL_TABLE} AS source WHERE source.terminal_number = ?)
            WHERE terminal_number = ?
            """,
            (source_number, source_number, target_number),
        )

    def insert_log(
        self,
        terminal_number: int,
        log_id: int,
        values: Dict[str, str],
        content: str,
    ) -> None:
        self._connection.execute(
            f"INSERT INTO {LOG_TABLE} ({', '.join(LOG_INSERT_COLUMNS)}) "
            f"VALUES ({', '.join('?' for _column in LOG_INSERT_COLUMNS)})",
            (
                terminal_number,
                log_id,
                *(str(values.get(column) or "") for column in LOG_TEXT_COLUMNS),
                content,
            ),
        )

    def update_log(self, terminal_number: int, log_id: int, values: Dict[str, str]) -> None:
        unknown = set(values) - LOG_UPDATABLE_COLUMNS
        if unknown:
            raise ValueError(f"unknown terminal log columns: {sorted(unknown)}")
        if not values:
            return
        assignments = ", ".join(f"{column} = ?" for column in values)
        self._connection.execute(
            f"UPDATE {LOG_TABLE} SET {assignments} WHERE terminal_number = ? AND log_id = ?",
            (*(str(value) for value in values.values()), terminal_number, log_id),
        )

    def copy_missing_logs(self, source_number: int, target_number: int) -> None:
        self._connection.execute(
            f"""
            INSERT OR IGNORE INTO {LOG_TABLE} (terminal_number, log_id, {LOG_COPY_COLUMNS})
            SELECT ?, log_id, {LOG_COPY_COLUMNS} FROM {LOG_TABLE} WHERE terminal_number = ?
            """,
            (target_number, source_number),
        )

    def delete_terminals(self, terminal_numbers: Iterable[int]) -> None:
        numbers = sorted(set(terminal_numbers))
        if not numbers:
            return
        placeholders = ", ".join("?" for _number in numbers)
        self._connection.execute(
            f"DELETE FROM {LOG_TABLE} WHERE terminal_number IN ({placeholders})",
            numbers,
        )
        self._connection.execute(
            f"DELETE FROM {TERMINAL_TABLE} WHERE terminal_number IN ({placeholders})",
            numbers,
        )

    def data_version(self) -> int:
        return int(self._connection.execute("PRAGMA data_version").fetchone()[0])

    def _schema_current(self) -> bool:
        stored = self._connection.execute("PRAGMA user_version").fetchone()[0]
        return int(stored) >= TERMINAL_STATE_SCHEMA_VERSION

    def _migrate_legacy_layout(self) -> None:
        if self._schema_current():
            return
        self._connection.execute("BEGIN IMMEDIATE")
        with self._connection:
            if self._schema_current():
                return
            terminals, logs = read_legacy_terminal_state(
                self._connection,
                self._legacy_directory,
            )
            for terminal_number, fields in sorted(terminals.items()):
                self.insert_terminal(
                    {"terminal_number": terminal_number, **fields},
                    fields.get(DRAFT_COLUMN, ""),
                )
            for terminal_number, entries in sorted(logs.items()):
                for log_id, entry in sorted(entries.items()):
                    self.insert_log(
                        terminal_number,
                        log_id,
                        {
                            **DEFAULT_LOG_METADATA,
                            "source": DEFAULT_LOG_SOURCE,
                            **entry,
                        },
                        entry.get(LOG_CONTENT_COLUMN, ""),
                    )
            self._connection.execute(f"DROP TABLE IF EXISTS {TERMINAL_STATE_LEGACY_TABLE}")
            self._connection.execute(f"PRAGMA user_version = {TERMINAL_STATE_SCHEMA_VERSION}")


__all__ = ["TerminalStateStore"]
