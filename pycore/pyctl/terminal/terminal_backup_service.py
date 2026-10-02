# -*- coding: utf-8 -*-
"""Periodic backup of every terminal's exported text, with change detection and forced passes."""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyctl.terminal.terminal_backup_store import (
    TERMINAL_BACKUP_DIR_NAME,
    TerminalBackupStore,
    inputs_digest,
    kilobytes,
    terminal_backup_store,
    text_digest,
)
from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.file_lock import FileLockManager
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.power_state import read_power_state
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.user_idle import user_idle_seconds
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step11_desktop.system_notification import show_system_notification

LABEL = "TerminalBackup"
BACKUP_INTERVAL_SECONDS = relay_contract.limit("terminal_backup_interval_seconds")
LOW_BATTERY_PERCENT = relay_contract.limit("terminal_backup_low_battery_percent")
MIN_IDLE_SECONDS = relay_contract.limit("terminal_backup_min_idle_seconds")
DEFER_RETRY_SECONDS = relay_contract.limit("terminal_backup_defer_retry_seconds")
MAX_DEFER_SECONDS = relay_contract.limit("terminal_backup_max_defer_seconds")
SETTLE_SECONDS = relay_contract.limit("terminal_backup_settle_seconds")
SCHEDULER_LOCK_TARGET = APP_DATA_DIR / TERMINAL_BACKUP_DIR_NAME / "scheduler"
STOP_SIGNAL = "terminal.backup.stop"
SHUTDOWN_HANDLER_NAME = "terminal_backup"
SHUTDOWN_HANDLER_PRIORITY = 5
REASON_INTERVAL = "interval"
REASON_LOW_BATTERY = "low_battery"
REASON_SHUTDOWN = "shutdown"
ERROR_PASS_FAILED = "terminal_backup_pass_failed"
ERROR_EXPORT_FAILED = "terminal_export_failed"
ERROR_NO_DISPLAY = "no_display"
LOG_CONTENT_KIND = "log"


