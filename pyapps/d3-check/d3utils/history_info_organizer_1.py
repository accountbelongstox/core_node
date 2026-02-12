# -*- coding: utf-8 -*-
"""
History Info Organizer – Approach 1 (TAB + content_indent stack).

Uses d3utils.rosbot_history_parser to parse history.txt with leading TAB preserved.
Returns last Rift/Step block earned as "Label: value" lines for get_latest_stats_as_lines.
Time-window aggregation can output the same 14 "Label: value" lines as approximate (compare mode).
All code and comments in English.
"""
from __future__ import annotations

import os
import time
from typing import Dict, List, Optional, Tuple

from d3utils.history_stats_formatter import (
    _parse_duration_to_seconds as duration_str_to_seconds,
    format_stats_lines_from_earned as earned_to_approximate_stats_lines,
)
from d3utils.log_info_organizer import get_default_history_path as _get_default_history_path
from d3utils.rosbot_history_parser import (
    Block,
    last_rift_block_with_earned,
    parse_history_lines,
)


def _is_history_path(path: str) -> bool:
    """True if path is the default history file or path ends with history.txt."""
    if not path:
        return False
    norm = os.path.normpath(path).replace("\\", "/")
    return norm.endswith("history.txt") or os.path.normpath(path) == os.path.normpath(_get_default_history_path())


def _earned_to_label_value_lines(earned: dict) -> List[str]:
    """Convert earned dict (key -> int) to 'Label: value' lines. Key is used as label (e.g. 'Gold Earned')."""
    return [f"{k}: {v}" for k, v in sorted(earned.items())]


# Tail chunk for "last block" parse: avoid loading full file when only last Rift is needed.
_TAIL_CHUNK_BYTES = 2 * 1024 * 1024  # 2 MB
# Full-file read cap for time-window aggregation (need all Sessions + Rifts in order).
_FULL_READ_MAX_BYTES = 15 * 1024 * 1024  # 15 MB


def _read_lines_preserve_tab(path: str, from_position: int = 0, max_bytes: int = 0) -> Tuple[int, List[str]]:
    """
    Read from path starting at from_position. Lines are rstrip only (leading TAB preserved).
    If max_bytes > 0, read at most that many bytes from from_position.
    Returns (position_after_read, list of lines with newline stripped).
    """
    if not os.path.isfile(path):
        return from_position, []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(from_position)
            raw = f.read() if max_bytes <= 0 else f.read(max_bytes)
            new_pos = f.tell()
    except OSError:
        return from_position, []
    lines = [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.strip()]
    return new_pos, lines


def _read_tail_preserve_tab(path: str, max_bytes: int = _TAIL_CHUNK_BYTES) -> List[str]:
    """Read last max_bytes from file; first line may be partial. Lines rstrip only (TAB preserved)."""
    if not os.path.isfile(path):
        return []
    try:
        size = os.path.getsize(path)
        chunk = min(size, max_bytes)
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            if size <= chunk:
                raw = f.read()
            else:
                f.seek(size - chunk)
                f.readline()  # drop partial line
                raw = f.read()
    except OSError:
        return []
    return [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.strip()]


def _read_full_or_tail_preserve_tab(path: str, max_bytes: int = _FULL_READ_MAX_BYTES) -> List[str]:
    """Read full file or last max_bytes; lines rstrip only (TAB preserved). For time-window aggregation."""
    if not os.path.isfile(path):
        return []
    try:
        size = os.path.getsize(path)
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            if max_bytes <= 0 or size <= max_bytes:
                raw = f.read()
            else:
                f.seek(size - max_bytes)
                f.readline()
                raw = f.read()
    except OSError:
        return []
    return [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.strip()]


def _collect_block_earned_recursive(block: Block, earned: Dict[str, int]) -> None:
    """Recursively collect earned from block and all its children."""
    for k, v in block.earned.items():
        earned[k] = earned.get(k, 0) + v
    for child in block.children:
        _collect_block_earned_recursive(child, earned)


def _aggregate_roots_in_time_window(
    roots: List[Block], start_epoch: float
) -> Tuple[Dict[str, int], int, int, int, int]:
    """
    Aggregate Session + Rifts in roots for time window [start_epoch, ...].
    Returns (earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys).
    Enhanced: recursively collect earned from children, handle Session Rift keys correctly.
    """
    earned: Dict[str, int] = {}
    game_count = 0
    total_duration_seconds = 0
    last_run_duration_seconds = 0
    baseline_keys = 0
    last_session_idx = -1
    last_session: Optional[Block] = None
    
    # Find last Session
    for i, b in enumerate(roots):
        if b.kind == "Session":
            last_session_idx = i
            last_session = b
    
    # Calculate baseline: sum Rift keys from Sessions before last_session
    if last_session_idx >= 0:
        for i in range(last_session_idx):
            if roots[i].kind == "Session":
                # Session Rift keys: only from indent=0 earned (per HistoryReader.md §2.6)
                session_rifkeys = roots[i].get("Rift keys", 0)
                baseline_keys += session_rifkeys
    
    # Collect current Session earned (if exists)
    if last_session is not None:
        session_earned: Dict[str, int] = {}
        # Collect all earned from Session (including children)
        _collect_block_earned_recursive(last_session, session_earned)
        # For Rift keys: prefer "Rift keys" key, normalize from "Rift keys Earned" if needed
        for k, v in session_earned.items():
            k_flat = k.replace(" ", "")
            if k_flat == "Riftkeys" or k_flat == "RiftkeysEarned":
                # Session Rift keys should only come from indent=0, but parser may have put it in block.earned
                # Accept it here since parser already filtered by indent
                earned["Rift keys"] = earned.get("Rift keys", 0) + v
            else:
                earned[k] = earned.get(k, 0) + v
    
    # Aggregate Rifts after last Session (or all Rifts if no Session) that are in time window
    start_idx = last_session_idx + 1 if last_session_idx >= 0 else 0
    for i in range(start_idx, len(roots)):
        b = roots[i]
        if b.kind != "Rift":
            continue
        et = getattr(b, "entry_ts", None)
        if et is None or et < start_epoch:
            continue
        game_count += 1
        # Collect earned from Rift and all its children (nested Rifts, Steps)
        _collect_block_earned_recursive(b, earned)
        dur_sec = duration_str_to_seconds(b.duration or "")
        total_duration_seconds += dur_sec
        last_run_duration_seconds = dur_sec
    
    # If no Session found but we have Rifts, still return aggregated data
    # This handles cases where history.txt starts with Rifts without a Session header
    return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys


