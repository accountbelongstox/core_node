# -*- coding: utf-8 -*-
"""Delivers a queued "restore the last conversation" request: once the backed-up terminal numbers run an AI agent again (or the wait ends), each such terminal gets its own backed-up history and a continue instruction through the terminal input path."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyctl.terminal.terminal_backup_page import TerminalBackupPage, terminal_backup_page
from pycore.pyctl.terminal.terminal_restore_request import TerminalRestoreRequestStore, terminal_restore_requests
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.relay_contract import relay_contract

LABEL = "TerminalConversationRestore"
RESTORE_WAIT_SECONDS = relay_contract.limit("terminal_backup_restore_wait_seconds")
RESTORE_EXPIRE_SECONDS = relay_contract.limit("terminal_backup_restore_expire_seconds")
RESTORE_MAX_CHARS = relay_contract.limit("terminal_backup_restore_max_chars")
RESTORE_SOURCE = "restore"
# Sent to the AI agent in the terminal, not shown in a UI: always English.
RESTORE_MESSAGE_TEMPLATE = (
    "This terminal was restarted. Below is its terminal history from the previous session "
    "(backup {backup_id}; full history file: {path}{truncated}). "
    "Continue the work from where it stopped: check whether the last task was completed and, if not, continue it; "
    "if it is complete, finish with a short summary of what was done and verified. "
    "Other AI agents may have changed the code in the meantime, so re-check the current state before editing.\n\n"
    "{text}"
)
TRUNCATED_NOTE_TEMPLATE = "; only the last {chars} characters are included here, read the file for the rest"


class TerminalConversationRestore:
    def __init__(
        self,
        terminals: Any,
        requests: TerminalRestoreRequestStore = terminal_restore_requests,
        page: TerminalBackupPage = terminal_backup_page,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._terminals = terminals
        self._requests = requests
        self._page = page
        self._clock = clock

    def pending(self) -> bool:
        return self._requests.read() is not None

    @staticmethod
    def _agents(windows: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        return {int(window["terminal_number"]): window for window in windows if window.get("ai_agent")}

    def due(self, windows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """The request once every backed-up terminal runs an agent or the wait is over; an expired request is dropped."""
        request = self._requests.read()
        if request is None:
            return None
        age = self._clock() - request["requested_at"]
        if age > RESTORE_EXPIRE_SECONDS or age < 0:
            ColorPrint.yellow(f"[{LABEL}] request for backup {request['backup_id']} expired")
            self._requests.clear()
            return None
        if age < RESTORE_WAIT_SECONDS and not set(request["numbers"]) <= set(self._agents(windows)):
            return None
        return request

    def deliver(self, request: Dict[str, Any], windows: List[Dict[str, Any]]) -> None:
        """Send each backed-up terminal its history; the request is cleared first, so it is delivered at most once."""
        self._requests.clear()
        agents = self._agents(windows)
        built = self._page.build(request["backup_id"], request["numbers"] or None)
        if not built["success"]:
            ColorPrint.yellow(f"[{LABEL}] backup {request['backup_id']} unavailable: {built.get('error_code')}")
            return
        for terminal in built["terminals"]:
            number = terminal["number"]
            window = agents.get(number)
            if window is None:
                ColorPrint.yellow(f"[{LABEL}] skipped terminal={number}: no AI agent running in it")
                continue
            result = self._terminals.input_text(str(window["id"]), number, self._message(request["backup_id"], terminal), RESTORE_SOURCE)
            if result.get("success"):
                ColorPrint.green(f"[{LABEL}] restored terminal={number} chars={min(len(terminal['text']), RESTORE_MAX_CHARS)}")
            else:
                ColorPrint.yellow(f"[{LABEL}] send failed terminal={number} error={result.get('error_code')}")

    @staticmethod
    def _message(backup_id: str, terminal: Dict[str, Any]) -> str:
        text = terminal["text"]
        truncated = ""
        if len(text) > RESTORE_MAX_CHARS:
            text = text[-RESTORE_MAX_CHARS:]
            truncated = TRUNCATED_NOTE_TEMPLATE.format(chars=RESTORE_MAX_CHARS)
        return RESTORE_MESSAGE_TEMPLATE.format(backup_id=backup_id, path=terminal["path"], truncated=truncated, text=text)
