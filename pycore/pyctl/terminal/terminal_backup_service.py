# -*- coding: utf-8 -*-
"""Periodic backup of every terminal's exported text, with change detection and forced passes."""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.terminal.terminal_backup_store import (
    TERMINAL_BACKUP_DIR_NAME,
    TerminalBackupStore,
    inputs_digest,
    kilobytes,
    terminal_backup_store,
    text_digest,
)
from pycore.pyctl.terminal.terminal_prompt_detector import TerminalPromptWatch, waiting_prompt
from pycore.pyctl.terminal.terminal_prompt_handler import TerminalPromptHandler
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
from pycore.pyutils.window.focus_guard import FocusGuard, focus_guard

LABEL = "TerminalBackup"
BACKUP_INTERVAL_SECONDS = relay_contract.limit("terminal_backup_interval_seconds")
PROMPT_INTERVAL_SECONDS = relay_contract.limit("terminal_backup_prompt_interval_seconds")
PROMPT_MISS_LIMIT = relay_contract.limit("terminal_backup_prompt_miss_limit")
LOW_BATTERY_PERCENT = relay_contract.limit("terminal_backup_low_battery_percent")
MIN_IDLE_SECONDS = relay_contract.limit("terminal_backup_min_idle_seconds")
DEFER_RETRY_SECONDS = relay_contract.limit("terminal_backup_defer_retry_seconds")
SETTLE_SECONDS = relay_contract.limit("terminal_backup_settle_seconds")
INPUT_TIMESTAMP_TOLERANCE_SECONDS = 1.0
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
# Automatic terminal text scanning runs by default; the UI can pause it until restart.
AUTO_BACKUP_PAUSED_BY_DEFAULT = False


