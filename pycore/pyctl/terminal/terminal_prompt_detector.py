# -*- coding: utf-8 -*-
"""Detects an AI agent waiting on a confirmation prompt (e.g. "Do you want to proceed?" / "❯ 1. Yes") at the tail of exported terminal text."""

from __future__ import annotations

import hashlib
import re
import threading
from typing import Dict, List, Optional

TAIL_LINE_COUNT = 14
TAIL_CHAR_LIMIT = 8192
MIN_SIGNAL_COUNT = 2
BASH_PROMPT_TAIL_LINES = 3
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])")
FRAME_CHARS = "│┃║|╭╮╰╯─━═┌┐└┘├┤┬┴┼"
QUESTION_PATTERN = re.compile(
    r"\b(?:do you want to|would you like to|proceed|continue|allow|approve|confirm|are you sure)\b[^?\n]*\?",
    re.IGNORECASE,
)
SELECTED_YES_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)\s*1\s*[.)]\s*yes\b", re.IGNORECASE)
OPTION_YES_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*1\s*[.)]\s*yes\b", re.IGNORECASE)
OPTION_NEXT_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*[2-9]\s*[.)]\s*\S", re.IGNORECASE)
SELECTED_OTHER_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)\s*[2-9]\s*[.)]\s*\S", re.IGNORECASE)
SECOND_YES_DONT_ASK_PATTERN = re.compile(
    r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*2\s*[.)].*\bdon\W*t\s+ask\b",
    re.IGNORECASE,
)
HINT_PATTERN = re.compile(r"\besc\b.*\b(?:cancel|exit)\b|\benter\b.*\b(?:select|confirm)\b", re.IGNORECASE)
BASH_COMMAND_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*bash\s+command\b", re.IGNORECASE)


def _clean_line(line: str) -> str:
    return ANSI_ESCAPE_PATTERN.sub("", line).strip().strip(FRAME_CHARS).strip()


def tail_lines(text: str) -> List[str]:
    """Last non-empty, ANSI- and frame-stripped lines of the text."""
    lines = [_clean_line(line) for line in text[-TAIL_CHAR_LIMIT:].replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return [line for line in lines if line][-TAIL_LINE_COUNT:]


def confirmation_prompt(text: str) -> Optional[str]:
    """Digest of the waiting prompt when the tail shows one, else None; at least two independent signals are required."""
    lines = tail_lines(text or "")
    if not lines:
        return None
    selected = any(SELECTED_YES_PATTERN.match(line) for line in lines)
    option_yes = selected or any(OPTION_YES_PATTERN.match(line) for line in lines)
    if not option_yes:
        return None
    signals = [
        selected,
        any(QUESTION_PATTERN.search(line) for line in lines),
        any(OPTION_NEXT_PATTERN.match(line) and not OPTION_YES_PATTERN.match(line) for line in lines),
        any(HINT_PATTERN.search(line) for line in lines),
    ]
    if sum(signals) < MIN_SIGNAL_COUNT:
        return None
    return hashlib.sha256("\n".join(lines).encode("utf-8", "replace")).hexdigest()


def default_yes_prompt(text: str) -> bool:
    """Only send Enter when a detected prompt has Yes as the default selection."""
    lines = tail_lines(text)
    if not lines or not confirmation_prompt(text):
        return False
    if any(SELECTED_OTHER_PATTERN.match(line) for line in lines):
        return False
    return bool(
        OPTION_YES_PATTERN.match(lines[-1])
        or OPTION_NEXT_PATTERN.match(lines[-1])
        or HINT_PATTERN.search(lines[-1])
    )


def second_yes_prompt(text: str) -> bool:
    """Detect a Yes choice whose second option suppresses future questions."""
    lines = tail_lines(text)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    if not yes_positions:
        return False
    options = lines[yes_positions[-1] + 1:]
    if not any(SECOND_YES_DONT_ASK_PATTERN.match(line) for line in options):
        return False
    if any(
        SELECTED_OTHER_PATTERN.match(line) and not SECOND_YES_DONT_ASK_PATTERN.match(line)
        for line in options
    ):
        return False
    if not (
        OPTION_YES_PATTERN.match(lines[-1])
        or OPTION_NEXT_PATTERN.match(lines[-1])
        or HINT_PATTERN.search(lines[-1])
    ):
        return False
    return bool(confirmation_prompt(text) or second_yes_selected(text))


def second_yes_selected(text: str) -> bool:
    lines = tail_lines(text)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    if not yes_positions:
        return False
    return any(
        SELECTED_OTHER_PATTERN.match(line) and SECOND_YES_DONT_ASK_PATTERN.match(line)
        for line in lines[yes_positions[-1] + 1:]
    )


def bash_command_prompt(text: str) -> bool:
    lines = tail_lines(text)
    return len(lines) >= 2 and any(
        BASH_COMMAND_PATTERN.match(line) for line in lines[-BASH_PROMPT_TAIL_LINES:-1]
    )


def waiting_prompt(text: str) -> Optional[str]:
    digest = confirmation_prompt(text)
    if digest:
        return digest
    if second_yes_prompt(text) or bash_command_prompt(text):
        return hashlib.sha256("\n".join(tail_lines(text)).encode("utf-8", "replace")).hexdigest()
    return None


class TerminalPromptWatch:
    """Remembers the prompt last reported per terminal so one waiting prompt alerts once; a cleared prompt re-arms the terminal."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._reported: Dict[int, str] = {}

    def check(self, number: int, text: Optional[str]) -> bool:
        """True when the terminal newly shows a confirmation prompt that has not been reported yet."""
        digest = waiting_prompt(text) if text else None
        with self._lock:
            if digest is None:
                if text:
                    self._reported.pop(number, None)
                return False
            if self._reported.get(number) == digest:
                return False
            self._reported[number] = digest
            return True
