# -*- coding: utf-8 -*-
"""Detects an AI agent waiting on a confirmation prompt (e.g. "Do you want to proceed?" / "❯ 1. Yes") at the tail of exported terminal text."""

from __future__ import annotations

import hashlib
import re
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

TAIL_LINE_COUNT = 14
TAIL_CHAR_LIMIT = 8192
# A prompt whose options wrap a long command spans many lines: scan wider, then keep only the anchored prompt block.
PROMPT_SCAN_LINE_COUNT = 60
PROMPT_SCAN_CHAR_LIMIT = 16384
PROMPT_LOOKBACK_LINES = 4
PROMPT_ANCHOR_LINES = 3
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
    r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*2\s*[.)](?:.*\bdon\W*t\s+ask\b|\s*yes\b.*\ballow(?:ed)?\b)",
    re.IGNORECASE,
)
HINT_PATTERN = re.compile(r"\besc\b.*\b(?:cancel|exit)\b|\benter\b.*\b(?:select|confirm)\b", re.IGNORECASE)
OPTION_NUMBER_PATTERN = re.compile(r"^(?P<marker>❯|›|>|▶|►|➜|→|\*)?\s*(?P<number>[1-9])\s*[.)]\s*\S")
# Options that change the agent's permission mode are never chosen or confirmed automatically.
MODE_SWITCH_OPTION_PATTERN = re.compile(
    r"\bauto[\s-]*(?:mode|accept)|\bbypass(?:es)?\s+permissions?\b|\byolo\b|\ballow\s+all\s+edits\b",
    re.IGNORECASE,
)
BASH_COMMAND_PATTERN = re.compile(r"^(?:❯|›|>|▶|►|➜|→|\*)?\s*bash\s+command\b", re.IGNORECASE)

USAGE_LIMIT_PATTERN = re.compile(
    r"\b(?:try\s+again\s+at|resets?(?:\s+at)?)\s+"
    r"(?:(?P<month>[A-Za-z]{3,9})\.?\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?,?\s+(?:\d{4},?\s+)?(?:at\s+)?)?"
    r"(?:(?P<hour12>\d{1,2})(?::(?P<minute12>\d{2}))?\s*(?P<meridiem>[ap])\.?\s*m\b\.?|(?P<hour24>\d{1,2}):(?P<minute24>\d{2})\b)",
    re.IGNORECASE,
)
USAGE_LIMIT_PAST_GRACE = timedelta(hours=1)
USAGE_LIMIT_DATE_PAST_LIMIT = timedelta(days=180)


def _clean_line(line: str) -> str:
    return ANSI_ESCAPE_PATTERN.sub("", line).strip().strip(FRAME_CHARS).strip()


