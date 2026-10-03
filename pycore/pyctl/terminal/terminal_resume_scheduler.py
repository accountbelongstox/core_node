# -*- coding: utf-8 -*-
"""Per-terminal resume timers: a usage-limit notice with a reset time ("try again at 2:25 PM") schedules a resume message shortly after that time."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

from pycore.pyctl.terminal.terminal_backup_store import TERMINAL_BACKUP_DIR_NAME, text_digest
from pycore.pyctl.terminal.terminal_prompt_detector import tail_lines, usage_limit_reset
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyutils.common.relay_contract import relay_contract

LABEL = "TerminalResume"
RESUME_DELAY_SECONDS = relay_contract.limit("terminal_backup_resume_delay_seconds")
RESUME_ATTEMPTS = relay_contract.limit("terminal_backup_resume_attempts")
RESUME_ATTEMPT_INTERVAL_SECONDS = relay_contract.limit("terminal_backup_resume_attempt_interval_seconds")
RESUME_STATE_PATH = APP_DATA_DIR / TERMINAL_BACKUP_DIR_NAME / "resume_timers.json"
# Sent to the AI agent in the terminal, not shown in a UI: always English.
RESUME_MESSAGE = (
    "The usage limit has reset. Was the previous task completed? "
    "If not, continue it from where it stopped. "
    "If it is complete, finish with a short summary report of what was done and verified. "
    "If something else happened (blocked, failed, or a decision is needed), report the situation and the possible options. "
    "Other AI agents may have changed the code in the meantime, so re-check the current state before editing."
)
RESUME_SOURCE = "resume"
HANDLED_KEEP_SECONDS = 20 * 60 * 60
MESSAGE_ECHO_LINES = 3
MESSAGE_ECHO_PREFIX_CHARS = 32


class TerminalResumeScheduler:
    def __init__(self, terminals: Any, store_path=RESUME_STATE_PATH, clock: Callable[[], float] = time.time) -> None:
        self._terminals = terminals
        self._clock = clock
        self._lock = threading.Lock()
        self._store = AtomicJsonStore(store_path, dict)
        self._timers: Dict[str, Dict[str, Any]] = {}
        self._handled: Dict[str, float] = {}
        self._load()

    # ---- state ------------------------------------------------------------------

    def _load(self) -> None:
        try:
            saved = self._store.read()
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] state read failed: {type(exc).__name__}: {exc}")
            return
        for number, timer in (saved.get("timers") or {}).items():
            if (
                str(number).isdigit() and isinstance(timer, dict)
                and isinstance(timer.get("window_id"), str) and isinstance(timer.get("key"), str)
                and isinstance(timer.get("due_at"), (int, float)) and not isinstance(timer.get("due_at"), bool)
            ):
                self._timers[str(number)] = {"window_id": timer["window_id"], "key": timer["key"], "due_at": float(timer["due_at"])}
        for handled_key, handled_at in (saved.get("handled") or {}).items():
            if isinstance(handled_at, (int, float)) and not isinstance(handled_at, bool):
                self._handled[str(handled_key)] = float(handled_at)

    def _save(self) -> None:
        cutoff = self._clock() - HANDLED_KEEP_SECONDS
        self._handled = {key: at for key, at in self._handled.items() if at >= cutoff}
        try:
            self._store.write({"timers": self._timers, "handled": self._handled})
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] state write failed: {type(exc).__name__}: {exc}")

    @staticmethod
    def _handled_key(number: int, window_id: str, key: str) -> str:
        return f"{number}|{window_id}|{key}"

    # ---- observe ----------------------------------------------------------------

    def observe(self, number: int, window_id: str, text: Optional[str]) -> None:
        """Arm a timer when the terminal tail shows a usage-limit reset time not handled yet."""
        found = usage_limit_reset(text or "")
        if found is None:
            return
        key, reset = found
        with self._lock:
            if self._handled_key(number, window_id, key) in self._handled:
                return
            timer = self._timers.get(str(number))
            if timer is not None and timer["window_id"] == window_id and timer["key"] == key:
                return
            due_at = (reset + timedelta(seconds=RESUME_DELAY_SECONDS)).timestamp()
            self._timers[str(number)] = {"window_id": window_id, "key": key, "due_at": due_at}
            self._save()
        ColorPrint.blue(
            f"[{LABEL}] timer armed terminal={number} notice='{key}' "
            f"resume_at={datetime.fromtimestamp(due_at).isoformat(timespec='seconds')}"
        )

    def next_due(self) -> Optional[float]:
        """Wall-clock time of the earliest timer, or None."""
        with self._lock:
            return min((timer["due_at"] for timer in self._timers.values()), default=None)

    def timers(self) -> Dict[int, Dict[str, Any]]:
        """Armed timers by terminal: {window_id, key, due_at (wall seconds)}."""
        with self._lock:
            return {int(number): dict(timer) for number, timer in self._timers.items()}

    # ---- fire -------------------------------------------------------------------

    def run_due(self, windows: List[Dict[str, Any]], capture: Callable[[Dict[str, Any]], Optional[str]]) -> None:
        """Send the resume message to every due terminal whose notice is still on screen; never raises."""
        now = self._clock()
        live = {int(window["terminal_number"]): window for window in windows}
        with self._lock:
            due = [(int(number), dict(timer)) for number, timer in self._timers.items() if timer["due_at"] <= now]
        for number, timer in due:
            window = live.get(number)
            try:
                if window is None or str(window["id"]) != timer["window_id"]:
                    ColorPrint.blue(f"[{LABEL}] skipped terminal={number}: window closed or replaced")
                else:
                    self._resume(number, window, timer["key"], capture)
            except Exception as exc:  # noqa: BLE001 - desktop input is an external boundary
                ColorPrint.yellow(f"[{LABEL}] resume failed terminal={number}: {type(exc).__name__}: {exc}")
            with self._lock:
                if self._timers.get(str(number), {}).get("key") == timer["key"]:
                    self._timers.pop(str(number), None)
                self._handled[self._handled_key(number, timer["window_id"], timer["key"])] = self._clock()
                self._save()

    def _notice_present(self, text: Optional[str], key: str) -> bool:
        found = usage_limit_reset(text or "")
        return found is not None and found[0] == key

    @staticmethod
    def _message_pending(text: Optional[str]) -> bool:
        prefix = RESUME_MESSAGE[:MESSAGE_ECHO_PREFIX_CHARS]
        return any(prefix in line for line in tail_lines(text or "")[-MESSAGE_ECHO_LINES:])

    def _resume(self, number: int, window: Dict[str, Any], key: str, capture: Callable[[Dict[str, Any]], Optional[str]]) -> None:
        window_id = str(window["id"])
        last_digest = None
        for attempt in range(1, RESUME_ATTEMPTS + 1):
            if attempt > 1:
                time.sleep(RESUME_ATTEMPT_INTERVAL_SECONDS)
            text = capture(window)
            if not self._notice_present(text, key):
                ColorPrint.blue(f"[{LABEL}] stopped terminal={number} attempt={attempt}: notice gone (terminal moved on)")
                return
            digest = text_digest(text or "")
            if attempt == 1:
                result = self._terminals.input_text(window_id, number, RESUME_MESSAGE, RESUME_SOURCE)
            elif digest == last_digest or self._message_pending(text):
                result = self._terminals.press_enter(window_id, number)
            else:
                ColorPrint.blue(f"[{LABEL}] accepted terminal={number} attempt={attempt - 1}")
                return
            if not result.get("success"):
                ColorPrint.yellow(f"[{LABEL}] send failed terminal={number} attempt={attempt} error={result.get('error_code')}")
                return
            ColorPrint.green(f"[{LABEL}] sent terminal={number} attempt={attempt} {'message' if attempt == 1 else 'enter'}")
            refreshed = capture(window)
            last_digest = text_digest(refreshed or "") if refreshed is not None else None
