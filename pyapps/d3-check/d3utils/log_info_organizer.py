#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Info Organizer library.

Uses LogStateReader / log_indent_spec: read log by position or time, detect and parse
stats lines (Botting duration, Game #, Run, Failed runs, Deaths, Keys, Shards, Xp, Legendaries,
Distance, Performance, etc.), output one entry per line for caller to print.
"""
from __future__ import annotations

import os
import re
import time
from typing import List, Optional, Tuple

from d3utils.log_state_reader import LogStateReader


# Stats line detection: line with both duration and Performance is a full stats line (accept Boting/Botting, earned/eared)
_STATS_LINE_MARKERS = ("Botting duration", "Boting duration", "Performance:")
_STATS_LINE_MIN_LEN = 50


def _is_stats_line(line: str) -> bool:
    if not line or len(line.strip()) < _STATS_LINE_MIN_LEN:
        return False
    s = line.strip()
    if "Performance:" not in s and "Performance " not in s:
        return False
    if "Botting duration" not in s and "Boting duration" not in s:
        return False
    return True


# Match fields in order, output "Label: value"; value runs to next label or EOL
_STATS_PATTERNS = [
    (r"(?:Boting|Botting)\s+duration\s*:\s*([^G]+?)(?=Game\s*#|$)", "Botting duration"),
    (r"Game\s*#\s*(\d+)", "Game #"),
    (r"(\d{2}:\d{2}:\d{2})\s*\(\s*([\d.]+)/h\)", "Run time (per h)"),
    (r"Run:\s*([\d:]+)\s*-\s*Step:\s*([\d:]+)", "Run - Step"),
    (r"Failed\s+runs:\s*(\d+)\s*-\s*Deaths:\s*(\d+)", "Failed runs - Deaths"),
    (r"Keys\s+Total/Looted:\s*([^\s\-]+)", "Keys Total/Looted"),
    (r"Avg\.Keys/Rift:\s*([^\s]+(?:\s+\d+r\s*\d+gr)?)", "Avg.Keys/Rift"),
    (r"Shards\s+ear(?:ned|ed):\s*(\d+)", "Shards earned"),
    (r"Earned\s+Xp:\s*([\d.]+\s*[TBMK]?(?:\s*\([^)]+\))?)", "Earned Xp"),
    (r"Run\s+Xp:\s*([\d.]+\s*[TBMK]?(?:\s*\([^)]+\))?)", "Run Xp"),
    (r"Xp\s+Pools:\s*([\d.]+(?:\s*\([^)]+\))?)", "Xp Pools"),
    (r"Legendaries\s+Kept/Looted:\s*([^\s]+)", "Legendaries Kept/Looted"),
    (r"Distance:\s*([^\s]+(?:\s*\([^)]+\))?)", "Distance"),
    (r"Performance:\s*([^\s]+)", "Performance"),
]


def parse_stats_line(line: str) -> List[str]:
    """
    Parse one stats line, return a list of "Label: value" entries (one per line).

    Returns empty list if not a stats line.
    """
    if not _is_stats_line(line):
        return []
    s = line.strip()
    out: List[str] = []
    for pattern, label in _STATS_PATTERNS:
        m = re.search(pattern, s, re.IGNORECASE)
        if m:
            val = " ".join(m.groups()).strip()
            out.append(f"{label}: {val}")
    return out


class LogInfoOrganizer:
    """
    Uses log reader; tail-reads log by position and organizes run stats, one entry per line.
    """

    def __init__(self, log_path: str) -> None:
        self._log_path = log_path
        self._reader = LogStateReader(log_path)
        self._last_position: int = 0

    def get_log_path(self) -> str:
        return self._log_path

    def get_reader(self) -> LogStateReader:
        """The LogStateReader instance used by this organizer."""
        return self._reader

    def read_new_lines(self) -> Tuple[int, List[str]]:
        """
        Read new non-empty lines from last position and update last_position.

        :return: (new_last_position, list of stripped lines)
        """
        if not os.path.isfile(self._log_path):
            return self._last_position, []
        try:
            with open(self._log_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._last_position)
                raw = f.read()
                self._last_position = f.tell()
        except Exception:
            return self._last_position, []
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        return self._last_position, lines

    def seek_to_end(self) -> int:
        """Seek to end of file and return current file size."""
        if not os.path.isfile(self._log_path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._log_path)
        except Exception:
            pass
        return self._last_position

    def get_latest_stats_as_lines(self) -> List[str]:
        """
        Read new lines from last_position, find all stats lines, parse to one-per-line and merge.

        Does not update last_position (only newly read content is parsed).
        """
        _, lines = self.read_new_lines()
        result: List[str] = []
        for line in lines:
            items = parse_stats_line(line)
            result.extend(items)
        return result

    def poll_once_and_get_stats_lines(self) -> List[str]:
        """
        Poll once: read new lines since last position, parse stats lines, return one-per-line list.
        """
        return self.get_latest_stats_as_lines()


def get_default_log_path() -> str:
    """Default log path (same as providor LOGS_FILE_PATH)."""
    return os.path.join(
        os.path.expanduser("~/Documents"),
        "RoS-BoT/Logs/logs.txt",
    )
