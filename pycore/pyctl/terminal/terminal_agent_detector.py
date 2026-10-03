# -*- coding: utf-8 -*-
"""Recognizes an AI coding agent (Claude Code, Gemini CLI, Kimi, Codex...) running in a terminal from its exported text or window title."""

from __future__ import annotations

import re
import time
from typing import Dict, List, Optional, Sequence, Tuple

from pycore.pyctl.terminal.terminal_prompt_detector import ANSI_ESCAPE_PATTERN, usage_limit_reset

TAIL_SCAN_LINES = 24
# The input box sits at the bottom; a team/agent list or status rows may follow it.
BOTTOM_SLACK_LINES = 12
MAX_INPUT_LINES = 12
RULE_CHARS = "─━"
RULE_MIN_LEAD = 3
RULE_MIN_CHARS = 20
# A wide glyph cut at the window edge is copied as a replacement character.
TRUNCATION_CHARS = "�…"
PROMPT_MARKERS = ("❯", ">", "›")
BOX_TOP_CHARS = "╭┌"
BOX_SIDE_CHARS = "│┃"
BOX_BOTTOM_CHARS = "╰└"
FOOTER_TAIL_LINES = 2
FOOTER_SEPARATOR = " · "
MENU_OPTION_PATTERN = re.compile(r"^›\s*\d+\s*[.)]")
# Agents put a status glyph in front of the session topic: Claude Code idle/working
# (✳ ◐ ◑ ◒ ◓) and braille spinners (Codex and others).
TITLE_GLYPH_PATTERN = re.compile(r"(?:^|[\s\-])(?:[✳◐◑◒◓]|[⠁-⣿])\s+\S")
RULE_FRAMED_INPUT = "framed_input"
RULE_BOXED_INPUT = "boxed_input"
RULE_PROMPT_FOOTER = "prompt_footer"
RULE_TITLE_GLYPH = "title_glyph"
SOURCE_TEXT = "text"
SOURCE_TITLE = "title"


