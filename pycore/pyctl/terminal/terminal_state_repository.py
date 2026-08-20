# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import re
import time
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.database.repositories.terminal_state_store import TerminalStateStore
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_DATA_DIR


TERMINAL_DATA_DIR = APP_DATA_DIR / "terminal_windows"
TERMINAL_DATABASE_NAME = "state.sqlite3"
NEXT_NUMBER_KEY = "next_number"
SLOT_VERSION = "2"
DEFAULT_TERMINAL_NUMBER = 1
MAX_VISIBLE_LOG_ENTRIES = 200
TERMINAL_KEY_PATTERN = re.compile(r"^terminal\.(\d+)\.(.+)$")
LOG_KEY_PATTERN = re.compile(r"^log\.(\d+)\.(content|date|error_code|status|title)$")
LOG_ENTRY_FIELDS = ("content", "date", "error_code", "status", "title")
QUEUE_KEY_PATTERN = re.compile(
    r"^queue\.(\d+)\.(created_at|fire_count|interval_seconds|last_run_at"
    r"|message|mode|next_run_at|preview|run_at)$"
)
QUEUE_ENTRY_FIELDS = (
    "created_at",
    "fire_count",
    "interval_seconds",
    "last_run_at",
    "message",
    "mode",
    "next_run_at",
    "preview",
    "run_at",
)
QUEUE_SORT_FAR_FUTURE_MS = 2**62
SIZE_ONLY_KEY_SUFFIXES = (".content", ".draft", ".message")
SCHEDULE_ACTIVE_MODES = {"once", "interval"}
SCHEDULE_PREVIEW_MAX_LENGTH = 80


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _transactional_store_method(
    method: Callable[..., Any],
) -> Callable[..., Any]:
    @wraps(method)
    def wrapper(owner: Any, *args: Any, **kwargs: Any) -> Any:
        with owner._store.transaction():
            return method(owner, *args, **kwargs)
    return wrapper


