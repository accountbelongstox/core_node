# -*- coding: utf-8 -*-
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List

from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyctl.terminal.terminal_state_repository import (
    SCHEDULE_ACTIVE_MODES,
    terminal_state_repository,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


MIN_SCHEDULE_INTERVAL_SECONDS = 1
WAKEUP_SIGNAL = "terminal.scheduler.wakeup"


def _failure(error_code: str) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code}


def _now_ms() -> int:
    return int(time.time() * 1000)


class TerminalSchedulerThread(threading.Thread):
    """Dispatch due terminal schedule entries; blocks on THREAD_BUS between runs."""

    def __init__(self, repository, service) -> None:
        super().__init__(name="TerminalSchedulerThread", daemon=True)
        self._repository = repository
        self._service = service

    def run(self) -> None:
        while True:
            THREAD_BUS.clear_signal(WAKEUP_SIGNAL)
            for due in self._repository.due_schedules(_now_ms()):
                self._dispatch(due)
            next_run_at = self._repository.next_scheduled_run()
            timeout = (
                max(0.0, (next_run_at - _now_ms()) / 1000.0)
                if next_run_at is not None
                else None
            )
            THREAD_BUS.wait_signal(WAKEUP_SIGNAL, timeout=timeout)

    def _dispatch(self, due: Dict[str, Any]) -> None:
        terminal_number = int(due.get("terminal_number") or 0)
        entry_id = str(due.get("entry_id") or "")
        mode = str(due.get("mode") or "")
        interval_seconds = int(due.get("interval_seconds") or 0)
        result = self._service.submit_scheduled(
            terminal_number,
            str(due.get("window_id") or ""),
            str(due.get("message") or ""),
        )
        self._repository.advance_schedule(
            terminal_number,
            entry_id,
            mode,
            interval_seconds,
            _now_ms(),
        )
        if result.get("success"):
            ColorPrint.blue(
                f"[TerminalScheduler] Sent scheduled message to terminal "
                f"#{terminal_number} (entry={entry_id}, mode={mode})."
            )
        else:
            ColorPrint.yellow(
                f"[TerminalScheduler] Scheduled message to terminal "
                f"#{terminal_number} (entry={entry_id}) failed: "
                f"{result.get('error_code')}."
            )


class TerminalScheduler:
    def __init__(self, repository, service) -> None:
        self._repository = repository
        self._service = service
        self._thread = TerminalSchedulerThread(repository, service)
        self._thread.start()

    def _compute_next_run_at(
        self,
        mode: str,
        run_at_ms: int,
        interval_seconds: int,
    ) -> int:
        if mode == "once":
            if run_at_ms <= 0:
                raise ValueError("terminal_schedule_time_invalid")
            return run_at_ms
        if interval_seconds < MIN_SCHEDULE_INTERVAL_SECONDS:
            raise ValueError("terminal_schedule_interval_invalid")
        return _now_ms() + interval_seconds * 1000

    def add_entry(
        self,
        terminal_number: int,
        mode: str,
        run_at_ms: int,
        interval_seconds: int,
        message: str,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return _failure("terminal_number_required")
        if mode not in SCHEDULE_ACTIVE_MODES:
            return _failure("terminal_schedule_mode_invalid")
        try:
            next_run_at = self._compute_next_run_at(mode, run_at_ms, interval_seconds)
        except ValueError as error:
            return _failure(str(error))
        result = self._repository.add_schedule_entry(
            terminal_number,
            mode,
            next_run_at,
            interval_seconds,
            message,
        )
        if result.get("success"):
            THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return result

    def update_entry(
        self,
        terminal_number: int,
        entry_id: str,
        mode: str,
        run_at_ms: int,
        interval_seconds: int,
        message: str,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return _failure("terminal_number_required")
        if mode not in SCHEDULE_ACTIVE_MODES:
            return _failure("terminal_schedule_mode_invalid")
        if not entry_id.isdigit():
            return _failure("terminal_schedule_entry_invalid")
        try:
            next_run_at = self._compute_next_run_at(mode, run_at_ms, interval_seconds)
        except ValueError as error:
            return _failure(str(error))
        result = self._repository.update_schedule_entry(
            terminal_number,
            entry_id,
            mode,
            next_run_at,
            interval_seconds,
            message,
        )
        if result.get("success"):
            THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return result

    def remove_entry(
        self,
        terminal_number: int,
        entry_id: str,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return _failure("terminal_number_required")
        if not entry_id.isdigit():
            return _failure("terminal_schedule_entry_invalid")
        result = self._repository.remove_schedule_entry(
            terminal_number,
            entry_id,
        )
        if result.get("success"):
            THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return result

    def sync_entries(
        self,
        terminal_number: int,
        entries: Any,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return _failure("terminal_number_required")
        if not isinstance(entries, list):
            return _failure("terminal_schedule_entry_invalid")

        normalized_entries: List[Dict[str, Any]] = []
        entry_ids = set()
        for raw_entry in entries:
            if not isinstance(raw_entry, dict):
                return _failure("terminal_schedule_entry_invalid")
            entry_id = str(raw_entry.get("id") or "")
            mode = str(raw_entry.get("mode") or "").strip().lower()
            try:
                run_at_ms = int(raw_entry.get("run_at") or 0)
                interval_seconds = int(
                    raw_entry.get("interval_seconds") or 0
                )
            except (TypeError, ValueError):
                return _failure("terminal_schedule_entry_invalid")
            if not entry_id.isdigit() or entry_id in entry_ids:
                return _failure("terminal_schedule_entry_invalid")
            if mode not in SCHEDULE_ACTIVE_MODES:
                return _failure("terminal_schedule_mode_invalid")
            try:
                next_run_at = self._compute_next_run_at(
                    mode,
                    run_at_ms,
                    interval_seconds,
                )
            except ValueError as error:
                return _failure(str(error))
            entry_ids.add(entry_id)
            normalized_entries.append({
                "id": entry_id,
                "mode": mode,
                "next_run_at": next_run_at,
                "interval_seconds": (
                    interval_seconds if mode == "interval" else 0
                ),
                "message": str(raw_entry.get("message") or ""),
            })

        result = self._repository.sync_schedule_entries(
            terminal_number,
            normalized_entries,
        )
        if result.get("success"):
            THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return result


terminal_scheduler = TerminalScheduler(
    terminal_state_repository,
    terminal_service,
)


__all__ = [
    "MIN_SCHEDULE_INTERVAL_SECONDS",
    "TerminalScheduler",
    "TerminalSchedulerThread",
    "terminal_scheduler",
]