def agent_tail(text: str, count: int = TAIL_SCAN_LINES) -> List[str]:
    """Last lines of the text without ANSI codes and trailing blanks; frame characters are kept."""
    lines = [
        ANSI_ESCAPE_PATTERN.sub("", line).rstrip()
        for line in (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines[-count:]


def is_horizontal_rule(line: str) -> bool:
    """A full-width input-box border, optionally labelled ("─── History 3/9 ───", "──── session-name ─")."""
    stripped = line.strip().rstrip(TRUNCATION_CHARS).strip()
    lead = len(stripped) - len(stripped.lstrip(RULE_CHARS))
    return lead >= RULE_MIN_LEAD and sum(stripped.count(char) for char in RULE_CHARS) >= RULE_MIN_CHARS


def starts_with_prompt(line: str) -> bool:
    return line.strip().startswith(PROMPT_MARKERS)


def _near_bottom(index: int, lines: Sequence[str]) -> bool:
    return index >= len(lines) - BOTTOM_SLACK_LINES


class FramedInputRule:
    """Prompt line between two horizontal rules (Claude Code, Gemini CLI)."""

    name = RULE_FRAMED_INPUT

    def match(self, lines: Sequence[str]) -> bool:
        rules = [index for index, line in enumerate(lines) if is_horizontal_rule(line)]
        return any(
            1 < lower - upper <= MAX_INPUT_LINES + 1
            and starts_with_prompt(lines[upper + 1])
            and _near_bottom(lower, lines)
            for upper, lower in zip(rules, rules[1:])
        )


def framed_input_text(text: Optional[str]) -> Optional[str]:
    """Text typed in the bottom framed input box (prompt marker removed), else None when there is no such box."""
    lines = agent_tail(text or "")
    rules = [index for index, line in enumerate(lines) if is_horizontal_rule(line)]
    for upper, lower in reversed(list(zip(rules, rules[1:]))):
        if 1 < lower - upper <= MAX_INPUT_LINES + 1 and starts_with_prompt(lines[upper + 1]) and _near_bottom(lower, lines):
            first = lines[upper + 1].strip()[1:]
            return "\n".join([first, *lines[upper + 2:lower]]).strip()
    return None


class BoxedInputRule:
    """Prompt line inside a rounded box (Kimi)."""

    name = RULE_BOXED_INPUT

    def match(self, lines: Sequence[str]) -> bool:
        for index, line in enumerate(lines[:-2]):
            stripped = line.strip()
            if not stripped.startswith(tuple(BOX_TOP_CHARS)) or not any(char in stripped for char in RULE_CHARS):
                continue
            side = lines[index + 1].strip()
            if not side.startswith(tuple(BOX_SIDE_CHARS)) or not starts_with_prompt(side[1:]):
                continue
            closing = lines[index + 2:index + 2 + MAX_INPUT_LINES]
            if any(row.strip().startswith(tuple(BOX_BOTTOM_CHARS)) for row in closing) and _near_bottom(index, lines):
                return True
        return False


class PromptFooterRule:
    """Bare prompt line followed by a model/status footer (Codex)."""

    name = RULE_PROMPT_FOOTER

    def match(self, lines: Sequence[str]) -> bool:
        footer = len(lines) - FOOTER_TAIL_LINES
        if not any(FOOTER_SEPARATOR in row for row in lines[footer:]):
            return False
        return any(
            line.strip().startswith("›")
            and not MENU_OPTION_PATTERN.match(line.strip())
            and footer - MAX_INPUT_LINES - 1 <= index < footer
            for index, line in enumerate(lines)
        )


class TerminalAgentDetector:
    """Ordered text rules; register() adds a rule (any object with name and match(lines))."""

    def __init__(self) -> None:
        self._rules: List[object] = [FramedInputRule(), BoxedInputRule(), PromptFooterRule()]

    def register(self, rule: object) -> None:
        self._rules.append(rule)

    def text_rule(self, text: Optional[str]) -> Optional[str]:
        """Name of the first rule the text tail matches, else None."""
        lines = agent_tail(text or "")
        if not lines:
            return None
        return next((rule.name for rule in self._rules if rule.match(lines)), None)

    @staticmethod
    def title_rule(title: Optional[str]) -> Optional[str]:
        return RULE_TITLE_GLYPH if TITLE_GLYPH_PATTERN.search(str(title or "")) else None


class TerminalAgentWatch:
    """Text-rule result of the last successful scan per terminal, bound to the window it was read from."""

    def __init__(self, detector: TerminalAgentDetector) -> None:
        self._detector = detector
        self._rules: Dict[int, Tuple[str, Optional[str]]] = {}
        self._plain: Dict[int, Tuple[str, str, float]] = {}

    def observe(self, number: int, window_id: str, text: Optional[str], title: str = "") -> None:
        """Record a scan; a failed export (no text) keeps the previous result."""
        if not text:
            return
        rule = self._detector.text_rule(text)
        self._rules[number] = (window_id, rule)
        if rule is None and not self._detector.title_rule(title) and usage_limit_reset(text) is None:
            self._plain[number] = (window_id, title, time.monotonic())
        else:
            self._plain.pop(number, None)

    def skip_scan(self, number: int, window_id: str, title: str, recheck_seconds: float) -> bool:
        """A scanned plain terminal (no agent) is skipped while its window and title are unchanged, until the recheck age."""
        plain = self._plain.get(number)
        return (
            plain is not None
            and plain[0] == window_id
            and plain[1] == title
            and time.monotonic() - plain[2] < recheck_seconds
        )

    def prune(self, live: Dict[int, str]) -> None:
        for number, (window_id, _title, _at) in list(self._plain.items()):
            if live.get(number) != window_id:
                self._plain.pop(number, None)
        for number, (window_id, _rule) in list(self._rules.items()):
            if live.get(number) != window_id:
                self._rules.pop(number, None)

    def detection(self, number: int, window_id: str, title: str) -> Optional[Dict[str, str]]:
        """{rule, source} for a window: a scan of this window decides, the title is the fallback before any scan."""
        scanned = self._rules.get(number)
        if scanned is not None and scanned[0] == window_id:
            return {"rule": scanned[1], "source": SOURCE_TEXT} if scanned[1] else None
        rule = self._detector.title_rule(title)
        return {"rule": rule, "source": SOURCE_TITLE} if rule else None

    def scanned(self, number: int, window_id: str) -> bool:
        scanned = self._rules.get(number)
        return scanned is not None and scanned[0] == window_id

    def decorate_snapshot(self, snapshot: Dict[str, object]) -> Dict[str, object]:
        for window in snapshot.get("windows") or []:
            number = int(window.get("terminal_number") or 0)
            window_id = str(window.get("id") or "")
            live = bool(window.get("online")) and number > 0
            window["ai_agent"] = self.detection(number, window_id, str(window.get("title") or "")) if live else None
            window["agent_scanned"] = live and self.scanned(number, window_id)
        return snapshot


terminal_agent_detector = TerminalAgentDetector()