class TerminalStateRepository:
    def __init__(self, data_dir: Path = TERMINAL_DATA_DIR) -> None:
        self._store = TerminalStateStore(
            data_dir / TERMINAL_DATABASE_NAME,
            data_dir,
        )
        init_serialized_owner(
            self,
            "terminal.state",
            "TerminalStateRepository",
        )

    @serialized_method
    @_transactional_store_method
    def reconcile_windows(
        self,
        platform_name: str,
        windows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        values, records, _next_number = self._scan_records()
        records_by_window_key = {
            str(record.get("window_key") or ""): record
            for record in records.values()
            if record.get("window_key")
        }
        reserved_terminal_numbers = self._stored_terminal_numbers(values)
        claimed_terminal_numbers = set()
        assignments: List[Tuple[Dict[str, Any], int, str]] = []
        reconciled_windows: List[Dict[str, Any]] = []
        now = _now_iso()

        for window in windows:
            live_window = copy.deepcopy(window)
            window_key = self._window_key(platform_name, live_window)
            source_record = records_by_window_key.get(window_key)
            record = (
                source_record
                if source_record is not None
                and str(source_record.get("slot_version") or "") == SLOT_VERSION
                else None
            )
            if (
                record is None
                or int(record["terminal_number"]) in claimed_terminal_numbers
            ):
                terminal_number = self._next_slot_number(
                    records,
                    claimed_terminal_numbers,
                    reserved_terminal_numbers,
                    platform_name,
                )
                record = records.get(terminal_number)
            else:
                terminal_number = int(record["terminal_number"])
            if record is None:
                record = self._new_record(
                    terminal_number,
                    platform_name,
                    window_key,
                    live_window,
                    now,
                )
                records[terminal_number] = record
                reserved_terminal_numbers.add(terminal_number)
                self._write_record_fields(values, record)
            if (
                source_record is not None
                and int(source_record["terminal_number"]) != terminal_number
            ):
                self._merge_record_state(
                    values,
                    record,
                    source_record,
                    now,
                )
            record["slot_version"] = SLOT_VERSION
            self._write_value(
                values,
                self._terminal_key(terminal_number, "slot_version"),
                SLOT_VERSION,
            )
            claimed_terminal_numbers.add(terminal_number)
            assignments.append((live_window, terminal_number, window_key))

        self._write_value(
            values,
            NEXT_NUMBER_KEY,
            str(max(reserved_terminal_numbers, default=0) + 1),
        )
        values, records, _next_number = self._scan_records()
        for live_window, terminal_number, window_key in assignments:
            record = records[terminal_number]
            record["window_key"] = window_key
            self._write_value(
                values,
                self._terminal_key(terminal_number, "window_key"),
                window_key,
            )
            self._update_live_record(values, record, live_window, now)
            reconciled_windows.append(
                self._decorate_live_window(live_window, record)
            )

        for terminal_number in sorted(records):
            record = records[terminal_number]
            if str(record.get("platform") or "") != platform_name:
                continue
            if terminal_number in claimed_terminal_numbers:
                continue
            if not self._has_retained_state(record):
                continue
            reconciled_windows.append(self._build_offline_window(record))
        reconciled_windows.sort(
            key=lambda window: int(window["terminal_number"]),
        )
        return reconciled_windows

    @staticmethod
    def _next_slot_number(
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

    @staticmethod
    def _stored_terminal_numbers(values: Dict[str, str]) -> set[int]:
        terminal_numbers = set()
        for key in values:
            key_match = TERMINAL_KEY_PATTERN.match(key)
            if key_match is not None:
                terminal_numbers.add(int(key_match.group(1)))
        return terminal_numbers

    @serialized_method
    @_transactional_store_method
    def save_draft(self, terminal_number: int, text: str) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        now = _now_iso()
        self._write_value(
            values,
            self._terminal_key(terminal_number, "draft"),
            text,
        )
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            now,
        )
        return {
            "success": True,
            "terminal_number": terminal_number,
            "has_draft": bool(text),
        }

    @serialized_method
    @_transactional_store_method
    def save_preview_expanded(
        self,
        terminal_number: int,
        expanded: bool,
    ) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        if terminal_number not in records:
            return {"success": False, "error_code": "terminal_state_not_found"}
        now = _now_iso()
        self._write_value(
            values,
            self._terminal_key(terminal_number, "preview_expanded"),
            "1" if expanded else "0",
        )
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            now,
        )
        return {
            "success": True,
            "terminal_number": terminal_number,
            "preview_expanded": expanded,
        }

    @serialized_method
    @_transactional_store_method
    def begin_submission(
        self,
        terminal_number: int,
        text: str,
        update_draft: bool = True,
    ) -> Optional[Dict[str, Any]]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return None

        log_id = str(time.time_ns())
        now = _now_iso()
        log_prefix = f"log.{log_id}"
        log_values = {
            "content": text,
            "date": now,
            "error_code": "",
            "status": "pending",
            "title": str(record.get("title") or ""),
        }
        for field, value in log_values.items():
            self._write_value(
                values,
                self._terminal_key(terminal_number, f"{log_prefix}.{field}"),
                value,
            )
        if update_draft:
            self._write_value(
                values,
                self._terminal_key(terminal_number, "draft"),
                text,
            )
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            now,
        )
        return self._log_metadata(
            terminal_number,
            log_id,
            log_values,
        )

    @serialized_method
    @_transactional_store_method
    def complete_submission(
        self,
        terminal_number: int,
        log_id: str,
        success: bool,
        error_code: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        log = (record or {}).get("logs_by_id", {}).get(log_id)
        if record is None or not isinstance(log, dict):
            return None

        status = "sent" if success else "failed"
        now = _now_iso()
        self._write_value(
            values,
            self._terminal_key(terminal_number, f"log.{log_id}.status"),
            status,
        )
        self._write_value(
            values,
            self._terminal_key(terminal_number, f"log.{log_id}.error_code"),
            str(error_code or ""),
        )
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            now,
        )
        if success:
            self._write_value(
                values,
                self._terminal_key(terminal_number, "draft"),
                "",
            )
        completed_values = {
            **log,
            "status": status,
            "error_code": str(error_code or ""),
        }
        return self._log_metadata(
            terminal_number,
            log_id,
            completed_values,
        )

    @serialized_method
    def read_text(
        self,
        terminal_number: int,
        content_kind: str,
        log_id: str = "",
    ) -> Optional[str]:
        values, records, _next_number = self._scan_records()
        if terminal_number not in records:
            return None
        if content_kind == "draft":
            key = self._terminal_key(terminal_number, "draft")
        elif content_kind == "log" and log_id.isdigit():
            key = self._terminal_key(terminal_number, f"log.{log_id}.content")
        elif content_kind == "schedule" and log_id.isdigit():
            key = self._terminal_key(terminal_number, f"queue.{log_id}.message")
        else:
            return None
        content = self._store.read(key)
        if content is not None:
            return content
        return "" if content_kind in {"draft", "schedule"} else None

    @serialized_method
    @_transactional_store_method
    def sync_schedule_entries(
        self,
        terminal_number: int,
        entries: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}

        existing_entries = record.get("queue_by_id") or {}
        desired_ids = {str(entry["id"]) for entry in entries}
        changed = False
        now = _now_iso()
        for entry_id in set(existing_entries) - desired_ids:
            self._delete_schedule_entry(values, terminal_number, entry_id)
            changed = True

        for entry in entries:
            entry_id = str(entry["id"])
            existing = existing_entries.get(entry_id)
            message = str(entry.get("message") or "")
            mode = str(entry["mode"])
            run_at = int(entry["run_at"])
            next_run_at = int(entry["next_run_at"])
            interval_seconds = int(entry["interval_seconds"])
            definition_values = self._schedule_definition_values(
                mode,
                run_at,
                next_run_at,
                interval_seconds,
                message,
            )
            if existing is None:
                entry_values = {
                    **definition_values,
                    "created_at": now,
                    "fire_count": "0",
                    "last_run_at": "",
                }
            elif self._schedule_definition_matches(
                terminal_number,
                entry_id,
                existing,
                definition_values,
            ):
                continue
            else:
                entry_values = definition_values
            self._write_schedule_entry(
                values,
                terminal_number,
                entry_id,
                entry_values,
            )
            changed = True

        if changed:
            self._write_value(
                values,
                self._terminal_key(terminal_number, "updated_at"),
                now,
            )
        _updated_values, updated_records, _updated_next_number = (
            self._scan_records()
        )
        updated_record = updated_records.get(terminal_number) or {}
        return {
            "success": True,
            "terminal_number": terminal_number,
            "entries": list(updated_record.get("queue") or []),
        }

    @serialized_method
    @_transactional_store_method
    def clear_schedule_entries(self) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        cleared_terminal_numbers: List[int] = []
        cleared_entry_count = 0
        now = _now_iso()

        for terminal_number in sorted(records):
            queue_by_id = records[terminal_number].get("queue_by_id") or {}
            entry_ids = list(queue_by_id)
            if not entry_ids:
                continue
            for entry_id in entry_ids:
                self._delete_schedule_entry(values, terminal_number, entry_id)
            self._write_value(
                values,
                self._terminal_key(terminal_number, "updated_at"),
                now,
            )
            cleared_terminal_numbers.append(terminal_number)
            cleared_entry_count += len(entry_ids)
        return {
            "success": True,
            "cleared_entry_count": cleared_entry_count,
            "terminal_numbers": cleared_terminal_numbers,
        }

    @serialized_method
    def due_schedules(self, now_ms: int) -> List[Dict[str, Any]]:
        _values, records, _next_number = self._scan_records()
        due: List[Dict[str, Any]] = []
        for terminal_number in sorted(records):
            record = records[terminal_number]
            window_id = str(record.get("window_id") or "")
            queue_by_id = record.get("queue_by_id") or {}
            for entry_id in sorted(queue_by_id, key=int):
                entry_values = queue_by_id[entry_id]
                mode = str(entry_values.get("mode") or "")
                if mode not in SCHEDULE_ACTIVE_MODES:
                    continue
                next_run_raw = str(entry_values.get("next_run_at") or "")
                if not next_run_raw.isdigit():
                    continue
                next_run_at = int(next_run_raw)
                if next_run_at > now_ms:
                    continue
                message = self._store.read(
                    self._terminal_key(
                        terminal_number,
                        f"queue.{entry_id}.message",
                    ),
                ) or ""
                interval_raw = str(entry_values.get("interval_seconds") or "")
                due.append({
                    "terminal_number": terminal_number,
                    "window_id": window_id,
                    "entry_id": entry_id,
                    "mode": mode,
                    "interval_seconds": (
                        int(interval_raw) if interval_raw.isdigit() else 0
                    ),
                    "next_run_at": next_run_at,
                    "message": message,
                })
        return due

    @serialized_method
    @_transactional_store_method
    def advance_schedule(
        self,
        terminal_number: int,
        entry_id: str,
        mode: str,
        interval_seconds: int,
        now_ms: int,
    ) -> None:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return
        entry_values = (record.get("queue_by_id") or {}).get(entry_id)
        if entry_values is None:
            return
        now = _now_iso()
        if mode == "interval" and interval_seconds > 0:
            fire_count_raw = str(entry_values.get("fire_count") or "")
            fire_count = int(fire_count_raw) if fire_count_raw.isdigit() else 0
            updates = {
                "next_run_at": str(now_ms + interval_seconds * 1000),
                "fire_count": str(fire_count + 1),
                "last_run_at": str(now_ms),
            }
            for field, value in updates.items():
                self._write_value(
                    values,
                    self._terminal_key(
                        terminal_number,
                        f"queue.{entry_id}.{field}",
                    ),
                    value,
                )
        else:
            self._delete_schedule_entry(values, terminal_number, entry_id)
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            now,
        )

    @serialized_method
    @_transactional_store_method
    def defer_schedule(
        self,
        terminal_number: int,
        entry_id: str,
        next_run_at_ms: int,
    ) -> None:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return
        entry_values = (record.get("queue_by_id") or {}).get(entry_id)
        if entry_values is None:
            return
        self._write_value(
            values,
            self._terminal_key(
                terminal_number,
                f"queue.{entry_id}.next_run_at",
            ),
            str(int(next_run_at_ms)),
        )
        self._write_value(
            values,
            self._terminal_key(terminal_number, "updated_at"),
            _now_iso(),
        )

    @serialized_method
    def next_scheduled_run(self) -> Optional[int]:
        _values, records, _next_number = self._scan_records()
        candidates: List[int] = []
        for record in records.values():
            for entry_values in (record.get("queue_by_id") or {}).values():
                mode = str(entry_values.get("mode") or "")
                if mode not in SCHEDULE_ACTIVE_MODES:
                    continue
                next_run_raw = str(entry_values.get("next_run_at") or "")
                if next_run_raw.isdigit():
                    candidates.append(int(next_run_raw))
        return min(candidates) if candidates else None

    def _merge_record_state(
        self,
        values: Dict[str, str],
        target: Dict[str, Any],
        source: Dict[str, Any],
        now: str,
    ) -> None:
        target_number = int(target["terminal_number"])
        source_number = int(source["terminal_number"])
        target_draft_size = int(target.get("draft") or 0)
        source_draft_size = int(source.get("draft") or 0)
        target_logs = target.get("logs_by_id") or {}
        source_logs = source.get("logs_by_id") or {}
        target_queue = target.get("queue_by_id") or {}
        source_queue = source.get("queue_by_id") or {}

        if target_draft_size == 0 and source_draft_size > 0:
            source_draft = self._store.read(
                self._terminal_key(source_number, "draft"),
            ) or ""
            self._write_value(
                values,
                self._terminal_key(target_number, "draft"),
                source_draft,
            )

        if str(source.get("preview_expanded") or "0") == "1":
            self._write_value(
                values,
                self._terminal_key(target_number, "preview_expanded"),
                "1",
            )

        self._merge_nested_entries(
            values,
            target_number,
            source_number,
            "log",
            LOG_ENTRY_FIELDS,
            target_logs,
            source_logs,
        )
        self._merge_nested_entries(
            values,
            target_number,
            source_number,
            "queue",
            QUEUE_ENTRY_FIELDS,
            target_queue,
            source_queue,
        )
        self._write_value(
            values,
            self._terminal_key(target_number, "updated_at"),
            now,
        )
        self._write_value(
            values,
            self._terminal_key(source_number, "merged_into"),
            str(target_number),
        )

    def _merge_nested_entries(
        self,
        values: Dict[str, str],
        target_number: int,
        source_number: int,
        entry_kind: str,
        entry_fields: Tuple[str, ...],
        target_entries: Dict[str, Dict[str, str]],
        source_entries: Dict[str, Dict[str, str]],
    ) -> None:
        for entry_id, entry_values in source_entries.items():
            if entry_id in target_entries:
                continue
            for field in entry_fields:
                source_key = self._terminal_key(
                    source_number,
                    f"{entry_kind}.{entry_id}.{field}",
                )
                value = (
                    self._store.read(source_key)
                    if source_key.endswith(SIZE_ONLY_KEY_SUFFIXES)
                    else entry_values.get(field)
                )
                if value is None:
                    continue
                self._write_value(
                    values,
                    self._terminal_key(
                        target_number,
                        f"{entry_kind}.{entry_id}.{field}",
                    ),
                    str(value),
                )

    def _scan_records(
        self,
    ) -> Tuple[Dict[str, str], Dict[int, Dict[str, Any]], int]:
        values = self._scan_values()
        records: Dict[int, Dict[str, Any]] = {}
        for key, value in values.items():
            key_match = TERMINAL_KEY_PATTERN.match(key)
            if key_match is None:
                continue
            terminal_number = int(key_match.group(1))
            field = key_match.group(2)
            record = records.setdefault(
                terminal_number,
                {
                    "terminal_number": terminal_number,
                    "logs_by_id": {},
                    "queue_by_id": {},
                },
            )
            log_match = LOG_KEY_PATTERN.match(field)
            if log_match is not None:
                log_id = log_match.group(1)
                log_field = log_match.group(2)
                record["logs_by_id"].setdefault(log_id, {})[log_field] = value
                continue
            queue_match = QUEUE_KEY_PATTERN.match(field)
            if queue_match is None:
                record[field] = value
                continue
            queue_id = queue_match.group(1)
            queue_field = queue_match.group(2)
            record["queue_by_id"].setdefault(queue_id, {})[queue_field] = value

        maximum_terminal_number = max(records, default=0)
        stored_next_number = values.get(NEXT_NUMBER_KEY, "")
        next_number = (
            int(stored_next_number)
            if stored_next_number.isdigit()
            else DEFAULT_TERMINAL_NUMBER
        )
        next_number = max(next_number, maximum_terminal_number + 1)
        for terminal_number, record in records.items():
            logs_by_id = record.get("logs_by_id") or {}
            record["logs"] = [
                self._log_metadata(terminal_number, log_id, log_values)
                for log_id, log_values in sorted(
                    logs_by_id.items(),
                    key=lambda item: int(item[0]),
                    reverse=True,
                )
            ]
            queue_by_id = record.get("queue_by_id") or {}
            record["queue"] = sorted(
                (
                    self._queue_entry_metadata(entry_id, entry_values)
                    for entry_id, entry_values in queue_by_id.items()
                ),
                key=lambda entry: (
                    entry["next_run_at"]
                    if entry["next_run_at"] is not None
                    else QUEUE_SORT_FAR_FUTURE_MS,
                    int(entry["id"]),
                ),
            )
        records = {
            terminal_number: record
            for terminal_number, record in records.items()
            if not (
                str(record.get("merged_into") or "").isdigit()
                and int(record["merged_into"]) != terminal_number
                and int(record["merged_into"]) in records
            )
        }
        return values, records, next_number

    def _scan_values(self) -> Dict[str, str]:
        return self._store.scan(SIZE_ONLY_KEY_SUFFIXES)

    def _write_record_fields(
        self,
        values: Dict[str, str],
        record: Dict[str, Any],
    ) -> None:
        terminal_number = int(record["terminal_number"])
        for field, value in record.items():
            if field in {
                "logs",
                "logs_by_id",
                "queue",
                "queue_by_id",
                "terminal_number",
            }:
                continue
            self._write_value(
                values,
                self._terminal_key(terminal_number, field),
                str(value),
            )

    def _write_value(
        self,
        values: Dict[str, str],
        key: str,
        value: str,
    ) -> None:
        if key.endswith(SIZE_ONLY_KEY_SUFFIXES):
            self._store.write(key, value)
            values[key] = str(len(value.encode("utf-8")))
            return
        self._store.write(key, value, values)

    @staticmethod
    def _schedule_definition_values(
        mode: str,
        run_at_ms: int,
        next_run_at_ms: int,
        interval_seconds: int,
        message: str,
    ) -> Dict[str, str]:
        return {
            "interval_seconds": str(max(0, int(interval_seconds))),
            "message": message,
            "mode": mode,
            "next_run_at": str(int(next_run_at_ms)),
            "preview": " ".join(message.split())[:SCHEDULE_PREVIEW_MAX_LENGTH],
            "run_at": str(int(run_at_ms)),
        }

    def _schedule_definition_matches(
        self,
        terminal_number: int,
        entry_id: str,
        existing: Dict[str, Any],
        desired: Dict[str, str],
    ) -> bool:
        existing_message = self._store.read(
            self._terminal_key(
                terminal_number,
                f"queue.{entry_id}.message",
            )
        ) or ""
        if existing_message != desired["message"]:
            return False
        definition_fields = (
            "interval_seconds",
            "mode",
            "preview",
            "run_at",
        )
        if any(
            str(existing.get(field) or "") != desired[field]
            for field in definition_fields
        ):
            return False
        return True

    def _write_schedule_entry(
        self,
        values: Dict[str, str],
        terminal_number: int,
        entry_id: str,
        entry_values: Dict[str, str],
    ) -> None:
        for field, value in entry_values.items():
            key = self._terminal_key(
                terminal_number,
                f"queue.{entry_id}.{field}",
            )
            current_value = (
                self._store.read(key)
                if key.endswith(SIZE_ONLY_KEY_SUFFIXES)
                else values.get(key)
            )
            if current_value == value:
                continue
            self._write_value(
                values,
                key,
                value,
            )

    def _delete_schedule_entry(
        self,
        values: Dict[str, str],
        terminal_number: int,
        entry_id: str,
    ) -> None:
        for field in QUEUE_ENTRY_FIELDS:
            key = self._terminal_key(
                terminal_number,
                f"queue.{entry_id}.{field}",
            )
            if key not in values:
                continue
            self._store.delete(key)
            values.pop(key, None)

    def _update_live_record(
        self,
        values: Dict[str, str],
        record: Dict[str, Any],
        window: Dict[str, Any],
        now: str,
    ) -> None:
        terminal_number = int(record["terminal_number"])
        rectangle = window.get("rect") or {}
        title = str(window.get("title") or "")
        live_values = {
            "window_id": str(window.get("id") or ""),
            "native_id": str(window.get("native_id") or ""),
            "title": title or str(record.get("title") or ""),
            "app": str(window.get("app") or ""),
            "class_name": str(window.get("class_name") or ""),
            "process_id": str(int(window.get("process_id") or 0)),
            "rect_x": str(int(rectangle.get("x") or 0)),
            "rect_y": str(int(rectangle.get("y") or 0)),
            "rect_width": str(int(rectangle.get("width") or 1)),
            "rect_height": str(int(rectangle.get("height") or 1)),
        }
        changed = any(
            str(record.get(field) or "") != value
            for field, value in live_values.items()
        )
        if not changed:
            return
        live_values["last_seen_at"] = now
        for field, value in live_values.items():
            record[field] = value
            self._write_value(
                values,
                self._terminal_key(terminal_number, field),
                value,
            )

    @staticmethod
    def _window_key(platform_name: str, window: Dict[str, Any]) -> str:
        return ":".join(
            (
                platform_name,
                str(window.get("id") or ""),
                str(window.get("process_id") or 0),
                str(window.get("class_name") or ""),
            )
        )

    @staticmethod
    def _new_record(
        terminal_number: int,
        platform_name: str,
        window_key: str,
        window: Dict[str, Any],
        now: str,
    ) -> Dict[str, Any]:
        rectangle = window.get("rect") or {}
        return {
            "terminal_number": terminal_number,
            "platform": platform_name,
            "window_key": window_key,
            "window_id": str(window.get("id") or ""),
            "native_id": str(window.get("native_id") or ""),
            "title": str(window.get("title") or ""),
            "app": str(window.get("app") or ""),
            "class_name": str(window.get("class_name") or ""),
            "process_id": str(int(window.get("process_id") or 0)),
            "rect_x": str(int(rectangle.get("x") or 0)),
            "rect_y": str(int(rectangle.get("y") or 0)),
            "rect_width": str(int(rectangle.get("width") or 1)),
            "rect_height": str(int(rectangle.get("height") or 1)),
            "draft": "",
            "created_at": now,
            "updated_at": now,
            "last_seen_at": now,
            "preview_expanded": "0",
            "slot_version": SLOT_VERSION,
            "logs": [],
            "logs_by_id": {},
            "queue": [],
            "queue_by_id": {},
        }

    @staticmethod
    def _decorate_live_window(
        window: Dict[str, Any],
        record: Dict[str, Any],
    ) -> Dict[str, Any]:
        logs = record.get("logs") or []
        window["terminal_number"] = int(record["terminal_number"])
        window["online"] = True
        window["has_draft"] = int(record.get("draft") or 0) > 0
        window["log_count"] = len(logs)
        window["logs"] = logs[:MAX_VISIBLE_LOG_ENTRIES]
        window["preview_expanded"] = (
            str(record.get("preview_expanded") or "0") == "1"
        )
        window["schedule_queue"] = list(record.get("queue") or [])
        window["state_updated_at"] = str(record.get("updated_at") or "")
        return window

    @staticmethod
    def _build_offline_window(record: Dict[str, Any]) -> Dict[str, Any]:
        terminal_number = int(record["terminal_number"])
        x = int(record.get("rect_x") or 0)
        y = int(record.get("rect_y") or 0)
        width = int(record.get("rect_width") or 1)
        height = int(record.get("rect_height") or 1)
        logs = record.get("logs") or []
        return {
            "id": f"stored:{terminal_number}",
            "native_id": str(record.get("native_id") or ""),
            "title": str(record.get("title") or ""),
            "app": str(record.get("app") or ""),
            "class_name": str(record.get("class_name") or ""),
            "process_id": int(record.get("process_id") or 0),
            "active": False,
            "online": False,
            "terminal_number": terminal_number,
            "rect": {
                "x": x,
                "y": y,
                "width": width,
                "height": height,
            },
            "center": {
                "x": x + width // 2,
                "y": y + height // 2,
            },
            "screenshot": None,
            "has_draft": int(record.get("draft") or 0) > 0,
            "log_count": len(logs),
            "logs": logs[:MAX_VISIBLE_LOG_ENTRIES],
            "preview_expanded": (
                str(record.get("preview_expanded") or "0") == "1"
            ),
            "schedule_queue": list(record.get("queue") or []),
            "state_updated_at": str(record.get("updated_at") or ""),
            "last_seen_at": str(record.get("last_seen_at") or ""),
        }

    @staticmethod
    def _has_retained_state(record: Dict[str, Any]) -> bool:
        return (
            int(record.get("draft") or 0) > 0
            or bool(record.get("logs"))
            or str(record.get("preview_expanded") or "0") == "1"
            or bool(record.get("queue"))
        )

    @staticmethod
    def _queue_entry_metadata(
        entry_id: str,
        values: Dict[str, Any],
    ) -> Dict[str, Any]:
        next_run_raw = str(values.get("next_run_at") or "")
        run_at_raw = str(values.get("run_at") or "")
        interval_raw = str(values.get("interval_seconds") or "")
        fire_count_raw = str(values.get("fire_count") or "")
        last_run_raw = str(values.get("last_run_at") or "")
        message_size = str(values.get("message") or "")
        return {
            "id": entry_id,
            "mode": str(values.get("mode") or ""),
            "next_run_at": (
                int(next_run_raw) if next_run_raw.isdigit() else None
            ),
            "run_at": int(run_at_raw) if run_at_raw.isdigit() else None,
            "interval_seconds": (
                int(interval_raw) if interval_raw.isdigit() else 0
            ),
            "has_message": (
                message_size.isdigit() and int(message_size) > 0
            ),
            "preview": str(values.get("preview") or ""),
            "fire_count": (
                int(fire_count_raw) if fire_count_raw.isdigit() else 0
            ),
            "last_run_at": (
                int(last_run_raw) if last_run_raw.isdigit() else None
            ),
            "created_at": str(values.get("created_at") or ""),
        }

    @staticmethod
    def _log_metadata(
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
            "success": status == "sent",
            "error_code": str(values.get("error_code") or "") or None,
        }

    @staticmethod
    def _terminal_key(terminal_number: int, field: str) -> str:
        return f"terminal.{terminal_number:06d}.{field}"


terminal_state_repository = TerminalStateRepository()


__all__ = [
    "MAX_VISIBLE_LOG_ENTRIES",
    "QUEUE_ENTRY_FIELDS",
    "SCHEDULE_ACTIVE_MODES",
    "TERMINAL_DATA_DIR",
    "TerminalStateRepository",
    "terminal_state_repository",
]
