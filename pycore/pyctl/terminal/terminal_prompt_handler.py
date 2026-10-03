from __future__ import annotations

import time
from typing import Any, Callable, Optional

from pycore.pyctl.terminal.terminal_prompt_detector import (
    default_yes_prompt,
    second_yes_prompt,
    second_yes_selected,
)
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
            use_second_yes = second_yes_prompt(current_text)
            if not use_second_yes and not default_yes_prompt(current_text):
                break
            try:
                result = (
                    self._terminals.choose_option(window_id, terminal_number, 2)
                    if use_second_yes and not second_yes_selected(current_text)
                    else self._terminals.press_enter(window_id, terminal_number)
                )
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
            ColorPrint.blue(
                f"[{LABEL}] selected Yes terminal={terminal_number} "
                f"option={2 if use_second_yes else 1} attempt={attempt}"
            )
            time.sleep(PROMPT_SETTLE_SECONDS)
            refreshed = capture()
            if refreshed is None:
                ColorPrint.yellow(f"[{LABEL}] prompt refresh failed terminal={terminal_number}")
                break
            current_text = refreshed
        return current_text