class HistoryInfoOrganizer1:
    """
    Organizer for history.txt (Approach 1). Reads with TAB preserved, parses via rosbot_history_parser,
    returns last Rift/Step block earned as stats lines.
    """

    def __init__(self, history_path: str) -> None:
        self._path = history_path
        self._last_position: int = 0

    def get_log_path(self) -> str:
        return self._path

    def read_new_lines(self) -> Tuple[int, List[str]]:
        """Read new lines from _last_position to EOF. Lines keep leading TAB (rstrip only)."""
        pos, lines = _read_lines_preserve_tab(self._path, self._last_position)
        self._last_position = pos
        return self._last_position, lines

    def seek_to_end(self) -> int:
        if not os.path.isfile(self._path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._path)
        except OSError:
            pass
        return self._last_position

    def get_latest_stats_as_lines(self, min_entry_ts: Optional[float] = None) -> List[str]:
        """
        Parse tail of file (TAB preserved), get last Rift/Step block with earned,
        return as 'Label: value' lines. Uses tail chunk so first poll returns data without seeking.
        If min_entry_ts is set (epoch seconds), only blocks with entry_ts >= min_entry_ts are
        considered, aligning with the hardcoded time window used for approximate comparison.
        """
        lines = _read_tail_preserve_tab(self._path)
        if not lines:
            return []
        roots = parse_history_lines(lines)
        block = last_rift_block_with_earned(roots, min_entry_ts=min_entry_ts)
        if block is None or not block.earned:
            return []
        return _earned_to_label_value_lines(block.earned)

    def poll_once_and_get_stats_lines(self) -> List[str]:
        return self.get_latest_stats_as_lines()


_organizer1_cache: dict = {}


def get_history_info_organizer_1(history_path: str) -> HistoryInfoOrganizer1:
    """Return cached HistoryInfoOrganizer1 for history_path (singleton per path)."""
    if history_path not in _organizer1_cache:
        _organizer1_cache[history_path] = HistoryInfoOrganizer1(history_path)
    return _organizer1_cache[history_path]


def get_default_history_path() -> str:
    return _get_default_history_path()


def parse_stats_line(line: str) -> List[str]:
    """
    NOT USED for history.txt. This function is for logs.txt format (single-line stats).
    history.txt uses block-based parsing (Session/Rift blocks with Earned lines).
    Kept for API compatibility only. Returns [] for history lines.
    """
    return []


def get_latest_stats_as_lines_in_time_window(
    history_path: str, start_epoch: float
) -> List[str]:
    """
    Same as organizer.get_latest_stats_as_lines(min_entry_ts=start_epoch).
    Use this when comparing with hardcoded approximate data that assumes a fixed time window
    (e.g. window_start = history file mtime - boting duration).
    """
    org = get_history_info_organizer_1(history_path)
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_organizer1(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """
    Full read + parse (parser Approach 1), aggregate all Rifts in time window [start_epoch, ...],
    then format as the same 14 "Label: value" lines as approximate (Botting duration, Game #, ...).
    Use this for compare mode so actual output has same labels as expected.
    If boting_seconds <= 0, use (now - start_epoch) for per-hour rates.
    Note: Reads full history.txt file (not logs.txt) to ensure all Sessions and Rifts are found.
    """
    # Read full file (not tail) to ensure we get all Sessions and Rifts
    # This matches approach3's behavior
    lines = _read_full_or_tail_preserve_tab(history_path, max_bytes=0)
    if not lines:
        return []
    roots = parse_history_lines(lines)
    earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys = _aggregate_roots_in_time_window(
        roots, start_epoch
    )
    # Allow empty earned if game_count > 0 (Rifts found but no earned data)
    # Only return empty if both earned and game_count are 0
    if not earned and game_count == 0:
        return []
    if boting_seconds <= 0:
        boting_seconds = max(1, int(time.time() - start_epoch))
    return earned_to_approximate_stats_lines(
        earned,
        game_count,
        last_run_duration_seconds,
        boting_seconds,
        baseline_keys,
    )


__all__ = [
    "HistoryInfoOrganizer1",
    "get_history_info_organizer_1",
    "get_default_history_path",
    "get_latest_stats_as_lines_in_time_window",
    "get_stats_lines_in_time_window_organizer1",
    "parse_stats_line",
]
