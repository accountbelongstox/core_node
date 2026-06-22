#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer (Approach 6): multi-level indent and history-specific parsing.

Approach 6 from docs/test_docdir_2/HistoryReader.md: extend indent_key_to_level to multi-level
for history.txt (level = n_tabs, 4+ treated as repeat/same as 3). Enhanced with ideas from
other approaches:
- Approach 1: Tail chunk reading, time window filtering (min_entry_ts)
- Approach 2: Multi-level stack for Earned attribution
- Approach 4: Better line classification
- Approach 5: Regex-based line type detection

This module provides an organizer that:
- Uses indent_key_to_level_history when building block structure (via analyze_history_blocks).
- Preserves leading TAB when reading lines so level can be computed.
- For get_latest_stats_as_lines(), parses Earned lines from the last block (or time window)
  and returns "Label: value" lines (e.g. "Gold Earned: 123") for comparison or display.

All code and docstrings in English.
"""
from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from d3utils.history_indent_spec import (
    analyze_history_blocks,
    get_line_indent_state,
    indent_key_to_level_history,
    parse_line_timestamp,
)
from d3utils.history_stats_formatter import format_stats_lines_from_earned


# Match "X Earned: N" with optional leading tabs. Captures key (before " Earned:") and value.
_EARNED_RE = re.compile(r"^[\t]*(.+?)\s+Earned:\s*(-?\d+)\s*$")

# Entry head regex: timestamp + INFO - Session/Rift
_ENTRY_HEAD_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d{3})?\s+INFO\s+-\s+(?:\t)?(Session|Rift)$"
)

# Tail chunk size for efficient last-block reading (from Approach 1)
_TAIL_CHUNK_BYTES = 2 * 1024 * 1024  # 2 MB


def _parse_earned_line(line: str) -> Optional[Tuple[str, str]]:
    """
    Parse a line like '\\tGold Earned: 451949253'. Returns ('Gold Earned', '451949253') or None.
    Key includes " Earned" suffix to match other approaches (approach2, approach5 use "Gold Earned" as key).
    """
    m = _EARNED_RE.match(line)
    if not m:
        return None
    key_part = m.group(1).strip()
    val = m.group(2).strip()
    if not key_part:
        return None
    # Ensure key includes " Earned" suffix for consistency with other approaches
    full_key = f"{key_part} Earned"
    return (full_key, val)


def _read_tail_lines_with_indent(file_path: str, max_bytes: int = _TAIL_CHUNK_BYTES) -> List[str]:
    """
    Read last max_bytes from file (tail chunk, from Approach 1). Lines are rstrip only
    (leading TAB preserved). First line may be partial and is dropped.
    """
    if not os.path.isfile(file_path):
        return []
    try:
        size = os.path.getsize(file_path)
        chunk = min(size, max_bytes)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            if size <= chunk:
                raw = f.read()
            else:
                f.seek(size - chunk)
                f.readline()  # drop partial line
                raw = f.read()
    except Exception:
        return []
    return [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.rstrip("\n\r").strip()]


def _last_block_earned_lines(lines: List[str], min_entry_ts: Optional[float] = None) -> List[Tuple[str, str]]:
    """
    From a list of lines (with leading TAB preserved), find the last block (from last
    timestamp line to end) and collect all Earned lines as (key, value) pairs.
    If min_entry_ts is set, only consider blocks with timestamp >= min_entry_ts.
    Enhanced: uses multi-level structure to better attribute Earned to correct level.
    """
    earned: List[Tuple[str, str]] = []
    last_block_start_idx: Optional[int] = None
    last_block_ts: Optional[float] = None
    
    # Find last block start (backward search)
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        ts = parse_line_timestamp(line.strip())
        if ts is not None:
            if min_entry_ts is None or ts >= min_entry_ts:
                last_block_start_idx = i
                last_block_ts = ts
                break
    
    if last_block_start_idx is None:
        return earned
    
    # Collect Earned from this block onward
    for j in range(last_block_start_idx, len(lines)):
        kv = _parse_earned_line(lines[j])
        if kv:
            earned.append(kv)
    
    return earned


def get_last_block_earned_as_label_values(
    history_path: str, min_entry_ts: Optional[float] = None
) -> List[str]:
    """
    Read history file tail, find the last block (last timestamp line to end), collect all
    "X Earned: N" lines and return as ["X Earned: N", ...] for display or comparison.
    If min_entry_ts is set, only consider blocks with timestamp >= min_entry_ts (time window).
    """
    lines = _read_tail_lines_with_indent(history_path)
    earned = _last_block_earned_lines(lines, min_entry_ts=min_entry_ts)
    return [f"{k}: {v}" for k, v in earned]


class HistoryInfoOrganizer6:
    """
    Organizer for history.txt using multi-level indent (approach 6). Preserves leading
    TAB when reading; uses indent_key_to_level_history for level; can return Earned
    lines from the last block as stats-like "Label: value" list.
    """

    def __init__(self, history_path: str) -> None:
        self._path = history_path
        self._last_position: int = 0

    def get_log_path(self) -> str:
        return self._path

    def read_new_lines(self) -> Tuple[int, List[str]]:
        """
        Read new non-empty lines from last position. Lines are rstrip('\\n\\r') only so
        leading TAB is preserved for indent_key_to_level_history.
        """
        if not os.path.isfile(self._path):
            return self._last_position, []
        try:
            with open(self._path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._last_position)
                raw = f.read()
                self._last_position = f.tell()
        except Exception:
            return self._last_position, []
        lines = [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.rstrip("\n\r").strip()]
        return self._last_position, lines

    def seek_to_end(self) -> int:
        """Seek to end of file and return current file size."""
        if not os.path.isfile(self._path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._path)
        except Exception:
            pass
        return self._last_position

    def get_latest_stats_as_lines(self, min_entry_ts: Optional[float] = None) -> List[str]:
        """
        For history.txt, return Earned lines from the last block as "Label: value" list.
        Uses preserved-TAB read and last-block detection. If min_entry_ts is set, only
        considers blocks with timestamp >= min_entry_ts (for time window comparison).
        """
        return get_last_block_earned_as_label_values(self._path, min_entry_ts=min_entry_ts)

    def poll_once_and_get_stats_lines(self) -> List[str]:
        """Poll once: same as get_latest_stats_as_lines (last block Earned, no time window)."""
        return self.get_latest_stats_as_lines()

    def get_line_level(self, line: str) -> int:
        """Return history-mode level (0..3) for one line. Uses leading TAB count."""
        n_tabs, _, _ = get_line_indent_state(line)
        return indent_key_to_level_history(f"tabs={n_tabs}, U+0020=0")


_organizer6_cache: dict = {}


def get_history_info_organizer_6(history_path: str) -> HistoryInfoOrganizer6:
    """Return cached HistoryInfoOrganizer6 for history_path (singleton per path)."""
    if history_path not in _organizer6_cache:
        _organizer6_cache[history_path] = HistoryInfoOrganizer6(history_path)
    return _organizer6_cache[history_path]


def get_history_blocks_result(history_path: str, max_lines: int = 0) -> dict:
    """
    Run analyze_history_blocks on the given path. Returns the result dict (state_level,
    state_child_keys, etc.) for inspection or comparison. Useful for testing multi-level
    structure.
    """
    return analyze_history_blocks(history_path, max_lines=max_lines)


def _count_leading_tabs(line: str) -> int:
    """Return number of leading TAB characters."""
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _is_entry_start(line: str) -> bool:
    """True if line has 0 leading tabs and starts with a log timestamp + INFO - Session/Rift."""
    if _count_leading_tabs(line) != 0:
        return False
    return _ENTRY_HEAD_RE.match(line.strip()) is not None


def _get_block_kind_from_entry(line: str) -> Optional[str]:
    """Extract block kind (Session or Rift) from entry start line."""
    stripped = line.strip()
    m = _ENTRY_HEAD_RE.match(stripped)
    if not m:
        return None
    return m.group(1)  # "Session" or "Rift"


def _build_blocks_approach6(
    lines: List[str],
    max_lines: int = 0,
) -> List[Dict[str, Any]]:
    """
    Parse lines with multi-level indent (Approach 6). Uses indent_key_to_level_history
    for level calculation (0/1/2/3, 4+ treated as 3). Builds blocks with head_time,
    head_kind (Session/Rift), and earned dict.
    """
    blocks: List[Dict[str, Any]] = []
    current_head_time: Optional[float] = None
    current_head_sample: str = ""
    current_head_kind: Optional[str] = None  # "Session" or "Rift"
    current_earned: Dict[str, int] = {}
    # Stack of (level, earned_dict) for nested content
    stack: List[Tuple[int, Dict[str, int]]] = []
    n_read = 0

    for line in lines:
        if max_lines and n_read >= max_lines:
            break
        s = line.rstrip("\n\r")
        if not s.strip():
            continue
        n_read += 1

        n_tabs = _count_leading_tabs(line)
        level = indent_key_to_level_history(f"tabs={n_tabs}, U+0020=0")
        stripped = s.strip()

        if _is_entry_start(line):
            # Save previous block
            if current_head_time is not None or current_earned:
                blocks.append({
                    "head_time": current_head_time,
                    "head_sample": current_head_sample,
                    "head_kind": current_head_kind,
                    "earned": dict(current_earned),
                })
            # New block
            current_head_time = parse_line_timestamp(stripped)
            current_head_sample = stripped[:100] + ("..." if len(stripped) > 100 else "")
            current_head_kind = _get_block_kind_from_entry(line)
            current_earned = {}
            stack = [(0, current_earned)]
            continue

        # Continuation line
        if not stack:
            continue

        # 4-tab lines: treat as repeat (same as level 3), don't push new level
        if n_tabs >= 4:
            level = 3

        # Pop until top level < current level
        while len(stack) > 1 and stack[-1][0] >= level:
            stack.pop()
        if stack and stack[-1][0] > level:
            continue

        top_level, top_earned = stack[-1]

        # Parse Earned lines
        kv = _parse_earned_line(line)
        if kv:
            key, val_str = kv
            try:
                val = int(val_str)
                # Earned belongs to top of stack (current block level)
                top_earned[key] = top_earned.get(key, 0) + val
            except ValueError:
                pass
            continue

        # If we go deeper (level > top_level), push new level
        if level > top_level:
            stack.append((level, top_earned))

    # Save last block
    if current_head_time is not None or current_earned:
        blocks.append({
            "head_time": current_head_time,
            "head_sample": current_head_sample,
            "head_kind": current_head_kind,
            "earned": dict(current_earned),
        })

    return blocks


def _aggregate_blocks_in_time_window_approach6(
    blocks: List[Dict[str, Any]], start_epoch: float
) -> Tuple[Dict[str, int], int, int]:
    """
    Aggregate Session + Rift blocks in time window. Returns (earned, game_count, baseline_keys).
    Similar to approach2 but uses approach6 block structure.
    """
    earned: Dict[str, int] = {}
    game_count = 0
    baseline_keys = 0
    last_session_idx = -1
    
    # Find last Session
    for i, b in enumerate(blocks):
        if b.get("head_kind") == "Session":
            last_session_idx = i
    
    if last_session_idx >= 0:
        # Aggregate baseline keys from Sessions before last Session
        for i in range(last_session_idx):
            if blocks[i].get("head_kind") == "Session":
                e = blocks[i].get("earned", {})
                baseline_keys += e.get("Rift keys Earned", e.get("Rift keys", 0))
        # Aggregate last Session's earned
        for k, v in blocks[last_session_idx].get("earned", {}).items():
            earned[k] = earned.get(k, 0) + v
    
    # Aggregate Rifts after last Session that are in time window
    for i in range(last_session_idx + 1, len(blocks)):
        b = blocks[i]
        if b.get("head_kind") != "Rift":
            continue
        t = b.get("head_time")
        if t is None or t < start_epoch:
            continue
        game_count += 1
        for k, v in b.get("earned", {}).items():
            earned[k] = earned.get(k, 0) + v
    
    return earned, game_count, baseline_keys


def get_stats_lines_in_time_window_approach6(
    log_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """
    Read full file, parse with approach6, aggregate all Rifts in time window [start_epoch, ...],
    format as the same 14 "Label: value" lines as approximate. For compare mode.
    """
    if not os.path.isfile(log_path):
        return []
    lines: List[str] = []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except Exception:
        return []
    blocks = _build_blocks_approach6(lines)
    earned, game_count, baseline_keys = _aggregate_blocks_in_time_window_approach6(blocks, start_epoch)
    if not earned and game_count == 0:
        return []
    if boting_seconds <= 0:
        boting_seconds = max(1, int(time.time() - start_epoch))
    return format_stats_lines_from_earned(
        earned, game_count, 0, boting_seconds, baseline_keys
    )
