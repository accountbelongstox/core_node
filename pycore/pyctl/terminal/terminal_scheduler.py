# -*- coding: utf-8 -*-
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyctl.terminal.terminal_state_repository import (
    SCHEDULE_ACTIVE_MODES,
    terminal_state_repository,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


MIN_SCHEDULE_INTERVAL_SECONDS = 1
SCHEDULE_RETRY_DELAY_SECONDS = 30
WAKEUP_SIGNAL = "terminal.scheduler.wakeup"


def _failure(error_code: str) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code}


def _now_ms() -> int:
    return int(time.time() * 1000)


class TerminalSchedulerThread(threading.Thread):
    """Dispatch due terminal schedule entries; blocks on THREAD_BUS between runs."""

    def __init__(self, scheduler) -> None:
        super().__init__(name="TerminalSchedulerThread", daemon=True)
        self._scheduler = scheduler

    def run(self) -> None:
        while True:
            THREAD_BUS.clear_signal(WAKEUP_SIGNAL)
            next_run_at = self._scheduler.process_due(_now_ms())
            timeout = (
                max(0.0, (next_run_at - _now_ms()) / 1000.0)
                if next_run_at is not None
                else None
            )
            THREAD_BUS.wait_signal(WAKEUP_SIGNAL, timeout=timeout)


class TerminalScheduler:
    def __init__(self, repository, service) -> None:
        self._repository = repository
        self._service = service
        init_serialized_owner(
            self,
            "terminal.scheduler.state",
            "TerminalSchedulerState",
        )
        self._thread = TerminalSchedulerThread(self)
        self._thread.start()

    @serialized_method
    def process_due(self, now_ms: int) -> Optional[int]:
        due_schedules = self._repository.due_schedules(now_ms)
        if due_schedules:
            self._dispatch(due_schedules[0])
        return self._repository.next_scheduled_run()

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
        completed_at = _now_ms()
        if result.get("success"):
            self._repository.advance_schedule(
                terminal_number,
                entry_id,
                mode,
                interval_seconds,
                completed_at,
            )
            ColorPrint.blue(
                f"[TerminalScheduler] Sent scheduled message to terminal "
                f"#{terminal_number} (entry={entry_id}, mode={mode})."
            )
            return
        self._repository.defer_schedule(
            terminal_number,
            entry_id,
            completed_at + SCHEDULE_RETRY_DELAY_SECONDS * 1000,
        )
        ColorPrint.yellow(
            f"[TerminalScheduler] Scheduled message to terminal "
            f"#{terminal_number} (entry={entry_id}) failed: "
            f"{result.get('error_code')}; retry retained."
        )

    @serialized_method
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
            run_at_value = raw_entry.get("run_at")
            interval_value = raw_entry.get("interval_seconds")
            run_at_text = (
                str(run_at_value) if run_at_value is not None else ""
            )
            interval_text = (
                str(interval_value) if interval_value is not None else ""
            )
            if not run_at_text.isdigit() or not interval_text.isdigit():
                return _failure("terminal_schedule_entry_invalid")
            run_at_ms = int(run_at_text)
            interval_seconds = int(interval_text)
            if not entry_id.isdigit() or entry_id in entry_ids:
                return _failure("terminal_schedule_entry_invalid")
            if mode not in SCHEDULE_ACTIVE_MODES:
                return _failure("terminal_schedule_mode_invalid")
            if mode == "once" and run_at_ms <= 0:
                return _failure("terminal_schedule_time_invalid")
            if (
                mode == "interval"
                and interval_seconds < MIN_SCHEDULE_INTERVAL_SECONDS
            ):
                return _failure("terminal_schedule_interval_invalid")
            next_run_at = (
                run_at_ms
                if mode == "once"
                else _now_ms() + interval_seconds * 1000
            )
            entry_ids.add(entry_id)
            normalized_entries.append({
                "id": entry_id,
                "mode": mode,
                "run_at": run_at_ms if mode == "once" else 0,
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

    @serialized_method
    def clear_entries(self) -> Dict[str, Any]:
        result = self._repository.clear_schedule_entries()
        if result.get("success"):
            THREAD_BUS.signal(WAKEUP_SIGNAL, True)
        return result


terminal_scheduler = TerminalScheduler(
    terminal_state_repository,
    terminal_service,
)


__all__ = [
    "MIN_SCHEDULE_INTERVAL_SECONDS",
    "SCHEDULE_RETRY_DELAY_SECONDS",
    "TerminalScheduler",
    "TerminalSchedulerThread",
    "terminal_scheduler",
]
