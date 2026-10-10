# -*- coding: utf-8 -*-
"""Terminal state constants and pure record helpers."""
from __future__ import annotations

import re
from typing import Any, Dict

from pycore.database.schema.terminal_state_schema import DEFAULT_LOG_SOURCE
from pycore.pyfoundations.system_paths import APP_DATA_DIR


TERMINAL_DATA_DIR = APP_DATA_DIR / "terminal_windows"
TERMINAL_DATABASE_NAME = "state.sqlite3"
SLOT_VERSION = "2"
DEFAULT_TERMINAL_NUMBER = 1
MAX_VISIBLE_LOG_ENTRIES = 200
LOG_SOURCES = frozenset(("input", "enter", "schedule", "quick"))
LOG_PREVIEW_MAX_CHARS = 200
WHITESPACE_PATTERN = re.compile(r"\s+")
LIVE_IDENTITY_FIELDS = frozenset(
    ("window_id", "native_id", "app", "class_name", "process_id")
)
# A live title (animated spinners) or rectangle changes many times a second;
# the live window is always returned as observed, so only the stored copy used
# for offline display is written at this bounded rate.
LIVE_VOLATILE_PERSIST_SECONDS = 30.0


def log_preview(text: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", text).strip()[:LOG_PREVIEW_MAX_CHARS]


def log_metadata(
    terminal_number: int,
    log_id: str,
    values: Dict[str, str],
) -> Dict[str, Any]:
    status = str(values.get("status") or "pending")
    return {
        "id": log_id,
        "terminal_number": terminal_number,
        "title": str(values.get("title") or ""),
        "date": str(values.get("date") or ""),
        "status": status,
        "source": str(values.get("source") or DEFAULT_LOG_SOURCE),
        "preview": str(values.get("preview") or ""),
        "success": status == "sent",
        "error_code": str(values.get("error_code") or "") or None,
    }


def next_slot_number(
    records: Dict[int, Dict[str, Any]],
    claimed_terminal_numbers: set[int],
    reserved_terminal_numbers: set[int],
    platform_name: str,
) -> int:
    reusable_numbers = sorted(
        terminal_number
        for terminal_number, record in records.items()
        if terminal_number not in claimed_terminal_numbers
        and str(record.get("platform") or "") == platform_name
    )
    if reusable_numbers:
        return reusable_numbers[0]
    terminal_number = DEFAULT_TERMINAL_NUMBER
    while (
        terminal_number in reserved_terminal_numbers
        or terminal_number in claimed_terminal_numbers
    ):
        terminal_number += 1
    return terminal_number


def is_active_record(
    record: Dict[str, Any],
    records: Dict[int, Dict[str, Any]],
) -> bool:
    """A record merged into another stored terminal is retired until its target is removed."""
    return not (
        str(record.get("merged_into") or "").isdigit()
        and int(record["merged_into"]) != int(record["terminal_number"])
        and int(record["merged_into"]) in records
    )


def active_records(
    records: Dict[int, Dict[str, Any]],
) -> Dict[int, Dict[str, Any]]:
    return {
        terminal_number: record
        for terminal_number, record in records.items()
        if is_active_record(record, records)
    }


def refresh_record_logs(record: Dict[str, Any]) -> None:
    terminal_number = int(record["terminal_number"])
    logs_by_id = record.get("logs_by_id") or {}
    record["logs"] = [
        log_metadata(terminal_number, log_id, log_values)
        for log_id, log_values in sorted(
            logs_by_id.items(),
            key=lambda item: int(item[0]),
            reverse=True,
        )
    ]
