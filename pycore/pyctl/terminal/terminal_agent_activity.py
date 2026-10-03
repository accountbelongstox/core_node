# -*- coding: utf-8 -*-
"""AI-agent working/idle state per terminal and the "agent finished" notification.

Evidence: the window title (Claude Code spins a glyph while working and shows a
star when idle; read on every snapshot) and, for agents without title glyphs,
the scan text ("esc to interrupt" while working). A working -> idle transition
after at least BUSY_MIN_SECONDS pops one desktop notification and stamps
`finished_at`, which snapshots carry to the UI as `agent_activity`.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any, Callable, Dict, Optional

from pycore.pyctl.terminal.terminal_prompt_detector import tail_lines
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step11_desktop.system_notification import show_system_notification

LABEL = "TerminalAgentActivity"
TITLE_WORKING_PATTERN = re.compile(r"(?:^|[\s\-])(?:[◐◑◒◓]|[⠁-⣿])\s+\S")
TITLE_IDLE_PATTERN = re.compile(r"(?:^|[\s\-])✳\s+\S")
TEXT_WORKING_PATTERN = re.compile(r"\besc\s+to\s+interrupt\b", re.IGNORECASE)
TEXT_WORKING_TAIL_LINES = 12
BUSY_MIN_SECONDS = 5.0
POLL_SECONDS = relay_contract.limit("terminal_agent_activity_poll_seconds")


class TerminalAgentActivity:
    """Working/idle tracker bound to each terminal's window id."""

    def __init__(self, notify: Callable[[str, str], Any] = show_system_notification) -> None:
        self._notify = notify
        self._states: Dict[int, Dict[str, Any]] = {}
        init_serialized_owner(self, "pyctl.terminal.agent_activity", "TerminalAgentActivityOwner")

    @staticmethod
    def title_busy(title: str) -> Optional[bool]:
        if TITLE_WORKING_PATTERN.search(title):
            return True
        if TITLE_IDLE_PATTERN.search(title):
            return False
        return None

    @staticmethod
    def text_busy(text: str) -> bool:
        return any(TEXT_WORKING_PATTERN.search(line) for line in tail_lines(text)[-TEXT_WORKING_TAIL_LINES:])

    def _state(self, number: int, window_id: str) -> Dict[str, Any]:
        state = self._states.get(number)
        if state is None or state["window_id"] != window_id:
            state = {"window_id": window_id, "busy": False, "busy_since": None, "text_busy": None, "finished_at": None}
            self._states[number] = state
        return state

    @serialized_method
    def observe_text(self, number: int, window_id: str, name: str, text: Optional[str]) -> None:
        if not text:
            return
        state = self._state(number, window_id)
        state["text_busy"] = self.text_busy(text)
        if state.get("title_busy") is None:
            self._apply(number, state, name, state["text_busy"])

    def _apply(self, number: int, state: Dict[str, Any], name: str, busy: Optional[bool]) -> None:
        if busy is None:
            return
        now = time.monotonic()
        if busy:
            if not state["busy"]:
                state["busy"] = True
                state["busy_since"] = now
            return
        if not state["busy"]:
            return
        worked = now - (state["busy_since"] or now)
        state["busy"] = False
        state["busy_since"] = None
        if worked < BUSY_MIN_SECONDS:
            return
        state["finished_at"] = time.time()
        ColorPrint.green(f"[{LABEL}] agent finished terminal={number} worked={worked:.0f}s name={name}")
        message = i18n.get(I18nKeys.TERMINAL_AGENT_DONE_MESSAGE).format(number=number, name=name)
        try:
            self._notify(i18n.get(I18nKeys.TERMINAL_AGENT_DONE_TITLE), message)
        except Exception as exc:  # noqa: BLE001 - a notification failure never stops tracking
            ColorPrint.yellow(f"[{LABEL}] notification failed terminal={number}: {type(exc).__name__}: {exc}")

    @serialized_method
    def decorate_snapshot(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        live: Dict[int, str] = {}
        for window in snapshot.get("windows") or []:
            number = int(window.get("terminal_number") or 0)
            if not window.get("online") or number <= 0:
                window["agent_activity"] = None
                continue
            window_id = str(window.get("id") or "")
            live[number] = window_id
            state = self._state(number, window_id)
            title_busy = self.title_busy(str(window.get("title") or ""))
            state["title_busy"] = title_busy
            name = str(window.get("custom_title") or window.get("short_title") or window.get("title") or "")
            self._apply(number, state, name, title_busy if title_busy is not None else state["text_busy"])
            window["agent_activity"] = {"busy": state["busy"], "finished_at": state["finished_at"]}
        for number in [number for number, state in self._states.items() if live.get(number) != state["window_id"]]:
            self._states.pop(number, None)
        return snapshot


class TerminalAgentActivityThread(threading.Thread):
    """Refreshes the terminal snapshot every POLL_SECONDS so title transitions are seen without a viewer."""

    def __init__(self, refresh: Callable[[], Any], stop_signal: str) -> None:
        super().__init__(name="TerminalAgentActivityThread", daemon=True)
        self._refresh = refresh
        self._stop_signal = stop_signal

    def run(self) -> None:
        while not THREAD_BUS.wait_signal(self._stop_signal, timeout=POLL_SECONDS):
            if THREAD_BUS.is_shutdown_requested():
                return
            try:
                self._refresh()
            except Exception as exc:  # noqa: BLE001 - thread boundary: one failed refresh is retried
                ColorPrint.yellow(f"[{LABEL}] snapshot refresh failed: {type(exc).__name__}: {exc}")


__all__ = ["TerminalAgentActivity", "TerminalAgentActivityThread"]
