# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import time
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Set, Tuple

from pycore.database.repositories.terminal_state_reader import TerminalStateReader
from pycore.database.repositories.terminal_state_store import TerminalStateStore
from pycore.database.schema.terminal_state_schema import DEFAULT_LOG_SOURCE
from pycore.pyctl.terminal.terminal_state_keys import (
    LIVE_IDENTITY_FIELDS,
    LIVE_VOLATILE_PERSIST_SECONDS,
    LOG_SOURCES,
    SLOT_VERSION,
    TERMINAL_DATABASE_NAME,
    TERMINAL_DATA_DIR,
    active_records,
    is_active_record,
    log_metadata,
    log_preview,
    next_slot_number,
    refresh_record_logs,
)
from pycore.pyctl.terminal.terminal_window_views import (
    build_offline_window,
    decorate_live_window,
    has_retained_state,
    new_record,
    window_key,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.time_utils import utc_now_iso


LABEL = "TerminalStateRepository"
SEARCH_HIT_SENT = "sent"
SEARCH_HIT_DRAFT = "draft"


def _transactional_store_method(
    method: Callable[..., Any],
) -> Callable[..., Any]:
    @wraps(method)
    def wrapper(owner: Any, *args: Any, **kwargs: Any) -> Any:
        owner._synchronize_records()
        try:
            with owner._store.transaction():
                return method(owner, *args, **kwargs)
        except Exception as exc:  # noqa: BLE001 - the model is rebuilt from disk, then the failure propagates
            ColorPrint.red(
                f"[{LABEL}] {method.__name__} failed, reloading the stored model: "
                f"{type(exc).__name__}: {exc}"
            )
            owner._reload_records()
            raise
    return wrapper


class TerminalStateRepository:
    def __init__(self, data_dir: Path = TERMINAL_DATA_DIR) -> None:
        database_path = data_dir / TERMINAL_DATABASE_NAME
        self._store = TerminalStateStore(database_path, data_dir)
        self._reader = TerminalStateReader(database_path)
        self._volatile_persisted_at: Dict[int, float] = {}
        self._data_version = 0
        self._records: Dict[int, Dict[str, Any]] = {}
        self._reload_records()
        init_serialized_owner(
            self,
            "terminal.state",
            "TerminalStateRepository",
        )

    def _synchronize_records(self) -> None:
        """Another process (a pycore worker on the same machine) committed to the store: rebuild the model."""
        if self._store.data_version() != self._data_version:
            self._reload_records()

    def _reload_records(self) -> None:
        self._data_version = self._store.data_version()
        self._records = self._load_records()

    def _load_records(self) -> Dict[int, Dict[str, Any]]:
        records: Dict[int, Dict[str, Any]] = {}
        for stored in self._store.load_terminals():
            records[int(stored["terminal_number"])] = {**stored, "logs_by_id": {}}
        for terminal_number, log_id, values in self._store.load_log_metadata():
            record = records.get(terminal_number)
            if record is not None:
                record["logs_by_id"][str(log_id)] = values
        for record in records.values():
            refresh_record_logs(record)
        return records

    @serialized_method
    @_transactional_store_method
    def reconcile_windows(
        self,
        platform_name: str,
        windows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        records = active_records(self._records)
        records_by_window_key = {
            str(record.get("window_key") or ""): record
            for record in records.values()
            if record.get("window_key")
        }
        reserved_terminal_numbers: Set[int] = set(self._records)
        claimed_terminal_numbers: Set[int] = set()
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
                self._records[terminal_number] = record
                reserved_terminal_numbers.add(terminal_number)
                self._store.insert_terminal(record)
            if (
                source_record is not None
                and int(source_record["terminal_number"]) != terminal_number
            ):
                self._merge_record_state(record, source_record, now)
            self._set_fields(record, {"slot_version": SLOT_VERSION})
            claimed_terminal_numbers.add(terminal_number)
            assignments.append((live_window, terminal_number, live_key))

        for live_window, terminal_number, live_key in assignments:
            record = records[terminal_number]
            self._set_fields(record, {"window_key": live_key})
            self._update_live_record(record, live_window, now)
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
        record = self._active_record(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        self._store.write_draft(terminal_number, text)
        record["draft"] = str(len(text.encode("utf-8")))
        self._set_fields(record, {"updated_at": utc_now_iso()})
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
        record = self._active_record(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        self._set_fields(
            record,
            {
                "preview_expanded": "1" if expanded else "0",
                "updated_at": utc_now_iso(),
            },
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
        record = self._active_record(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        self._set_fields(
            record,
            {"custom_title": title, "updated_at": utc_now_iso()},
        )
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
        record = self._active_record(terminal_number)
        if record is None:
            return None

        log_id = str(time.time_ns())
        now = utc_now_iso()
        log_values = {
            "date": now,
            "error_code": "",
            "preview": log_preview(text),
            "source": source if source in LOG_SOURCES else DEFAULT_LOG_SOURCE,
            "status": "pending",
            "title": str(record.get("title") or ""),
        }
        self._store.insert_log(terminal_number, int(log_id), log_values, text)
        record["logs_by_id"][log_id] = log_values
        refresh_record_logs(record)
        if log_values["source"] == DEFAULT_LOG_SOURCE:
            self._store.write_draft(terminal_number, text)
            record["draft"] = str(len(text.encode("utf-8")))
        self._set_fields(record, {"updated_at": now})
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
        record = self._active_record(terminal_number)
        log = (record or {}).get("logs_by_id", {}).get(log_id)
        if record is None or not isinstance(log, dict):
            return None

        status = "sent" if success else "failed"
        completed_values = {
            **log,
            "status": status,
            "error_code": str(error_code or ""),
        }
        self._store.update_log(
            terminal_number,
            int(log_id),
            {"status": status, "error_code": completed_values["error_code"]},
        )
        record["logs_by_id"][log_id] = completed_values
        refresh_record_logs(record)
        if success and str(log.get("source") or DEFAULT_LOG_SOURCE) == DEFAULT_LOG_SOURCE:
            self._store.write_draft(terminal_number, "")
            record["draft"] = "0"
        self._set_fields(record, {"updated_at": utc_now_iso()})
        return log_metadata(
            terminal_number,
            log_id,
            completed_values,
        )

    def read_text(
        self,
        terminal_number: int,
        content_kind: str,
        log_id: str = "",
    ) -> Optional[str]:
        if content_kind == "draft":
            return self._reader.read_draft(terminal_number)
        if content_kind == "log" and log_id.isdigit():
            return self._reader.read_log_content(terminal_number, int(log_id))
        return None

    def read_log_texts(
        self,
        terminal_number: int,
        log_ids: Sequence[str],
    ) -> Dict[str, str]:
        return self._reader.read_log_contents(
            terminal_number,
            [int(log_id) for log_id in log_ids if str(log_id).isdigit()],
        )

    def search_logs(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Sent messages and unsent drafts containing query, newest first; a text sent again is
        listed once, at its newest send, and a draft is listed apart from the sends of its text."""
        needle = query.strip()
        if not needle or limit <= 0:
            return []
        sent: List[Dict[str, Any]] = []
        seen_contents = set()
        for entry in self._reader.matching_logs(needle):
            content = str(entry["content"])
            if content in seen_contents:
                continue
            seen_contents.add(content)
            sent.append(
                {
                    **log_metadata(
                        int(entry["terminal_number"]),
                        str(entry["log_id"]),
                        entry,
                    ),
                    "kind": SEARCH_HIT_SENT,
                    "content": content,
                }
            )
            if len(sent) >= limit:
                break
        drafts = [
            {
                "id": SEARCH_HIT_DRAFT,
                "terminal_number": int(entry["terminal_number"]),
                "title": str(entry["custom_title"] or entry["title"] or ""),
                "date": str(entry["updated_at"] or ""),
                "status": SEARCH_HIT_DRAFT,
                "kind": SEARCH_HIT_DRAFT,
                "success": False,
                "error_code": None,
                "content": str(entry["draft"]),
            }
            for entry in self._reader.matching_drafts(needle)[:limit]
        ]
        return sorted(drafts + sent, key=lambda hit: str(hit["date"]), reverse=True)[:limit]

    @serialized_method
    @_transactional_store_method
    def remove_offline_terminal(
        self,
        platform_name: str,
        live_windows: List[Dict[str, Any]],
        terminal_number: int,
    ) -> Dict[str, Any]:
        """Delete every stored row of an offline terminal and of the records merged into it
        (they would otherwise resurface as offline windows once their merge target is gone)."""
        record = self._active_record(terminal_number)
        if record is None:
            return {"success": False, "error_code": "terminal_state_not_found"}
        live_keys = {window_key(platform_name, window) for window in live_windows}
        if str(record.get("window_key") or "") in live_keys:
            return {"success": False, "error_code": "terminal_window_online"}
        removed_numbers = {terminal_number}
        pending = True
        while pending:
            pending = False
            for number, stored in self._records.items():
                merged_into = str(stored.get("merged_into") or "")
                if (
                    number not in removed_numbers
                    and merged_into.isdigit()
                    and int(merged_into) in removed_numbers
                    and str(stored.get("window_key") or "") not in live_keys
                ):
                    removed_numbers.add(number)
                    pending = True
        self._store.delete_terminals(removed_numbers)
        for number in removed_numbers:
            self._records.pop(number, None)
            self._volatile_persisted_at.pop(number, None)
        return {
            "success": True,
            "terminal_number": terminal_number,
            "removed_terminal_numbers": sorted(removed_numbers),
        }

    def resolve_window_id(self, terminal_number: int) -> str:
        return self._reader.window_id(terminal_number)

    def _active_record(self, terminal_number: int) -> Optional[Dict[str, Any]]:
        record = self._records.get(terminal_number)
        if record is None or not is_active_record(record, self._records):
            return None
        return record

    def _set_fields(self, record: Dict[str, Any], values: Dict[str, str]) -> bool:
        changed = {
            field: value
            for field, value in values.items()
            if record.get(field) != value
        }
        if not changed:
            return False
        self._store.update_terminal(int(record["terminal_number"]), changed)
        record.update(changed)
        return True

    def _merge_record_state(
        self,
        target: Dict[str, Any],
        source: Dict[str, Any],
        now: str,
    ) -> None:
        target_number = int(target["terminal_number"])
        source_number = int(source["terminal_number"])
        target_logs = target["logs_by_id"]
        missing_log_ids = [
            log_id for log_id in source["logs_by_id"] if log_id not in target_logs
        ]

        if int(target.get("draft") or 0) == 0 and int(source.get("draft") or 0) > 0:
            self._store.copy_draft(source_number, target_number)
            target["draft"] = str(source["draft"])

        changes = {"updated_at": now}
        if str(source.get("preview_expanded") or "0") == "1":
            changes["preview_expanded"] = "1"
        if missing_log_ids:
            self._store.copy_missing_logs(source_number, target_number)
            for log_id in missing_log_ids:
                target_logs[log_id] = dict(source["logs_by_id"][log_id])
            refresh_record_logs(target)
        self._set_fields(target, changes)
        self._set_fields(source, {"merged_into": str(target_number)})

    def _update_live_record(
        self,
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
        self._set_fields(record, {**live_values, "last_seen_at": now})


terminal_state_repository = TerminalStateRepository()


__all__ = [
    "TerminalStateRepository",
    "terminal_state_repository",
]
