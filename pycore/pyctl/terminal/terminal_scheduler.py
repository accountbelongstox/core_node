# -*- coding: utf-8 -*-
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyctl.terminal.terminal_schedule_json_repository import (
    MIN_SCHEDULE_INTERVAL_SECONDS,
    SCHEDULE_ACTIVE_MODES,
    terminal_schedule_json_repository,
)
from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


SCHEDULE_RETRY_DELAY_SECONDS = 30
SCHEDULE_PREVIEW_MAX_LENGTH = 80
WAKEUP_SIGNAL = "terminal.scheduler.wakeup"


def _failure(error_code: str) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TerminalSchedulerThread(threading.Thread):
    """Dispatch due terminal schedules from the frontend-owned JSON replica."""

    def __init__(self, scheduler) -> None:
        super().__init__(name="TerminalSchedulerThread", daemon=True)
        self._scheduler = scheduler

    def run(self) -> None:
        while True:
            THREAD_BUS.clear_signal(WAKEUP_SIGNAL)
            claim = self._scheduler.claim_due(_now_ms())
            due = claim.get("entry")
            if isinstance(due, dict):
                result = self._scheduler.execute_dispatch(due)
                outcome = self._scheduler.complete_dispatch(
                    due,
                    result,
                    _now_ms(),
                )
                self._scheduler.report_dispatch(outcome)
                continue
            next_run_at = claim.get("next_run_at")
            timeout = (
                max(0.0, (next_run_at - _now_ms()) / 1000.0)
                if next_run_at is not None
                else None
            )
            THREAD_BUS.wait_signal(WAKEUP_SIGNAL, timeout=timeout)


