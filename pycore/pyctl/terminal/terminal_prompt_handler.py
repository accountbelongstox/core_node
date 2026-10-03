from __future__ import annotations

import time
from typing import Any, Callable, Optional

from pycore.pyctl.terminal.terminal_prompt_detector import default_yes_prompt
from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


LABEL = "TerminalPromptHandler"
MAX_ENTER_ATTEMPTS = 3
PROMPT_SETTLE_SECONDS = 0.25


class TerminalPromptHandler:
    def __init__(self, terminals: Any = terminal_service) -> None:
        self._terminals = terminals

    def handle(
        self,
        window_id: str,
        terminal_number: int,
        text: str,
        capture: Callable[[], Optional[str]],
    ) -> str:
        current_text = text
        for attempt in range(1, MAX_ENTER_ATTEMPTS + 1):
            if not default_yes_prompt(current_text):
                break
            try:
                result = self._terminals.press_enter(window_id, terminal_number)
            except Exception as exc:  # noqa: BLE001 - desktop input is an external boundary
                ColorPrint.yellow(
                    f"[{LABEL}] Enter failed terminal={terminal_number} attempt={attempt}: "
                    f"{type(exc).__name__}: {exc}"
                )
                break
            if not result.get("success"):
                ColorPrint.yellow(
                    f"[{LABEL}] Enter failed terminal={terminal_number} attempt={attempt} "
                    f"error={result.get('error_code')}"
                )
                break
            ColorPrint.blue(f"[{LABEL}] sent Enter terminal={terminal_number} attempt={attempt}")
            time.sleep(PROMPT_SETTLE_SECONDS)
            refreshed = capture()
            if refreshed is None:
                ColorPrint.yellow(f"[{LABEL}] prompt refresh failed terminal={terminal_number}")
                break
            current_text = refreshed
        return current_text