class TerminalBackupService:
    def __init__(
        self,
        terminals: Any = terminal_service,
        store: TerminalBackupStore = terminal_backup_store,
        idle_seconds: Callable[[], Optional[float]] = user_idle_seconds,
        notify: Callable[[str, str], Any] = show_system_notification,
    ) -> None:
        self._terminals = terminals
        self._store = store
        self._idle_seconds = idle_seconds
        self._notify = notify
        self._pass_lock = threading.Lock()
        self._lease_lock = FileLockManager(SCHEDULER_LOCK_TARGET, verbose=False)
        self._lease: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        self._deferred_logged = False
        self._deferred_since: Optional[float] = None

    def _user_active(self) -> bool:
        idle = self._idle_seconds()
        return idle is not None and idle < MIN_IDLE_SECONDS

    def _activity_defers(self, forced: bool) -> bool:
        """True while an active user should still postpone the pass; false once the max deferral is spent."""
        if forced or not self._user_active():
            return False
        now = time.monotonic()
        if self._deferred_since is None:
            self._deferred_since = now
        if now - self._deferred_since < MAX_DEFER_SECONDS:
            return True
        if self._deferred_logged:
            ColorPrint.blue(f"[{LABEL}] max deferral {MAX_DEFER_SECONDS}s reached: running while the user is active")
            self._deferred_logged = False
        return False

    def _enumerate(self) -> List[Dict[str, Any]]:
        windows = self._terminals.snapshot().get("windows") or []
        return [
            window
            for window in windows
            if window.get("online") and window.get("id") and int(window.get("terminal_number") or 0) > 0
        ]

    def _sent_inputs(self, number: int, window: Dict[str, Any]) -> List[Dict[str, Any]]:
        inputs = []
        for log in window.get("logs") or []:
            content = self._terminals.read_text(number, LOG_CONTENT_KIND, str(log.get("id") or ""))
            inputs.append(
                {
                    "id": str(log.get("id") or ""),
                    "date": str(log.get("date") or ""),
                    "source": str(log.get("source") or ""),
                    "status": str(log.get("status") or ""),
                    "content": content or "",
                }
            )
        return inputs

    def _export(self, window: Dict[str, Any]) -> Dict[str, Any]:
        number = int(window["terminal_number"])
        entry: Dict[str, Any] = {"number": number, "name": str(window.get("title") or "")}
        try:
            result = self._terminals.export_text(str(window["id"]), number)
        except Exception as exc:  # noqa: BLE001 - one terminal never aborts the pass
            ColorPrint.yellow(f"[{LABEL}] export raised terminal={number}: {type(exc).__name__}: {exc}")
            result = {"success": False, "error_code": ERROR_EXPORT_FAILED}
        if result.get("success") and result.get("text"):
            entry["text"] = result["text"]
            entry["signature"] = text_digest(result["text"])
            return entry
        entry["error_code"] = str(result.get("error_code") or ERROR_EXPORT_FAILED)
        entry["inputs"] = self._sent_inputs(number, window)
        entry["signature"] = inputs_digest(entry["inputs"])
        return entry

    def run_pass(self, forced: bool = False, reason: str = REASON_INTERVAL) -> Dict[str, Any]:
        """One backup pass; never raises. Result: success, written, deferred, error_code."""
        if not self._pass_lock.acquire(blocking=forced):
            return {"success": True, "written": False, "busy": True}
        try:
            result = self._pass(forced, reason)
            if not result.get("deferred"):
                self._deferred_since = None
                self._deferred_logged = False
                if result.get("success"):
                    self._store.record_pass(time.time())
            return result
        except Exception as exc:  # noqa: BLE001 - a backup failure must never reach the caller
            ColorPrint.red(f"[{LABEL}] pass failed reason={reason}: {type(exc).__name__}: {exc}")
            return {"success": False, "written": False, "error_code": ERROR_PASS_FAILED}
        finally:
            self._pass_lock.release()

    def _pass(self, forced: bool, reason: str) -> Dict[str, Any]:
        if self._activity_defers(forced):
            return self._deferred()
        windows = self._enumerate()
        if not windows:
            return {"success": True, "written": False, "terminal_count": 0}
        previous = self._store.previous_signatures()
        exported: List[Dict[str, Any]] = []
        for window in windows:
            if self._activity_defers(forced):
                return self._deferred()
            exported.append(self._export(window))
        for entry in exported:
            signature = entry.pop("signature")
            entry["changed"] = bool(signature) and signature != previous.get(entry["number"])
        if not forced and not any(entry["changed"] for entry in exported):
            return {"success": True, "written": False, "terminal_count": len(exported)}
        saved = self._store.save(exported)
        if not saved.get("success"):
            return {**saved, "written": False}
        failed = sum(1 for entry in exported if entry.get("error_code"))
        ColorPrint.green(
            f"[{LABEL}] backup written reason={reason} terminals={saved['terminal_count']} "
            f"failed={failed} bytes={saved['total_bytes']} path={saved['path']}"
        )
        self._announce(saved["terminal_count"], saved["total_bytes"])
        return {**saved, "written": True, "failed": failed}

    def _deferred(self) -> Dict[str, Any]:
        if not self._deferred_logged:
            ColorPrint.blue(f"[{LABEL}] pass deferred: user is typing; retry every {DEFER_RETRY_SECONDS}s, max {MAX_DEFER_SECONDS}s")
            self._deferred_logged = True
        return {"success": True, "written": False, "deferred": True}

    def _announce(self, terminal_count: int, total_bytes: int) -> None:
        message = i18n.get(I18nKeys.TERMINAL_BACKUP_MESSAGE).format(
            count=terminal_count,
            kb=kilobytes(total_bytes),
        )
        self._notify(i18n.get(I18nKeys.TERMINAL_BACKUP_TITLE), message)

    def start(self) -> bool:
        """Start the scheduler thread; it runs passes only while this process holds the machine-wide lease."""
        if self._thread is not None:
            return True
        if not has_graphical_display():
            ColorPrint.blue(f"[{LABEL}] scheduler idle: {ERROR_NO_DISPLAY}")
            return False
        THREAD_BUS.clear_signal(STOP_SIGNAL)
        self._thread = threading.Thread(target=self._run, name="TerminalBackupSchedulerThread", daemon=True)
        self._thread.start()
        THREAD_BUS.register_shutdown_handler(
            self._shutdown,
            priority=SHUTDOWN_HANDLER_PRIORITY,
            name=SHUTDOWN_HANDLER_NAME,
        )
        return True

    def _acquire_lease(self) -> bool:
        waiting_logged = False
        while not self._stopping():
            lease = self._lease_lock.try_hold()
            if lease is not None:
                self._lease = lease
                return True
            if not waiting_logged:
                ColorPrint.blue(f"[{LABEL}] scheduler lease held by another process; waiting")
                waiting_logged = True
            if THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=BACKUP_INTERVAL_SECONDS):
                break
        return False

    @staticmethod
    def _stopping() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(THREAD_BUS.get_signal(STOP_SIGNAL, False))

    def _run(self) -> None:
        if not self._acquire_lease():
            return
        ColorPrint.green(f"[{LABEL}] scheduler started interval={BACKUP_INTERVAL_SECONDS}s")
        low_battery_armed = True
        next_due = time.monotonic() + self._initial_wait()
        while not self._stopping():
            delay = max(0.0, next_due - time.monotonic())
            if THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=delay):
                return
            power = read_power_state()
            if power.at_or_below(LOW_BATTERY_PERCENT):
                if low_battery_armed:
                    low_battery_armed = False
                    ColorPrint.yellow(f"[{LABEL}] battery low percent={power.percent:g}: forced backup")
                    self.run_pass(forced=True, reason=REASON_LOW_BATTERY)
                    next_due = time.monotonic() + BACKUP_INTERVAL_SECONDS
            else:
                low_battery_armed = True
            if time.monotonic() < next_due or self._stopping():
                continue
            result = self.run_pass()
            next_due = time.monotonic() + (DEFER_RETRY_SECONDS if result.get("deferred") else BACKUP_INTERVAL_SECONDS)

    def _initial_wait(self) -> float:
        """Seconds until the first pass of this process: the persisted schedule survives restarts, an overdue pass runs after the settle delay."""
        last_pass = self._store.last_pass_at()
        if last_pass is None:
            return float(BACKUP_INTERVAL_SECONDS)
        remaining = min(last_pass + BACKUP_INTERVAL_SECONDS - time.time(), float(BACKUP_INTERVAL_SECONDS))
        if remaining <= SETTLE_SECONDS:
            ColorPrint.blue(f"[{LABEL}] pass overdue at start: running in {SETTLE_SECONDS}s")
        return max(float(SETTLE_SECONDS), remaining)

    def _shutdown(self) -> None:
        THREAD_BUS.signal(STOP_SIGNAL, True)
        if self._lease is None:
            return
        if THREAD_BUS.is_restart_requested():
            ColorPrint.blue(f"[{LABEL}] restart requested: the next process continues the schedule")
        else:
            ColorPrint.blue(f"[{LABEL}] final backup before shutdown")
            self.run_pass(forced=True, reason=REASON_SHUTDOWN)
        lease, self._lease = self._lease, None
        if lease is not None:
            self._lease_lock.release_hold(lease)


terminal_backup_service = TerminalBackupService()
