# -*- coding: utf-8 -*-
"""Latest exported scrollback text per terminal, served to viewers as full text first and line deltas after."""

from __future__ import annotations

import hashlib
import threading
import time
import unicodedata
from collections import Counter, deque
from typing import Any, Deque, Dict, List, Optional, Tuple

from pycore.pyctl.terminal.terminal_backup_store import TEXT_ENCODING, TEXT_ERRORS, terminal_backup_store
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_TEXT_REVISIONS_KEPT = relay_contract.limit("terminal_text_revisions_kept")
TERMINAL_TEXT_REFRESH_SECONDS = relay_contract.duration("terminal_text_refresh_seconds")
TERMINAL_TEXT_SCREEN_SLACK_MS = relay_contract.duration("terminal_text_screen_slack_seconds") * 1000
MODE_FULL = "full"
MODE_DELTA = "delta"
MODE_SAME = "same"
SOURCE_EXPORT = "export"
SOURCE_BACKUP = "backup"
ERROR_TEXT_UNAVAILABLE = "terminal_text_unavailable"
MIN_COLUMNS = 20
MAX_COLUMNS = 400
DEFAULT_COLUMNS = 80
WIDE_WIDTHS = frozenset(("W", "F"))


def display_width(line: str) -> int:
    """Terminal cells of one line: wide CJK characters take two, combining marks none."""
    return sum(
        0 if unicodedata.combining(character) else 2 if unicodedata.east_asian_width(character) in WIDE_WIDTHS else 1
        for character in line
    )


def estimate_columns(lines: List[str]) -> int:
    """Terminal width: the widest line width seen at least twice (full rows, borders), else the widest line."""
    widths = Counter(width for width in map(display_width, lines) if MIN_COLUMNS <= width <= MAX_COLUMNS)
    repeated = [width for width, count in widths.items() if count >= 2]
    if repeated:
        return max(repeated)
    return max(widths, default=DEFAULT_COLUMNS)


def normalize_lines(text: str) -> List[str]:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return lines


class TerminalTextBuffer:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: Dict[int, Dict[str, Any]] = {}
        self._history: Dict[int, Deque[Tuple[int, List[str]]]] = {}
        self._seeded: set = set()
        self._refresh_claims: Dict[int, float] = {}

    def offer(self, terminal_number: int, window_id: str, text: str, source: str = SOURCE_EXPORT, exported_at_ms: Optional[int] = None) -> None:
        """Record one export; identical text only renews its export time (the screen is still that text)."""
        lines = normalize_lines(text)
        digest = hashlib.sha256("\n".join(lines).encode(TEXT_ENCODING, TEXT_ERRORS)).hexdigest()
        exported_at = int(exported_at_ms if exported_at_ms is not None else time.time() * 1000)
        with self._lock:
            current = self._entries.get(terminal_number)
            if current is not None and current["digest"] == digest:
                current["exported_at"] = max(int(current["exported_at"]), exported_at)
                current["window_id"] = window_id or current["window_id"]
                return
            revision = int(current["revision"]) + 1 if current is not None else 1
            self._entries[terminal_number] = {
                "terminal_number": terminal_number,
                "window_id": window_id,
                "revision": revision,
                "digest": digest,
                "columns": estimate_columns(lines),
                "exported_at": exported_at,
                "source": source,
                "lines": lines,
            }
            history = self._history.setdefault(terminal_number, deque(maxlen=TERMINAL_TEXT_REVISIONS_KEPT))
            history.append((revision, lines))

    def claim_refresh(self, terminal_number: int) -> bool:
        """At most one on-demand export per terminal per refresh interval."""
        now = time.monotonic()
        with self._lock:
            if now - self._refresh_claims.get(terminal_number, -TERMINAL_TEXT_REFRESH_SECONDS) < TERMINAL_TEXT_REFRESH_SECONDS:
                return False
            self._refresh_claims[terminal_number] = now
            return True

    def read(self, terminal_number: int, since_revision: int = 0, screen_captured_at_ms: int = 0) -> Dict[str, Any]:
        """Full text for a new viewer, the changed tail for one that holds a kept revision, nothing when unchanged."""
        self._seed(terminal_number)
        with self._lock:
            entry = self._entries.get(terminal_number)
            if entry is None:
                return {"success": False, "error_code": ERROR_TEXT_UNAVAILABLE, "terminal_number": terminal_number}
            lines: List[str] = entry["lines"]
            result: Dict[str, Any] = {
                "success": True,
                "terminal_number": terminal_number,
                "window_id": entry["window_id"],
                "revision": entry["revision"],
                "digest": entry["digest"],
                "columns": entry["columns"],
                "exported_at": entry["exported_at"],
                "source": entry["source"],
                "line_count": len(lines),
                "stale": screen_captured_at_ms > int(entry["exported_at"]) + TERMINAL_TEXT_SCREEN_SLACK_MS,
            }
            if since_revision == entry["revision"]:
                return {**result, "mode": MODE_SAME}
            previous = next((kept for revision, kept in self._history.get(terminal_number, ()) if revision == since_revision), None)
            if previous is None:
                return {**result, "mode": MODE_FULL, "lines": list(lines)}
            keep = 0
            for old, new in zip(previous, lines):
                if old != new:
                    break
                keep += 1
            return {**result, "mode": MODE_DELTA, "base_revision": since_revision, "keep": keep, "lines": lines[keep:]}

    def _seed(self, terminal_number: int) -> None:
        """A terminal not exported since this process started begins with its newest stored backup."""
        with self._lock:
            if terminal_number in self._entries or terminal_number in self._seeded:
                return
            self._seeded.add(terminal_number)
        latest = terminal_backup_store.latest()
        if latest is None:
            return
        read = terminal_backup_store.read_terminal(latest["id"], terminal_number)
        if not read.get("success"):
            return
        self.offer(
            terminal_number,
            "",
            read["data"].decode(TEXT_ENCODING, TEXT_ERRORS),
            SOURCE_BACKUP,
            terminal_backup_store.created_at_ms(latest["id"], latest["manifest"]),
        )


terminal_text_buffer = TerminalTextBuffer()

__all__ = ["TerminalTextBuffer", "display_width", "estimate_columns", "terminal_text_buffer"]