class TerminalBackupService:
    def __init__(
        self,
        terminals: Any = terminal_service,
        store: TerminalBackupStore = terminal_backup_store,
        idle_seconds: Callable[[], Optional[float]] = user_idle_seconds,
        notify: Callable[[str, str], Any] = show_system_notification,
        focus: FocusGuard = focus_guard,
        prompt_watch: Optional[TerminalPromptWatch] = None,
        prompt_handler: Optional[TerminalPromptHandler] = None,
    ) -> None:
        self._terminals = terminals
        self._store = store
        self._idle_seconds = idle_seconds
        self._notify = notify
        self._focus = focus
        self._prompt_watch = prompt_watch or TerminalPromptWatch()
        self._prompt_handler = prompt_handler or TerminalPromptHandler(terminals)
        self._pass_lock = threading.Lock()
        self._lease_lock = FileLockManager(SCHEDULER_LOCK_TARGET, verbose=False)
        self._lease: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        self._deferred_logged = False
        self._fast_prompts: Dict[int, Dict[str, Any]] = {}
        # In-memory only: a UI change lasts until this process exits; a pycore
        # restart returns to AUTO_BACKUP_PAUSED_BY_DEFAULT.
        self._paused = AUTO_BACKUP_PAUSED_BY_DEFAULT

    def _user_active(self, minimum_idle_seconds: float = MIN_IDLE_SECONDS) -> bool:
        idle = self._idle_seconds()
        return idle is not None and idle < minimum_idle_seconds

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

    def _scan_window(self, window: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
        entry = self._export(window)
        text = entry.get("text")
        if not text:
            return entry, False
        found_prompt = bool(waiting_prompt(text))
        refreshed = self._prompt_handler.handle(
            str(window["id"]),
            entry["number"],
            text,
            lambda: self._export(window).get("text"),
        )
        if refreshed != text:
            entry["text"] = refreshed
            entry["signature"] = text_digest(refreshed)
        return entry, found_prompt or bool(waiting_prompt(refreshed))

    def _observe_prompt(
        self,
        window: Dict[str, Any],
        entry: Dict[str, Any],
        found_prompt: bool,
        count_miss: bool = True,
    ) -> None:
        number = entry["number"]
        window_id = str(window["id"])
        state = self._fast_prompts.get(number)
        if found_prompt:
            if state is None or state["window_id"] != window_id:
                ColorPrint.blue(f"[{LABEL}] prompt follow-up started terminal={number} interval={PROMPT_INTERVAL_SECONDS}s")
            elif state["misses"]:
                ColorPrint.blue(f"[{LABEL}] prompt follow-up reset terminal={number} previous_misses={state['misses']}")
            self._fast_prompts[number] = {"window_id": window_id, "due": time.monotonic() + PROMPT_INTERVAL_SECONDS, "misses": 0}
            return
        if not count_miss:
            return
        if state is None or state["window_id"] != window_id:
            return
        if not entry.get("text"):
            state["due"] = time.monotonic() + PROMPT_INTERVAL_SECONDS
            return
        misses = int(state["misses"]) + 1
        if misses >= PROMPT_MISS_LIMIT:
            self._fast_prompts.pop(number, None)
            ColorPrint.blue(f"[{LABEL}] prompt follow-up ended terminal={number} misses={misses}")
            return
        state["misses"] = misses
        state["due"] = time.monotonic() + PROMPT_INTERVAL_SECONDS
        ColorPrint.blue(f"[{LABEL}] prompt follow-up scanned terminal={number} misses={misses}/{PROMPT_MISS_LIMIT}")

    def _prune_prompt_states(self, windows: List[Dict[str, Any]]) -> None:
        live = {int(window["terminal_number"]): str(window["id"]) for window in windows}
        for number, state in list(self._fast_prompts.items()):
            if live.get(number) != state["window_id"]:
                self._fast_prompts.pop(number, None)

    def _fast_due(self) -> float:
        return min((float(state["due"]) for state in self._fast_prompts.values()), default=float("inf"))

    def _activity_deadlines(
        self,
        now: float,
        idle: Optional[float],
        last_input_at: Optional[float],
        next_due: float,
    ) -> Tuple[Optional[float], float]:
        if idle is None:
            return last_input_at, next_due
        input_at = now - idle
        if last_input_at is None:
            last_input_at = input_at
            if idle < MIN_IDLE_SECONDS:
                next_due = now + MIN_IDLE_SECONDS - idle
            if idle < PROMPT_INTERVAL_SECONDS:
                for state in self._fast_prompts.values():
                    state["due"] = now + PROMPT_INTERVAL_SECONDS - idle
        elif input_at > last_input_at + INPUT_TIMESTAMP_TOLERANCE_SECONDS:
            last_input_at = input_at
            next_due = max(now, input_at + MIN_IDLE_SECONDS)
            for state in self._fast_prompts.values():
                state["due"] = max(now, input_at + PROMPT_INTERVAL_SECONDS)
        if idle < MIN_IDLE_SECONDS:
            next_due = max(next_due, now + MIN_IDLE_SECONDS - idle)
        if idle < PROMPT_INTERVAL_SECONDS:
            for state in self._fast_prompts.values():
                state["due"] = max(state["due"], now + PROMPT_INTERVAL_SECONDS - idle)
        return last_input_at, next_due

    def _run_fast_pass(self, now: float) -> None:
        if not self._pass_lock.acquire(blocking=False):
            for state in self._fast_prompts.values():
                if state["due"] <= now:
                    state["due"] = now + DEFER_RETRY_SECONDS
            return
        try:
            if self._user_active(PROMPT_INTERVAL_SECONDS):
                return
            windows = self._enumerate()
            self._prune_prompt_states(windows)
            due_windows = [
                window for window in windows
                if int(window["terminal_number"]) in self._fast_prompts
                and self._fast_prompts[int(window["terminal_number"])]["due"] <= now
            ]
            previous = self._store.previous_signatures()
            exported: List[Dict[str, Any]] = []
            with self._focus.preserved(LABEL):
                for window in due_windows:
                    entry, found_prompt = self._scan_window(window)
                    self._observe_prompt(window, entry, found_prompt)
                    signature = entry.pop("signature")
                    entry["changed"] = bool(signature) and signature != previous.get(entry["number"])
                    exported.append(entry)
            self._alert_waiting_prompts(exported)
            if any(entry["changed"] for entry in exported):
                saved = self._store.save(exported, merge_previous=True)
                if saved.get("success"):
                    ColorPrint.green(
                        f"[{LABEL}] prompt follow-up backup written terminals={saved['terminal_count']} "
                        f"path={saved['path']}"
                    )
                else:
                    ColorPrint.yellow(f"[{LABEL}] prompt follow-up backup failed error={saved.get('error_code')}")
        except Exception as exc:  # noqa: BLE001 - a desktop scan failure must not stop the scheduler
            ColorPrint.yellow(f"[{LABEL}] prompt follow-up failed: {type(exc).__name__}: {exc}")
            for state in self._fast_prompts.values():
                if state["due"] <= now:
                    state["due"] = time.monotonic() + PROMPT_INTERVAL_SECONDS
        finally:
            self._pass_lock.release()

    def run_pass(self, forced: bool = False, reason: str = REASON_INTERVAL) -> Dict[str, Any]:
        """One backup pass; never raises. Result: success, written, deferred, error_code."""
        if not self._pass_lock.acquire(blocking=forced):
            return {"success": True, "written": False, "busy": True}
        try:
            result = self._pass(forced, reason)
            if not result.get("deferred"):
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
        if self._user_active():
            return self._deferred()
        windows = self._enumerate()
        self._prune_prompt_states(windows)
        if not windows:
            return {"success": True, "written": False, "terminal_count": 0}
        previous = self._store.previous_signatures()
        exported: List[Dict[str, Any]] = []
        with self._focus.preserved(LABEL):
            for window in windows:
                entry, found_prompt = self._scan_window(window)
                self._observe_prompt(window, entry, found_prompt, count_miss=False)
                exported.append(entry)
        for entry in exported:
            signature = entry.pop("signature")
            entry["changed"] = bool(signature) and signature != previous.get(entry["number"])
        self._alert_waiting_prompts(exported)
        if not forced and not any(entry["changed"] for entry in exported):
            return {"success": True, "written": False, "terminal_count": len(exported)}
        saved = self._store.save(exported)
        if not saved.get("success"):
            return {**saved, "written": False}
        failed = sum(1 for entry in exported if entry.get("error_code"))
        ColorPrint.green(
            f"[{LABEL}] backup written reason={reason} terminals={saved['terminal_count']} "
            f"failed={failed} bytes={saved['total_bytes']} stored={saved['stored_bytes']} path={saved['path']}"
        )
        self._announce(saved["terminal_count"], saved["total_bytes"], saved["stored_bytes"])
        return {**saved, "written": True, "failed": failed}

    def _alert_waiting_prompts(self, exported: List[Dict[str, Any]]) -> None:
        for entry in exported:
            if not entry.get("text") or not self._prompt_watch.check(entry["number"], entry["text"]):
                continue
            ColorPrint.yellow(f"[{LABEL}] confirmation prompt waiting terminal={entry['number']} name={entry['name']}")
            message = i18n.get(I18nKeys.TERMINAL_BACKUP_STUCK_MESSAGE).format(number=entry["number"], name=entry["name"])
            try:
                self._notify(i18n.get(I18nKeys.TERMINAL_BACKUP_STUCK_TITLE), message)
            except Exception as exc:  # noqa: BLE001 - an alert failure never aborts the backup
                ColorPrint.yellow(f"[{LABEL}] prompt alert failed terminal={entry['number']}: {type(exc).__name__}: {exc}")

    def _deferred(self) -> Dict[str, Any]:
        if not self._deferred_logged:
            ColorPrint.blue(f"[{LABEL}] pass deferred: recent input; waiting for {MIN_IDLE_SECONDS}s of inactivity")
            self._deferred_logged = True
        return {"success": True, "written": False, "deferred": True}

    def _announce(self, terminal_count: int, total_bytes: int, stored_bytes: int) -> None:
        message = i18n.get(I18nKeys.TERMINAL_BACKUP_MESSAGE).format(
            count=terminal_count,
            kb=kilobytes(total_bytes),
            stored_kb=kilobytes(stored_bytes),
        )
        self._notify(i18n.get(I18nKeys.TERMINAL_BACKUP_TITLE), message)

    def state(self) -> Dict[str, Any]:
        return {
            "success": True,
            "paused": self._paused,
            "running": self._thread is not None,
            "interval_seconds": BACKUP_INTERVAL_SECONDS,
            "last_pass_at": self._store.last_pass_at(),
        }

    def set_paused(self, paused: bool) -> Dict[str, Any]:
        """Pause or resume automatic passes (interval, low battery, shutdown) until the process restarts."""
        if paused != self._paused:
            self._paused = paused
            ColorPrint.blue(f"[{LABEL}] automatic backup {'paused until restart' if paused else 'resumed'}")
        return self.state()

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
        now = time.monotonic()
        idle = self._idle_seconds()
        last_input_at = now - idle if idle is not None else None
        next_due = now + self._initial_wait()
        if idle is not None and idle < MIN_IDLE_SECONDS:
            next_due = now + MIN_IDLE_SECONDS - idle
        while not self._stopping():
            due = next_due if self._paused else min(next_due, self._fast_due())
            delay = min(DEFER_RETRY_SECONDS, max(0.0, due - time.monotonic()))
            if THREAD_BUS.wait_signal(STOP_SIGNAL, timeout=delay):
                return
            now = time.monotonic()
            idle = self._idle_seconds()
            last_input_at, next_due = self._activity_deadlines(now, idle, last_input_at, next_due)
            if self._paused:
                low_battery_armed = True
                next_due = now + MIN_IDLE_SECONDS
                continue
            power = read_power_state()
            if power.at_or_below(LOW_BATTERY_PERCENT):
                if low_battery_armed and (idle is None or idle >= MIN_IDLE_SECONDS):
                    ColorPrint.yellow(f"[{LABEL}] battery low percent={power.percent:g}: forced backup")
                    result = self.run_pass(forced=True, reason=REASON_LOW_BATTERY)
                    if not result.get("deferred"):
                        low_battery_armed = True if not result.get("success") else False
                        next_due = time.monotonic() + BACKUP_INTERVAL_SECONDS
                        idle = self._idle_seconds()
                        last_input_at = time.monotonic() - idle if idle is not None else None
            else:
                low_battery_armed = True
            now = time.monotonic()
            if self._stopping():
                continue
            if now >= next_due and (idle is None or idle >= MIN_IDLE_SECONDS):
                result = self.run_pass()
                next_due = time.monotonic() + (DEFER_RETRY_SECONDS if result.get("deferred") else BACKUP_INTERVAL_SECONDS)
            elif now >= self._fast_due() and (idle is None or idle >= PROMPT_INTERVAL_SECONDS):
                self._run_fast_pass(now)
            idle = self._idle_seconds()
            last_input_at = time.monotonic() - idle if idle is not None else None

    def _initial_wait(self) -> float:
        """Seconds until the first pass of this process: the persisted schedule survives restarts, an overdue pass runs after the settle delay."""
        last_pass = self._store.last_pass_at()
        if last_pass is None:
            return float(MIN_IDLE_SECONDS)
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
        elif self._paused:
            ColorPrint.blue(f"[{LABEL}] automatic backup paused: no final backup before shutdown")
        else:
            ColorPrint.blue(f"[{LABEL}] final backup before shutdown")
            self.run_pass(forced=True, reason=REASON_SHUTDOWN)
        lease, self._lease = self._lease, None
        if lease is not None:
            self._lease_lock.release_hold(lease)


terminal_backup_service = TerminalBackupService()