def tail_lines(text: str, count: int = TAIL_LINE_COUNT, char_limit: int = TAIL_CHAR_LIMIT) -> List[str]:
    """Last non-empty, ANSI- and frame-stripped lines of the text."""
    lines = [_clean_line(line) for line in text[-char_limit:].replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return [line for line in lines if line][-count:]


def _anchors_prompt(line: str) -> bool:
    return bool(OPTION_YES_PATTERN.match(line) or OPTION_NEXT_PATTERN.match(line) or HINT_PATTERN.search(line))


def prompt_lines(text: str) -> List[str]:
    """Lines of the prompt at the bottom: from just above the last "1. Yes" to the end when an option or hint closes it; a "1. Yes" followed by other output is stale and left out of the short tail."""
    lines = tail_lines(text or "", PROMPT_SCAN_LINE_COUNT, PROMPT_SCAN_CHAR_LIMIT)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    if not yes_positions:
        return lines[-TAIL_LINE_COUNT:]
    block = lines[max(0, yes_positions[-1] - PROMPT_LOOKBACK_LINES):]
    if any(_anchors_prompt(line) for line in block[-PROMPT_ANCHOR_LINES:]):
        return block
    return lines[yes_positions[-1] + 1:][-TAIL_LINE_COUNT:]


def confirmation_prompt(text: str) -> Optional[str]:
    """Digest of the waiting prompt when the tail shows one, else None; at least two independent signals are required."""
    lines = prompt_lines(text)
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
    """A detected Yes prompt whose selection may sit anywhere: the handler moves it back to the first Yes before Enter."""
    lines = prompt_lines(text)
    if not lines or not confirmation_prompt(text):
        return False
    return bool(
        OPTION_YES_PATTERN.match(lines[-1])
        or OPTION_NEXT_PATTERN.match(lines[-1])
        or HINT_PATTERN.search(lines[-1])
    )


def prompt_options(text: str) -> Dict[int, Tuple[str, bool]]:
    """Options of the bottom prompt from its "1. Yes": number -> (text incl. wrapped continuation lines, selected)."""
    lines = prompt_lines(text)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    options: Dict[int, Tuple[str, bool]] = {}
    current: Optional[int] = None
    for line in lines[yes_positions[-1]:] if yes_positions else []:
        match = OPTION_NUMBER_PATTERN.match(line)
        if match:
            current = int(match.group("number"))
            options[current] = (line, bool(match.group("marker")))
        elif current is not None and line.strip() and not HINT_PATTERN.search(line):
            options[current] = (f"{options[current][0]} {line.strip()}", options[current][1])
    return options


def mode_switch_option(text: str, number: int) -> bool:
    option = prompt_options(text).get(number)
    return option is not None and bool(MODE_SWITCH_OPTION_PATTERN.search(option[0]))


def selected_option(text: str) -> Optional[int]:
    return next((number for number, (_line, selected) in prompt_options(text).items() if selected), None)


def mode_switch_selected(text: str) -> bool:
    """A confirmation prompt whose selection sits on a permission-mode option (moved there by a stray key)."""
    selected = selected_option(text)
    return selected is not None and confirmation_prompt(text) is not None and mode_switch_option(text, selected)


def second_yes_prompt(text: str) -> bool:
    """Detect a Yes choice whose second option suppresses future questions (never one that switches the permission mode)."""
    if mode_switch_option(text, 2):
        return False
    lines = prompt_lines(text)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    if not yes_positions:
        return False
    options = lines[yes_positions[-1] + 1:]
    if not any(SECOND_YES_DONT_ASK_PATTERN.match(line) for line in options):
        return False
    if not (
        OPTION_YES_PATTERN.match(lines[-1])
        or OPTION_NEXT_PATTERN.match(lines[-1])
        or HINT_PATTERN.search(lines[-1])
    ):
        return False
    return bool(confirmation_prompt(text) or second_yes_selected(text))


def second_yes_selected(text: str) -> bool:
    lines = prompt_lines(text)
    yes_positions = [index for index, line in enumerate(lines) if OPTION_YES_PATTERN.match(line)]
    if not yes_positions:
        return False
    return any(
        SELECTED_OTHER_PATTERN.match(line) and SECOND_YES_DONT_ASK_PATTERN.match(line)
        for line in lines[yes_positions[-1] + 1:]
    )


def bash_command_prompt(text: str) -> bool:
    lines = prompt_lines(text)
    return len(lines) >= 2 and any(
        BASH_COMMAND_PATTERN.match(line) for line in lines[-BASH_PROMPT_TAIL_LINES:-1]
    )


def waiting_prompt(text: str) -> Optional[str]:
    digest = confirmation_prompt(text)
    if digest:
        return digest
    if second_yes_prompt(text) or bash_command_prompt(text):
        return hashlib.sha256("\n".join(prompt_lines(text)).encode("utf-8", "replace")).hexdigest()
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

    def waiting_numbers(self) -> List[int]:
        """Terminals whose last scan showed a waiting confirmation prompt."""
        with self._lock:
            return sorted(self._reported)


def _reset_time(match: "re.Match[str]", now: datetime) -> Optional[datetime]:
    if match.group("meridiem"):
        hour = int(match.group("hour12"))
        minute = int(match.group("minute12") or 0)
        if not 1 <= hour <= 12:
            return None
        hour = hour % 12 + (12 if match.group("meridiem").lower() == "p" else 0)
    else:
        hour = int(match.group("hour24"))
        minute = int(match.group("minute24"))
    if hour > 23 or minute > 59:
        return None
    if match.group("month"):
        try:
            month = datetime.strptime(match.group("month")[:3].title(), "%b").month
            reset = now.replace(month=month, day=int(match.group("day")), hour=hour, minute=minute, second=0, microsecond=0)
        except ValueError:
            return None
        return reset.replace(year=reset.year + 1) if reset < now - USAGE_LIMIT_DATE_PAST_LIMIT else reset
    reset = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return reset + timedelta(days=1) if reset < now - USAGE_LIMIT_PAST_GRACE else reset


def usage_limit_reset(text: str, now: Optional[datetime] = None) -> Optional[Tuple[str, datetime]]:
    """(minimal matched string, local reset time) of the last usage-limit reset notice in the tail, else None."""
    joined = " ".join(tail_lines(text or ""))
    matches = list(USAGE_LIMIT_PATTERN.finditer(joined))
    if not matches:
        return None
    match = matches[-1]
    reset = _reset_time(match, now or datetime.now())
    if reset is None:
        return None
    return " ".join(match.group(0).lower().split()), reset
