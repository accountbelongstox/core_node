# -*- coding: utf-8 -*-
"""Terminal state key schema: constants, key builders and pure record parsing."""
from __future__ import annotations

import re
from typing import Any, Dict, Tuple

from pycore.pyfoundations.system_paths import APP_DATA_DIR


TERMINAL_DATA_DIR = APP_DATA_DIR / "terminal_windows"
TERMINAL_DATABASE_NAME = "state.sqlite3"
NEXT_NUMBER_KEY = "next_number"
SLOT_VERSION = "2"
DEFAULT_TERMINAL_NUMBER = 1
MAX_VISIBLE_LOG_ENTRIES = 200
TERMINAL_KEY_PATTERN = re.compile(r"^terminal\.(\d+)\.(.+)$")
LOG_KEY_PATTERN = re.compile(
    r"^log\.(\d+)\.(content|date|error_code|preview|source|status|title)$"
)
LOG_ENTRY_FIELDS = (
    "content", "date", "error_code", "preview", "source", "status", "title",
)
LOG_SOURCES = frozenset(("input", "enter", "schedule"))
DEFAULT_LOG_SOURCE = "input"
LOG_PREVIEW_MAX_CHARS = 200
LOG_CONTENT_KEY_SUFFIX = ".content"
WHITESPACE_PATTERN = re.compile(r"\s+")
SIZE_ONLY_KEY_SUFFIXES = (".content", ".draft", ".message")
RETIRED_SCHEDULE_FIELD_PREFIX = "queue."
LIVE_IDENTITY_FIELDS = frozenset(
    ("window_id", "native_id", "app", "class_name", "process_id")
)
# A live title (animated spinners) or rectangle changes many times a second;
# persisting each change costs one synchronous SQLite commit. The live window
# is always returned as observed, so only the stored copy used for offline
# display is written at this bounded rate.
LIVE_VOLATILE_PERSIST_SECONDS = 30.0


def log_preview(text: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", text).strip()[:LOG_PREVIEW_MAX_CHARS]


def terminal_key(terminal_number: int, field: str) -> str:
    return f"terminal.{terminal_number:06d}.{field}"


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


def stored_terminal_numbers(values: Dict[str, str]) -> set[int]:
    terminal_numbers = set()
    for key in values:
        key_match = TERMINAL_KEY_PATTERN.match(key)
        if key_match is not None:
            terminal_numbers.add(int(key_match.group(1)))
    return terminal_numbers


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


def active_records(
    records: Dict[int, Dict[str, Any]],
) -> Dict[int, Dict[str, Any]]:
    return {
        terminal_number: record
        for terminal_number, record in records.items()
        if not (
            str(record.get("merged_into") or "").isdigit()
            and int(record["merged_into"]) != terminal_number
            and int(record["merged_into"]) in records
        )
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


def parse_records(
    values: Dict[str, str],
) -> Tuple[Dict[int, Dict[str, Any]], int]:
    """Group flat key/value rows into per-terminal records; returns (active records, next number)."""
    records: Dict[int, Dict[str, Any]] = {}
    for key, value in values.items():
        key_match = TERMINAL_KEY_PATTERN.match(key)
        if key_match is None:
            continue
        terminal_number = int(key_match.group(1))
        field = key_match.group(2)
        if field.startswith(RETIRED_SCHEDULE_FIELD_PREFIX):
            continue
        record = records.setdefault(
            terminal_number,
            {
                "terminal_number": terminal_number,
                "logs_by_id": {},
            },
        )
        log_match = LOG_KEY_PATTERN.match(field)
        if log_match is not None:
            log_id = log_match.group(1)
            log_field = log_match.group(2)
            record["logs_by_id"].setdefault(log_id, {})[log_field] = value
            continue
        record[field] = value

    maximum_terminal_number = max(records, default=0)
    stored_next_number = values.get(NEXT_NUMBER_KEY, "")
    next_number = (
        int(stored_next_number)
        if stored_next_number.isdigit()
        else DEFAULT_TERMINAL_NUMBER
    )
    next_number = max(next_number, maximum_terminal_number + 1)
    for record in records.values():
        refresh_record_logs(record)
    return active_records(records), next_number
