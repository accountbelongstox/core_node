# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import time
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.database.repositories.terminal_state_store import TerminalStateStore
from pycore.pyctl.terminal.terminal_state_keys import (
    DEFAULT_LOG_SOURCE,
    LIVE_IDENTITY_FIELDS,
    LIVE_VOLATILE_PERSIST_SECONDS,
    LOG_CONTENT_KEY_SUFFIX,
    LOG_ENTRY_FIELDS,
    LOG_KEY_PATTERN,
    LOG_SOURCES,
    NEXT_NUMBER_KEY,
    SIZE_ONLY_KEY_SUFFIXES,
    SLOT_VERSION,
    TERMINAL_DATABASE_NAME,
    TERMINAL_DATA_DIR,
    TERMINAL_KEY_PATTERN,
    active_records,
    log_metadata,
    log_preview,
    next_slot_number,
    parse_records,
    refresh_record_logs,
    stored_terminal_numbers,
    terminal_key,
)
from pycore.pyctl.terminal.terminal_window_views import (
    build_offline_window,
    decorate_live_window,
    has_retained_state,
    new_record,
    window_key,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.time_utils import utc_now_iso


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
        self._volatile_persisted_at: Dict[int, float] = {}
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
        reserved_terminal_numbers = stored_terminal_numbers(values)
        claimed_terminal_numbers = set()
        assignments: List[Tuple[Dict[str, Any], int, str]] = []
        reconciled_windows: List[Dict[str, Any]] = []
        now = utc_now_iso()
        live_windows = [copy.deepcopy(window) for window in windows]
        window_keys = [
            window_key(platform_name, live_window)
            for live_window in live_windows
        ]
        # Numbers still owned by a live window are never handed to another
        # window in this pass, whatever order the windows arrive in.
        live_owned_numbers = {
            int(records_by_window_key[live_key]["terminal_number"])
            for live_key in window_keys
            if live_key in records_by_window_key
            and str(records_by_window_key[live_key].get("slot_version") or "")
            == SLOT_VERSION
        }

        for live_window, live_key in zip(live_windows, window_keys):
            source_record = records_by_window_key.get(live_key)
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
                terminal_number = next_slot_number(
                    records,
                    claimed_terminal_numbers | live_owned_numbers,
                    reserved_terminal_numbers,
                    platform_name,
                )
                record = records.get(terminal_number)
            else:
                terminal_number = int(record["terminal_number"])
            if record is None:
                record = new_record(
                    terminal_number,
                    platform_name,
                    live_key,
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
                terminal_key(terminal_number, "slot_version"),
                SLOT_VERSION,
            )
            claimed_terminal_numbers.add(terminal_number)
            assignments.append((live_window, terminal_number, live_key))

        self._write_value(
            values,
            NEXT_NUMBER_KEY,
            str(max(reserved_terminal_numbers, default=0) + 1),
        )
        for live_window, terminal_number, live_key in assignments:
            record = records[terminal_number]
            record["window_key"] = live_key
            self._write_value(
                values,
                terminal_key(terminal_number, "window_key"),
                live_key,
            )
            self._update_live_record(values, record, live_window, now)
            reconciled_windows.append(
                decorate_live_window(live_window, record)
            )

        active_by_number = active_records(records)
        for terminal_number in sorted(active_by_number):
            record = active_by_number[terminal_number]
            if str(record.get("platform") or "") != platform_name:
                continue
            if terminal_number in claimed_terminal_numbers:
                continue
            if not has_retained_state(record):
                continue
            reconciled_windows.append(build_offline_window(record))
        reconciled_windows.sort(
            key=lambda window: int(window["terminal_number"]),
        )
        return reconciled_windows

    @serialized_method
    @_transactional_store_method
    def save_draft(self, terminal_number: int, text: str) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        now = utc_now_iso()
        self._write_value(
            values,
            terminal_key(terminal_number, "draft"),
            text,
        )
        self._write_value(
            values,
            terminal_key(terminal_number, "updated_at"),
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
        now = utc_now_iso()
        self._write_value(
            values,
            terminal_key(terminal_number, "preview_expanded"),
            "1" if expanded else "0",
        )
        self._write_value(
            values,
            terminal_key(terminal_number, "updated_at"),
            now,
        )
        return {
            "success": True,
            "terminal_number": terminal_number,
            "preview_expanded": expanded,
        }

    @serialized_method
    @_transactional_store_method
    def save_custom_title(
        self,
        terminal_number: int,
        title: str,
    ) -> Dict[str, Any]:
        values, records, _next_number = self._scan_records()
        if terminal_number not in records:
            return {"success": False, "error_code": "terminal_state_not_found"}
        self._write_value(values, terminal_key(terminal_number, "custom_title"), title)
        self._write_value(values, terminal_key(terminal_number, "updated_at"), utc_now_iso())
        return {
            "success": True,
            "terminal_number": terminal_number,
            "custom_title": title,
        }

    @serialized_method
    @_transactional_store_method
    def begin_submission(
        self,
        terminal_number: int,
        text: str,
        source: str = DEFAULT_LOG_SOURCE,
    ) -> Optional[Dict[str, Any]]:
        values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        if record is None:
            return None

        log_id = str(time.time_ns())
        now = utc_now_iso()
        log_prefix = f"log.{log_id}"
        log_values = {
            "content": text,
            "date": now,
            "error_code": "",
            "preview": log_preview(text),
            "source": source if source in LOG_SOURCES else DEFAULT_LOG_SOURCE,
            "status": "pending",
            "title": str(record.get("title") or ""),
        }
        for field, value in log_values.items():
            self._write_value(
                values,
                terminal_key(terminal_number, f"{log_prefix}.{field}"),
                value,
            )
        if log_values["source"] == DEFAULT_LOG_SOURCE:
            self._write_value(
                values,
                terminal_key(terminal_number, "draft"),
                text,
            )
        self._write_value(
            values,
            terminal_key(terminal_number, "updated_at"),
            now,
        )
        return log_metadata(
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
        now = utc_now_iso()
        self._write_value(
            values,
            terminal_key(terminal_number, f"log.{log_id}.status"),
            status,
        )
        self._write_value(
            values,
            terminal_key(terminal_number, f"log.{log_id}.error_code"),
            str(error_code or ""),
        )
        self._write_value(
            values,
            terminal_key(terminal_number, "updated_at"),
            now,
        )
        if success and str(log.get("source") or DEFAULT_LOG_SOURCE) == DEFAULT_LOG_SOURCE:
            self._write_value(
                values,
                terminal_key(terminal_number, "draft"),
                "",
            )
        completed_values = {
            **log,
            "status": status,
            "error_code": str(error_code or ""),
        }
        return log_metadata(
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
            key = terminal_key(terminal_number, "draft")
        elif content_kind == "log" and log_id.isdigit():
            key = terminal_key(terminal_number, f"log.{log_id}.content")
        else:
            return None
        content = self._store.read(key)
        if content is not None:
            return content
        return "" if content_kind == "draft" else None

    @serialized_method
    def search_logs(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Sent messages containing query, newest first; a text sent again is listed once, at its newest send."""
        needle = query.strip()
        if not needle or limit <= 0:
            return []
        matches: List[Tuple[int, int, str]] = []
        for key, content in self._store.search_values(LOG_CONTENT_KEY_SUFFIX, needle):
            terminal_match = TERMINAL_KEY_PATTERN.match(key)
            log_match = LOG_KEY_PATTERN.match(terminal_match.group(2)) if terminal_match else None
            if log_match and log_match.group(2) == "content":
                matches.append((int(log_match.group(1)), int(terminal_match.group(1)), content))
        matches.sort(reverse=True)
        results: List[Dict[str, Any]] = []
        seen_contents = set()
        for log_id, terminal_number, content in matches:
            if content in seen_contents:
                continue
            seen_contents.add(content)
            values = {
                field: self._store.read(terminal_key(terminal_number, f"log.{log_id}.{field}")) or ""
                for field in LOG_ENTRY_FIELDS
                if field != "content"
            }
            results.append({**log_metadata(terminal_number, str(log_id), values), "content": content})
            if len(results) >= limit:
                break
        return results

    @serialized_method
    @_transactional_store_method
    def remove_offline_terminal(
        self,
        platform_name: str,
        live_windows: List[Dict[str, Any]],
        terminal_number: int,
    ) -> Dict[str, Any]:
        """Delete every stored key of an offline terminal and of the records merged into it
        (they would otherwise resurface as offline windows once their merge target is gone)."""
        values, records, _next_number = self._scan_records()
        if terminal_number not in records:
            return {"success": False, "error_code": "terminal_state_not_found"}
        live_keys = {window_key(platform_name, window) for window in live_windows}
        if str(records[terminal_number].get("window_key") or "") in live_keys:
            return {"success": False, "error_code": "terminal_window_online"}
        removed_numbers = {terminal_number}
        pending = True
        while pending:
            pending = False
            for number, record in records.items():
                merged_into = str(record.get("merged_into") or "")
                if (
                    number not in removed_numbers
                    and merged_into.isdigit()
                    and int(merged_into) in removed_numbers
                    and str(record.get("window_key") or "") not in live_keys
                ):
                    removed_numbers.add(number)
                    pending = True
        prefixes = tuple(terminal_key(number, "") for number in removed_numbers)
        for key in [key for key in values if key.startswith(prefixes)]:
            self._store.delete(key)
            values.pop(key, None)
        for number in removed_numbers:
            self._volatile_persisted_at.pop(number, None)
        return {
            "success": True,
            "terminal_number": terminal_number,
            "removed_terminal_numbers": sorted(removed_numbers),
        }

    @serialized_method
    def resolve_window_id(self, terminal_number: int) -> str:
        _values, records, _next_number = self._scan_records()
        record = records.get(terminal_number)
        return str(record.get("window_id") or "") if record else ""

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
        target_logs = target.setdefault("logs_by_id", {})
        source_logs = source.get("logs_by_id") or {}

        if target_draft_size == 0 and source_draft_size > 0:
            source_draft = self._store.read(
                terminal_key(source_number, "draft"),
            ) or ""
            self._write_value(
                values,
                terminal_key(target_number, "draft"),
                source_draft,
            )
            target["draft"] = str(len(source_draft.encode("utf-8")))

        if str(source.get("preview_expanded") or "0") == "1":
            self._write_value(
                values,
                terminal_key(target_number, "preview_expanded"),
                "1",
            )
            target["preview_expanded"] = "1"

        self._merge_nested_entries(
            values,
            target_number,
            source_number,
            "log",
            LOG_ENTRY_FIELDS,
            target_logs,
            source_logs,
        )
        target["updated_at"] = now
        self._write_value(
            values,
            terminal_key(target_number, "updated_at"),
            now,
        )
        source["merged_into"] = str(target_number)
        self._write_value(
            values,
            terminal_key(source_number, "merged_into"),
            str(target_number),
        )
        refresh_record_logs(target)

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
            merged_entry: Dict[str, str] = {}
            for field in entry_fields:
                source_key = terminal_key(
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
                stored_value = str(value)
                self._write_value(
                    values,
                    terminal_key(
                        target_number,
                        f"{entry_kind}.{entry_id}.{field}",
                    ),
                    stored_value,
                )
                merged_entry[field] = (
                    str(len(stored_value.encode("utf-8")))
                    if source_key.endswith(SIZE_ONLY_KEY_SUFFIXES)
                    else stored_value
                )
            target_entries[entry_id] = merged_entry

    def _scan_records(
        self,
    ) -> Tuple[Dict[str, str], Dict[int, Dict[str, Any]], int]:
        values = self._store.scan(SIZE_ONLY_KEY_SUFFIXES)
        records, next_number = parse_records(values)
        return values, records, next_number

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
                "terminal_number",
            }:
                continue
            self._write_value(
                values,
                terminal_key(terminal_number, field),
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
        changed_fields = [
            field
            for field, value in live_values.items()
            if str(record.get(field) or "") != value
        ]
        if not changed_fields:
            return
        monotonic_now = time.monotonic()
        if (
            not LIVE_IDENTITY_FIELDS.intersection(changed_fields)
            and monotonic_now - self._volatile_persisted_at.get(
                terminal_number,
                float("-inf"),
            ) < LIVE_VOLATILE_PERSIST_SECONDS
        ):
            return
        self._volatile_persisted_at[terminal_number] = monotonic_now
        live_values["last_seen_at"] = now
        for field, value in live_values.items():
            record[field] = value
            self._write_value(
                values,
                terminal_key(terminal_number, field),
                value,
            )


terminal_state_repository = TerminalStateRepository()


__all__ = [
    "TerminalStateRepository",
    "terminal_state_repository",
]
