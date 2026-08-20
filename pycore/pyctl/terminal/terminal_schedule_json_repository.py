# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from typing import Any, Dict, List

from pycore.pyctl.pycore_manager_ui_state import read_pycore_manager_ui_state


TERMINAL_SCHEDULE_STORAGE_KEY = "pc.terminal.scheduleBackups.v3"
TERMINAL_SCHEDULE_STATE_VERSION = 3
MIN_SCHEDULE_INTERVAL_SECONDS = 1
SCHEDULE_ACTIVE_MODES = {"once", "interval"}


def _failure(error_code: str) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code}


class TerminalScheduleJsonRepository:
    """Read the frontend-owned terminal schedule replica from UI-state JSON."""

    def read(self) -> Dict[str, Any]:
        document = read_pycore_manager_ui_state()
        values = document.get("values")
        raw_state = (
            values.get(TERMINAL_SCHEDULE_STORAGE_KEY)
            if isinstance(values, dict)
            else None
        )
        if raw_state is None:
            return {
                "success": True,
                "revision": int(document.get("revision") or 0),
                "updated_at": str(document.get("updated_at") or ""),
                "clear_all_pending": False,
                "terminals": {},
            }
        try:
            state = json.loads(raw_state)
        except (TypeError, ValueError):
            return _failure("terminal_schedule_json_invalid")
        if (
            not isinstance(state, dict)
            or state.get("version") != TERMINAL_SCHEDULE_STATE_VERSION
            or not isinstance(state.get("terminals"), dict)
        ):
            return _failure("terminal_schedule_json_invalid")

        terminals: Dict[int, List[Dict[str, Any]]] = {}
        terminal_errors: List[Dict[str, Any]] = []
        clear_all_pending = bool(state.get("clear_all_pending"))
        for terminal_key, raw_record in state["terminals"].items():
            terminal_text = str(terminal_key)
            if not terminal_text.isdigit() or int(terminal_text) <= 0:
                continue
            terminal_number = int(terminal_text)
            if clear_all_pending:
                terminals[terminal_number] = []
                continue
            raw_entries = (
                raw_record.get("entries")
                if isinstance(raw_record, dict)
                else None
            )
            if not isinstance(raw_entries, list):
                terminal_errors.append({
                    "terminal_number": terminal_number,
                    "error_code": "terminal_schedule_entry_invalid",
                })
                continue
            entries = self._normalize_entries(raw_entries)
            if entries is None:
                terminal_errors.append({
                    "terminal_number": terminal_number,
                    "error_code": "terminal_schedule_entry_invalid",
                })
                continue
            terminals[terminal_number] = entries
        return {
            "success": not terminal_errors,
            "error_code": (
                "terminal_schedule_entry_invalid" if terminal_errors else None
            ),
            "revision": int(document.get("revision") or 0),
            "updated_at": str(document.get("updated_at") or ""),
            "clear_all_pending": clear_all_pending,
            "terminals": terminals,
            "terminal_errors": terminal_errors,
        }

    @staticmethod
    def _normalize_entries(
        raw_entries: List[Any],
    ) -> List[Dict[str, Any]] | None:
        entries: List[Dict[str, Any]] = []
        entry_ids = set()
        for raw_entry in raw_entries:
            if not isinstance(raw_entry, dict):
                return None
            entry_id = str(raw_entry.get("id") or "")
            mode = str(raw_entry.get("mode") or "").strip().lower()
            run_at_text = str(raw_entry.get("run_at") or 0)
            interval_text = str(raw_entry.get("interval_seconds") or 0)
            if (
                not entry_id.isdigit()
                or entry_id in entry_ids
                or mode not in SCHEDULE_ACTIVE_MODES
                or not run_at_text.isdigit()
                or not interval_text.isdigit()
            ):
                return None
            run_at = int(run_at_text)
            interval_seconds = int(interval_text)
            if mode == "once" and run_at <= 0:
                return None
            if (
                mode == "interval"
                and interval_seconds < MIN_SCHEDULE_INTERVAL_SECONDS
            ):
                return None
            entry_ids.add(entry_id)
            entries.append({
                "id": entry_id,
                "mode": mode,
                "run_at": run_at if mode == "once" else 0,
                "interval_seconds": (
                    interval_seconds if mode == "interval" else 0
                ),
                "message": str(raw_entry.get("message") or ""),
            })
        return entries


terminal_schedule_json_repository = TerminalScheduleJsonRepository()


__all__ = [
    "SCHEDULE_ACTIVE_MODES",
    "MIN_SCHEDULE_INTERVAL_SECONDS",
    "TERMINAL_SCHEDULE_STATE_VERSION",
    "TERMINAL_SCHEDULE_STORAGE_KEY",
    "TerminalScheduleJsonRepository",
    "terminal_schedule_json_repository",
]
