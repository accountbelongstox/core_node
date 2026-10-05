# -*- coding: utf-8 -*-
from __future__ import annotations

import re
import sqlite3
from pathlib import Path
from typing import Dict, Tuple

from pycore.database.schema.terminal_state_schema import (
    LOG_TEXT_COLUMNS,
    LOG_CONTENT_COLUMN,
    TERMINAL_STATE_LEGACY_TABLE,
)


LEGACY_TEXT_SUFFIX = ".txt"
RETIRED_TERMINAL_SCHEDULE_KEY_SEGMENT = ".queue."
RETIRED_SCHEDULE_FIELD_PREFIX = "queue."
LEGACY_KEY_PATTERN = re.compile(r"^terminal\.(\d+)\.(.+)$")
LEGACY_LOG_KEY_PATTERN = re.compile(
    "^log\\.(\\d+)\\.(" + "|".join((LOG_CONTENT_COLUMN, *LOG_TEXT_COLUMNS)) + ")$"
)

LegacyTerminals = Dict[int, Dict[str, str]]
LegacyLogs = Dict[int, Dict[int, Dict[str, str]]]


def read_legacy_terminal_state(
    connection: sqlite3.Connection,
    legacy_directory: Path,
) -> Tuple[LegacyTerminals, LegacyLogs]:
    """Terminal fields and log entries of the key/value layout: the old table when it exists, the flat text files otherwise."""
    return _group_legacy_values(_legacy_values(connection, legacy_directory))


def _legacy_values(
    connection: sqlite3.Connection,
    legacy_directory: Path,
) -> Dict[str, str]:
    table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (TERMINAL_STATE_LEGACY_TABLE,),
    ).fetchone()
    if table is not None:
        rows = connection.execute(
            f"SELECT key, value FROM {TERMINAL_STATE_LEGACY_TABLE}"
        ).fetchall()
        return {str(key): str(value) for key, value in rows}
    if not legacy_directory.is_dir():
        return {}
    return {
        path.stem: path.read_text(encoding="utf-8", errors="replace")
        for path in sorted(legacy_directory.glob(f"*{LEGACY_TEXT_SUFFIX}"))
        if path.is_file() and RETIRED_TERMINAL_SCHEDULE_KEY_SEGMENT not in path.stem
    }


def _group_legacy_values(
    values: Dict[str, str],
) -> Tuple[LegacyTerminals, LegacyLogs]:
    terminals: LegacyTerminals = {}
    logs: LegacyLogs = {}
    for key, value in values.items():
        key_match = LEGACY_KEY_PATTERN.match(key)
        if key_match is None:
            continue
        terminal_number = int(key_match.group(1))
        field = key_match.group(2)
        if field.startswith(RETIRED_SCHEDULE_FIELD_PREFIX):
            continue
        fields = terminals.setdefault(terminal_number, {})
        log_match = LEGACY_LOG_KEY_PATTERN.match(field)
        if log_match is None:
            fields[field] = value
            continue
        logs.setdefault(terminal_number, {}).setdefault(
            int(log_match.group(1)),
            {},
        )[log_match.group(2)] = value
    return terminals, logs


__all__ = ["read_legacy_terminal_state"]
