# -*- coding: utf-8 -*-
"""Classifies exported terminal text as an idle shell prompt, a busy screen or unknown, from the ordered
rules of config/terminal_shell_state.json plus the AI-agent detector. An idle prompt may carry typed but
unsubmitted input; one Ctrl+C clears it. register_busy()/register_idle() extend the library at runtime."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyctl.terminal.terminal_agent_detector import agent_tail, terminal_agent_detector
from pycore.pyfoundations.system_paths import get_core_node_root

SHELL_STATE_CONFIG_PATH = (get_core_node_root() / "config" / "terminal_shell_state.json").resolve()
STATE_IDLE = "idle"
STATE_BUSY = "busy"
STATE_UNKNOWN = "unknown"
OS_ANY = "any"
RULE_AGENT_PREFIX = "agent:"
RULE_EMPTY = "empty"
INPUT_GROUP = "input"


@dataclass(frozen=True)
class ShellStateRule:
    name: str
    pattern: "re.Pattern[str]"
    os: str = OS_ANY

    def applies_to(self, shell_os: str) -> bool:
        return not shell_os or self.os in (OS_ANY, shell_os)


@dataclass(frozen=True)
class ShellState:
    state: str
    rule: str
    line: str = ""
    tail: Tuple[str, ...] = ()
    input: str = ""

    @property
    def idle(self) -> bool:
        return self.state == STATE_IDLE

    def as_dict(self) -> Dict[str, Any]:
        return {"state": self.state, "rule": self.rule, "line": self.line, "input": self.input}


def _rules(entries: List[Dict[str, Any]]) -> List[ShellStateRule]:
    return [
        ShellStateRule(str(entry["name"]), re.compile(str(entry["pattern"])), str(entry.get("os") or OS_ANY))
        for entry in entries
    ]


class TerminalShellStateDetector:
    def __init__(self, config: Dict[str, Any]) -> None:
        self._tail_lines = int(config["tail_lines"])
        self._busy = _rules(config["busy"])
        self._idle = _rules(config["idle"])

    def register_busy(self, name: str, pattern: str, os: str = OS_ANY) -> None:
        self._busy.append(ShellStateRule(name, re.compile(pattern), os))

    def register_idle(self, name: str, pattern: str, os: str = OS_ANY) -> None:
        self._idle.append(ShellStateRule(name, re.compile(pattern), os))

    def classify(self, text: Optional[str], shell_os: str = "") -> ShellState:
        """Agent screens and busy rules win; the last line is idle only when a prompt rule of the shell OS matches it."""
        lines = [line.strip() for line in agent_tail(text or "") if line.strip()]
        if not lines:
            return ShellState(STATE_UNKNOWN, RULE_EMPTY)
        tail = tuple(lines[-self._tail_lines:])
        last = tail[-1]
        agent_rule = terminal_agent_detector.text_rule(text)
        if agent_rule:
            return ShellState(STATE_BUSY, f"{RULE_AGENT_PREFIX}{agent_rule}", last, tail)
        for rule in self._busy:
            if rule.applies_to(shell_os) and rule.pattern.search(last):
                return ShellState(STATE_BUSY, rule.name, last, tail)
        for rule in self._idle:
            matched = rule.pattern.match(last) if rule.applies_to(shell_os) else None
            if matched:
                typed = matched.groupdict().get(INPUT_GROUP) or ""
                return ShellState(STATE_IDLE, rule.name, last, tail, typed.strip())
        return ShellState(STATE_UNKNOWN, "", last, tail)


terminal_shell_state = TerminalShellStateDetector(json.loads(SHELL_STATE_CONFIG_PATH.read_text(encoding="utf-8")))

__all__ = [
    "STATE_BUSY",
    "STATE_IDLE",
    "STATE_UNKNOWN",
    "ShellState",
    "ShellStateRule",
    "TerminalShellStateDetector",
    "terminal_shell_state",
]
