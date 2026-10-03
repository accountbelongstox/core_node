# -*- coding: utf-8 -*-
"""Reads the permission mode an AI agent shows at the bottom of exported terminal text, and remembers per window whether its shift+tab cycle offers auto mode."""

from __future__ import annotations

import difflib
import re
import threading
from typing import Dict, List, Optional, Sequence, Tuple

from pycore.pyctl.terminal.terminal_agent_detector import agent_tail

MODE_MANUAL = "manual"
MODE_AUTO = "auto"
MODE_ACCEPT_EDITS = "accept_edits"
MODE_PLAN = "plan"
MODE_BYPASS = "bypass"
MODE_YOLO = "yolo"
SWITCH_TARGET_MODES = (MODE_MANUAL, MODE_AUTO, MODE_ACCEPT_EDITS, MODE_PLAN)
CYCLE_KEY = "shift_tab"
FOOTER_SCAN_LINES = 4
DIFF_TAIL_LINES = 8
# Claude Code footer: "⏵⏵ auto mode on (shift+tab to cycle)", "⏵⏵ accept edits on",
# "⏸ plan mode on", "⏸ manual mode on · ? for shortcuts", "⏵⏵ bypass permissions on".
CLAUDE_MODE_PATTERN = re.compile(
    r"(?:^|[\s⏵⏸▶►])(?P<label>auto mode|accept edits|plan mode|manual mode|bypass permissions) on\b",
    re.IGNORECASE,
)
CLAUDE_MODE_LABELS = {
    "auto mode": MODE_AUTO,
    "accept edits": MODE_ACCEPT_EDITS,
    "plan mode": MODE_PLAN,
    "manual mode": MODE_MANUAL,
    "bypass permissions": MODE_BYPASS,
}
# Gemini CLI / Antigravity footer: "? for shortcuts   accept-edits · <model> · <effort>";
# manual mode shows the model alone.
SHORTCUTS_FOOTER_PATTERN = re.compile(r"^\?\s+for shortcuts\b(?P<rest>.*)$", re.IGNORECASE)
GEMINI_MODE_PATTERN = re.compile(r"(?:^|\s)(?P<label>accept-edits|auto-edit|plan|yolo)\s+·\s", re.IGNORECASE)
GEMINI_MODE_LABELS = {
    "accept-edits": MODE_ACCEPT_EDITS,
    "auto-edit": MODE_ACCEPT_EDITS,
    "plan": MODE_PLAN,
    "yolo": MODE_YOLO,
}
# A confirmation option that offers auto mode proves the agent supports it.
AUTO_OFFER_PATTERN = re.compile(r"\bswitch to auto mode\b", re.IGNORECASE)


def permission_mode(text: Optional[str]) -> Optional[str]:
    """Mode shown in the footer of the text tail, else None (no agent footer)."""
    for line in reversed(agent_tail(text or "", FOOTER_SCAN_LINES)):
        stripped = line.strip()
        claude = CLAUDE_MODE_PATTERN.search(stripped)
        if claude:
            return CLAUDE_MODE_LABELS[claude.group("label").lower()]
        footer = SHORTCUTS_FOOTER_PATTERN.match(stripped)
        if footer:
            gemini = GEMINI_MODE_PATTERN.search(footer.group("rest"))
            return GEMINI_MODE_LABELS[gemini.group("label").lower()] if gemini else MODE_MANUAL
    return None


def offers_auto_mode(text: Optional[str]) -> bool:
    return permission_mode(text) == MODE_AUTO or any(AUTO_OFFER_PATTERN.search(line) for line in agent_tail(text or ""))


def tail_diff(before: str, after: str) -> List[str]:
    """Changed tail lines between two exports ("- old" / "+ new")."""
    return [
        line
        for line in difflib.ndiff(agent_tail(before, DIFF_TAIL_LINES), agent_tail(after, DIFF_TAIL_LINES))
        if line.startswith(("- ", "+ "))
    ]


class TerminalPermissionModes:
    """Per window: the last mode read from a scan and the modes seen while cycling (a closed cycle without auto = unsupported)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._modes: Dict[str, Optional[str]] = {}
        self._auto_seen: Dict[str, bool] = {}
        self._cycles: Dict[str, Tuple[str, ...]] = {}

    def observe(self, window_id: str, text: Optional[str]) -> Optional[str]:
        mode = permission_mode(text)
        with self._lock:
            self._modes[window_id] = mode
            if offers_auto_mode(text):
                self._auto_seen[window_id] = True
        return mode

    def record_cycle(self, window_id: str, modes: Sequence[str]) -> None:
        with self._lock:
            if MODE_AUTO in modes:
                self._auto_seen[window_id] = True
            if len(modes) > 1 and modes[0] == modes[-1]:
                self._cycles[window_id] = tuple(modes[:-1])

    def auto_supported(self, window_id: str) -> Optional[bool]:
        """True once auto mode was seen, False after a full cycle without it, else unknown."""
        with self._lock:
            if self._auto_seen.get(window_id):
                return True
            return False if window_id in self._cycles else None

    def describe(self, window_id: str) -> Optional[Dict[str, object]]:
        with self._lock:
            mode = self._modes.get(window_id)
            cycle = self._cycles.get(window_id)
        if mode is None:
            return None
        return {"mode": mode, "auto_supported": self.auto_supported(window_id), "cycle": list(cycle) if cycle else None}

    def decorate_snapshot(self, snapshot: Dict[str, object]) -> Dict[str, object]:
        for window in snapshot.get("windows") or []:
            window["permission_mode"] = self.describe(str(window.get("id") or "")) if window.get("online") else None
        return snapshot

    def prune(self, live_window_ids: Sequence[str]) -> None:
        live = set(live_window_ids)
        with self._lock:
            for store in (self._modes, self._auto_seen, self._cycles):
                for window_id in [key for key in store if key not in live]:
                    store.pop(window_id, None)


terminal_permission_modes = TerminalPermissionModes()