class TerminalScheduler:
    def __init__(self, json_repository, service) -> None:
        self._json_repository = json_repository
        self._service = service
        self._entries_by_terminal: Dict[int, Dict[str, Dict[str, Any]]] = {}
        self._source_revision = 0
        self._dispatch_sequence = 0
        init_serialized_owner(
            self,
            "terminal.scheduler.state",
            "TerminalSchedulerState",
        )
        self.sync_from_json()
        self._thread = TerminalSchedulerThread(self)
        self._thread.start()

    @serialized_method
    def claim_due(self, now_ms: int) -> Dict[str, Any]:
        due = self._first_due(now_ms)
        if due is None:
            return {"entry": None, "next_run_at": self._next_scheduled_run()}
        self._dispatch_sequence += 1
        dispatch_token = self._dispatch_sequence
        terminal_number = int(due["terminal_number"])
        entry_id = str(due["id"])
        current = self._entries_by_terminal[terminal_number][entry_id]
        current["dispatch_token"] = dispatch_token
        return {
            "entry": {**due, "dispatch_token": dispatch_token},
            "next_run_at": self._next_scheduled_run(),
        }

    def execute_dispatch(self, due: Dict[str, Any]) -> Dict[str, Any]:
        terminal_number = int(due["terminal_number"])
        window_id = self._service.resolve_window_id(terminal_number)
        return self._service.submit_scheduled(
            terminal_number,
            window_id,
            str(due.get("message") or ""),
        )

    @serialized_method
    def complete_dispatch(
        self,
        due: Dict[str, Any],
        result: Dict[str, Any],
        completed_at: int,
    ) -> Dict[str, Any]:
        terminal_number = int(due["terminal_number"])
        entry_id = str(due["id"])
        dispatch_token = int(due["dispatch_token"])
        terminal_entries = self._entries_by_terminal.get(terminal_number) or {}
        current = terminal_entries.get(entry_id)
        if (
            current is None
            or int(current.get("dispatch_token") or 0) != dispatch_token
        ):
            return {
                "applied": False,
                "terminal_number": terminal_number,
                "entry_id": entry_id,
            }
        current["dispatch_token"] = 0
        if result.get("success"):
            if current["mode"] == "interval":
                current["next_run_at"] = (
                    completed_at + int(current["interval_seconds"]) * 1000
                )
                current["fire_count"] = int(current["fire_count"]) + 1
                current["last_run_at"] = completed_at
            else:
                terminal_entries.pop(entry_id, None)
                if not terminal_entries:
                    self._entries_by_terminal.pop(terminal_number, None)
        else:
            current["next_run_at"] = (
                completed_at + SCHEDULE_RETRY_DELAY_SECONDS * 1000
            )
        return {
            "applied": True,
            "success": bool(result.get("success")),
            "terminal_number": terminal_number,
            "entry_id": entry_id,
            "mode": str(current["mode"]),
            "error_code": result.get("error_code"),
        }

    @staticmethod
    def report_dispatch(outcome: Dict[str, Any]) -> None:
        if not outcome.get("applied"):
            return
        terminal_number = int(outcome["terminal_number"])
        entry_id = str(outcome["entry_id"])
        if outcome.get("success"):
            ColorPrint.blue(
                f"[TerminalScheduler] Sent frontend-synchronized message to "
                f"terminal #{terminal_number} (entry={entry_id}, "
                f"mode={outcome['mode']})."
            )
            return
        ColorPrint.yellow(
            f"[TerminalScheduler] Frontend-synchronized message to terminal "
            f"#{terminal_number} (entry={entry_id}) failed: "
            f"{outcome.get('error_code')}; retry retained."
        )

    def sync_from_json(self, terminal_number: int = 0) -> Dict[str, Any]:
        source = self._json_repository.read()
        return self._apply_json_source(source, terminal_number)

    @serialized_method
    def _apply_json_source(
        self,
        source: Dict[str, Any],
        terminal_number: int,
    ) -> Dict[str, Any]:
        source_terminals = source.get("terminals")
        if not isinstance(source_terminals, dict):
            return _failure(
                str(
                    source.get("error_code")
                    or "terminal_schedule_json_invalid"
                )
            )

        now_ms = _now_ms()
        requested_terminal = max(0, int(terminal_number or 0))
        terminal_errors = {
            int(item.get("terminal_number") or 0): str(
                item.get("error_code")
                or "terminal_schedule_entry_invalid"
            )
            for item in source.get("terminal_errors") or []
            if isinstance(item, dict)
            and int(item.get("terminal_number") or 0) > 0
        }
        terminal_numbers = sorted(
            set(self._entries_by_terminal)
            | set(source_terminals)
            | set(terminal_errors)
        )
        terminal_results: List[Dict[str, Any]] = []
        for current_terminal in terminal_numbers:
            if current_terminal in terminal_errors:
                terminal_results.append({
                    "terminal_number": current_terminal,
                    "success": False,
                    "error_code": terminal_errors[current_terminal],
                })
                continue
            raw_definitions = source_terminals.get(current_terminal, [])
            if not isinstance(raw_definitions, list):
                terminal_results.append({
                    "terminal_number": current_terminal,
                    "success": False,
                    "error_code": "terminal_schedule_entry_invalid",
                })
                continue
            terminal_results.append(
                self._sync_terminal(current_terminal, raw_definitions, now_ms)
            )

        self._source_revision = int(source.get("revision") or 0)
        THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        requested_entries = (
            self._entry_metadata_list(requested_terminal)
            if requested_terminal > 0
            else []
        )
        return {
            "success": bool(source.get("success", True))
            and all(result.get("success") for result in terminal_results),
            "error_code": source.get("error_code"),
            "source": "pycore_manager_ui_state_json",
            "source_revision": self._source_revision,
            "source_updated_at": str(source.get("updated_at") or ""),
            "clear_all_pending": bool(source.get("clear_all_pending")),
            "terminal_number": requested_terminal or None,
            "entries": requested_entries,
            "runtime_entry_count": self._runtime_entry_count(),
            "terminal_results": terminal_results,
        }

    def _sync_terminal(
        self,
        terminal_number: int,
        definitions: List[Dict[str, Any]],
        now_ms: int,
    ) -> Dict[str, Any]:
        current_entries = self._entries_by_terminal.get(terminal_number) or {}
        next_entries: Dict[str, Dict[str, Any]] = {}
        added_entry_ids: List[str] = []
        updated_entry_ids: List[str] = []
        unchanged_entry_ids: List[str] = []
        expired_entry_ids: List[str] = []

        for definition in definitions:
            entry_id = str(definition["id"])
            existing = current_entries.get(entry_id)
            if (
                str(definition["mode"]) == "once"
                and int(definition["run_at"]) <= now_ms
            ):
                expired_entry_ids.append(entry_id)
                continue
            if (
                existing is not None
                and self._definition_matches(existing, definition)
            ):
                next_entries[entry_id] = existing
                unchanged_entry_ids.append(entry_id)
                continue
            next_entries[entry_id] = self._new_runtime_entry(definition, now_ms)
            if existing is None:
                added_entry_ids.append(entry_id)
            else:
                updated_entry_ids.append(entry_id)

        removed_entry_ids = sorted(
            set(current_entries) - set(next_entries),
            key=int,
        )
        if next_entries:
            self._entries_by_terminal[terminal_number] = next_entries
        else:
            self._entries_by_terminal.pop(terminal_number, None)
        return {
            "success": True,
            "terminal_number": terminal_number,
            "entry_count": len(next_entries),
            "added_entry_ids": added_entry_ids,
            "updated_entry_ids": updated_entry_ids,
            "unchanged_entry_ids": unchanged_entry_ids,
            "removed_entry_ids": removed_entry_ids,
            "expired_entry_ids": expired_entry_ids,
        }

    def clear_entries(self) -> Dict[str, Any]:
        runtime_clear = self._clear_runtime_entries()
        source = self._json_repository.read()
        remaining_runtime_counts = self._runtime_entry_counts()
        source_terminals = source.get("terminals") or {}
        source_terminal_counts = {
            int(terminal_number): len(entries)
            for terminal_number, entries in source_terminals.items()
            if isinstance(entries, list)
        } if isinstance(source_terminals, dict) else {}
        json_entry_count = (
            sum(source_terminal_counts.values())
            if isinstance(source_terminals, dict)
            else -1
        )
        remaining_entry_count = sum(remaining_runtime_counts.values())
        json_cleared = bool(source.get("success", True)) and json_entry_count == 0
        runtime_cleared = remaining_entry_count == 0
        runtime_results = runtime_clear["terminal_results"]
        terminal_numbers = runtime_clear["terminal_numbers"]
        json_terminal_numbers = sorted(source_terminal_counts)
        terminal_results = [
            {
                **runtime_results.get(current_terminal, {
                    "terminal_number": current_terminal,
                    "cleared_entry_count": 0,
                    "entry_ids": [],
                }),
                "json_entry_count": source_terminal_counts.get(
                    current_terminal,
                    0,
                ),
                "remaining_entry_count": remaining_runtime_counts.get(
                    current_terminal,
                    0,
                ),
            }
            for current_terminal in sorted(
                set(terminal_numbers)
                | set(json_terminal_numbers)
                | set(remaining_runtime_counts)
            )
        ]
        return {
            "success": json_cleared and runtime_cleared,
            "error_code": self._clear_error_code(
                source,
                json_cleared,
                runtime_cleared,
            ),
            "source": "pycore_manager_ui_state_json",
            "source_revision": int(source.get("revision") or 0),
            "source_updated_at": str(source.get("updated_at") or ""),
            "json_entry_count": json_entry_count,
            "json_clear_all_pending": bool(source.get("clear_all_pending")),
            "cleared_entry_count": runtime_clear["cleared_entry_count"],
            "remaining_entry_count": remaining_entry_count,
            "terminal_numbers": terminal_numbers,
            "runtime_terminal_numbers": terminal_numbers,
            "json_terminal_numbers": json_terminal_numbers,
            "terminal_results": terminal_results,
        }

    @serialized_method
    def _clear_runtime_entries(self) -> Dict[str, Any]:
        runtime_results: Dict[int, Dict[str, Any]] = {}
        cleared_entry_count = 0
        for terminal_number in sorted(self._entries_by_terminal):
            entry_ids = sorted(
                self._entries_by_terminal[terminal_number],
                key=int,
            )
            if not entry_ids:
                continue
            cleared_entry_count += len(entry_ids)
            runtime_results[terminal_number] = {
                "terminal_number": terminal_number,
                "cleared_entry_count": len(entry_ids),
                "entry_ids": entry_ids,
            }
        self._entries_by_terminal.clear()
        THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return {
            "cleared_entry_count": cleared_entry_count,
            "terminal_numbers": sorted(runtime_results),
            "terminal_results": runtime_results,
        }

    @serialized_method
    def _runtime_entry_counts(self) -> Dict[int, int]:
        return {
            terminal_number: len(entries)
            for terminal_number, entries in self._entries_by_terminal.items()
            if entries
        }

    @staticmethod
    def _clear_error_code(
        source: Dict[str, Any],
        json_cleared: bool,
        runtime_cleared: bool,
    ) -> Optional[str]:
        if not json_cleared:
            return str(
                source.get("error_code")
                or "terminal_schedule_json_not_cleared"
            )
        if not runtime_cleared:
            return "terminal_schedule_runtime_not_cleared"
        return None

    @serialized_method
    def decorate_snapshot(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        for window in snapshot.get("windows") or []:
            terminal_number = int(window.get("terminal_number") or 0)
            window["schedule_queue"] = self._entry_metadata_list(terminal_number)
        snapshot["schedule_source"] = "pycore_manager_ui_state_json"
        snapshot["schedule_source_revision"] = self._source_revision
        return snapshot

    @serialized_method
    def read_message(self, terminal_number: int, entry_id: str) -> Optional[str]:
        entry = (self._entries_by_terminal.get(terminal_number) or {}).get(entry_id)
        return str(entry.get("message") or "") if entry is not None else None

    def _first_due(self, now_ms: int) -> Optional[Dict[str, Any]]:
        due_entries: List[Dict[str, Any]] = []
        for terminal_number, entries in self._entries_by_terminal.items():
            for entry in entries.values():
                if int(entry["next_run_at"]) > now_ms:
                    continue
                if int(entry.get("dispatch_token") or 0) > 0:
                    continue
                due_entries.append({
                    **entry,
                    "terminal_number": terminal_number,
                })
        return min(
            due_entries,
            key=lambda entry: (int(entry["next_run_at"]), int(entry["id"])),
        ) if due_entries else None

    def _next_scheduled_run(self) -> Optional[int]:
        candidates = [
            int(entry["next_run_at"])
            for entries in self._entries_by_terminal.values()
            for entry in entries.values()
            if int(entry.get("dispatch_token") or 0) == 0
        ]
        return min(candidates) if candidates else None

    def _entry_metadata_list(self, terminal_number: int) -> List[Dict[str, Any]]:
        entries = (self._entries_by_terminal.get(terminal_number) or {}).values()
        return sorted(
            (self._entry_metadata(entry) for entry in entries),
            key=lambda entry: (int(entry["next_run_at"]), int(entry["id"])),
        )

    def _runtime_entry_count(self) -> int:
        return sum(len(entries) for entries in self._entries_by_terminal.values())

    @staticmethod
    def _definition_matches(
        existing: Dict[str, Any],
        definition: Dict[str, Any],
    ) -> bool:
        return (
            str(existing["mode"]) == str(definition["mode"])
            and int(existing["run_at"]) == int(definition["run_at"])
            and int(existing["interval_seconds"])
            == int(definition["interval_seconds"])
            and str(existing["message"]) == str(definition.get("message") or "")
        )

    @staticmethod
    def _new_runtime_entry(
        definition: Dict[str, Any],
        now_ms: int,
    ) -> Dict[str, Any]:
        mode = str(definition["mode"])
        interval_seconds = int(definition["interval_seconds"])
        return {
            "id": str(definition["id"]),
            "mode": mode,
            "run_at": int(definition["run_at"]) if mode == "once" else 0,
            "next_run_at": (
                int(definition["run_at"])
                if mode == "once"
                else now_ms + interval_seconds * 1000
            ),
            "interval_seconds": interval_seconds if mode == "interval" else 0,
            "message": str(definition.get("message") or ""),
            "fire_count": 0,
            "last_run_at": None,
            "created_at": _now_iso(),
            "dispatch_token": 0,
        }

    @staticmethod
    def _entry_metadata(entry: Dict[str, Any]) -> Dict[str, Any]:
        message = str(entry.get("message") or "")
        return {
            "id": str(entry["id"]),
            "mode": str(entry["mode"]),
            "run_at": int(entry["run_at"]),
            "next_run_at": int(entry["next_run_at"]),
            "interval_seconds": int(entry["interval_seconds"]),
            "has_message": bool(message),
            "preview": " ".join(message.split())[:SCHEDULE_PREVIEW_MAX_LENGTH],
            "fire_count": int(entry["fire_count"]),
            "last_run_at": entry.get("last_run_at"),
            "created_at": str(entry.get("created_at") or ""),
        }


terminal_scheduler = TerminalScheduler(
    terminal_schedule_json_repository,
    terminal_service,
)


__all__ = [
    "MIN_SCHEDULE_INTERVAL_SECONDS",
    "SCHEDULE_ACTIVE_MODES",
    "SCHEDULE_RETRY_DELAY_SECONDS",
    "TerminalScheduler",
    "TerminalSchedulerThread",
    "terminal_scheduler",
]
