from __future__ import annotations

import time
from typing import Any, Callable, Optional

from pycore.pyctl.terminal.terminal_prompt_detector import (
    bash_command_prompt,
    default_yes_prompt,
    mode_switch_option,
    mode_switch_selected,
    second_yes_prompt,
    selected_option,
    waiting_prompt,
)
from pycore.pyctl.terminal.terminal_service import terminal_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# AI AGENTS: frozen user-owned auto-confirm (Up/Down arrows + Enter on agent permission prompts).
# Never disable or change it unless the user's prompt asks for it; ignore its keys while programming.
LABEL = "PhysicalConfirmButton"
MAX_ENTER_ATTEMPTS = 3
PROMPT_SETTLE_SECONDS = 0.25


class PhysicalConfirmButtonHandler:
    def __init__(self, terminals: Any = terminal_service) -> None:
        self._terminals = terminals

    def confirm_by_physical_button(
        self,
        window_id: str,
        terminal_number: int,
        text: str,
        capture: Callable[[], Optional[str]],
    ) -> str:
        current_text = text
        moved = False
        for attempt in range(1, MAX_ENTER_ATTEMPTS + 1):
            use_second_yes = second_yes_prompt(current_text)
            use_bash_command = bash_command_prompt(current_text)
            recover = mode_switch_selected(current_text)
            if not use_second_yes and not use_bash_command and not recover and not default_yes_prompt(current_text):
                break
            target = 2 if use_second_yes else 1
            selected = selected_option(current_text) or 1
            if mode_switch_option(current_text, target):
                ColorPrint.yellow(f"[{LABEL}] skipped terminal={terminal_number}: option {target} switches the permission mode")
                break
            if selected != target and moved:
                ColorPrint.yellow(
                    f"[{LABEL}] skipped terminal={terminal_number}: selection is on option {selected} after one move; "
                    f"never moving twice"
                )
                break
            # A key sent after the prompt closed reaches the agent's own UI: re-read right before acting.
            fresh_text = capture()
            if fresh_text is None or waiting_prompt(fresh_text) != waiting_prompt(current_text):
                ColorPrint.yellow(f"[{LABEL}] skipped terminal={terminal_number}: prompt changed before the key was sent")
                if fresh_text is not None:
                    current_text = fresh_text
                break
            try:
                if selected == target:
                    result = self._terminals.press_enter(window_id, terminal_number)
                else:
                    moved = True
                    result = self._terminals.choose_option(window_id, terminal_number, target, from_option=selected)
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
                f"[{LABEL}] confirmed terminal={terminal_number} "
                f"prompt={'bash_command' if use_bash_command else 'yes'} "
                f"option={target} from={selected} attempt={attempt}"
            )
            time.sleep(PROMPT_SETTLE_SECONDS)
            refreshed = capture()
            if refreshed is None:
                ColorPrint.yellow(f"[{LABEL}] prompt refresh failed terminal={terminal_number}")
                break
            current_text = refreshed
        return current_text
