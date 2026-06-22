#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer - Approach 2 Enhanced (multi-level indent with enhancements from other approaches).

Implements "Approach B" from docs/test_docdir_2/HistoryReader.md section 4.2, enhanced with:
- Approach A: content_indent rules (Session 0-tab content at 0; Rift content at block_indent+1)
- Approach C: Two-pass parsing (first pass: block boundaries; second pass: fields)
- Approach D: State machine with line type classification (entry_start, rift_title, success_duration, step_name, earned_line, repeat_4tab)
- Approach E: Regex-based block head detection (not dependent on exact string matching)

Core features:
- Multi-level tab: level = n_tabs (0,1,2,3); tabs=4 treated as repeat (same as 3 for stack).
- Block stack: pop until top < current indent; 4-tab lines do not push a new block.
- Earned lines attributed to current block using content_indent rules.
- Last block's Earned exported as "Label: value" lines.

Single instance per path via get_history_info_organizer_approach2(history_path).
All code and comments in English.
"""
from __future__ import annotations

import os
import re
import time
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from d3utils.history_indent_spec import get_line_indent_state, parse_line_timestamp
from d3utils.history_stats_formatter import format_stats_lines_from_earned as earned_to_approximate_stats_lines

# Timestamp at start of line (0 tabs) - Approach E: regex-based detection
_TS_ONLY_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d{3})?)")
_ENTRY_HEAD_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d{3})?\s+INFO\s+-\s+(?:\t)?(Session|Rift)$"
)

# Success / Sucess (typo) with Duration - Approach D: line type classification
_SUCCESS_DURATION_RE = re.compile(
    r"^(?:Success|Sucess)\s*:\s*(True|False)\s*\|\s*Duration\s*:\s*([\d:.]+)",
    re.IGNORECASE,
)

# Step names (Approach D: step_name type) - Approach E: regex pattern
_STEP_INVALID_RE = re.compile(
    r"^(Open Rift Invalid|Do Rift Invalid|Kill Boss Invalid|RiftItem Invalid|Urshi Invalid|Talk to Orek Invalid)$"
)

# X Earned: N
_EARNED_RE = re.compile(r"^(.+?)\s+Earned\s*:\s*(-?\d+)\s*$")

# Rift title (just "Rift" at various indents) - Approach D: rift_title type
_RIFT_TITLE_RE = re.compile(r"^Rift$")


class LineType(Enum):
    """Line type classification (Approach D: state machine)."""
    ENTRY_START = "entry_start"
    RIFT_TITLE = "rift_title"
    SESSION_TITLE = "session_title"
    SUCCESS_DURATION = "success_duration"
    STEP_NAME = "step_name"
    EARNED_LINE = "earned_line"
    REPEAT_4TAB = "repeat_4tab"
    OTHER = "other"


def _count_leading_tabs(line: str) -> int:
    """Return number of leading TAB characters. Used for multi-level hierarchy."""
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _effective_level(n_tabs: int) -> int:
    """
    Map tab count to stack level. 4-tab is treated as repeat (same as 3) so we do not push a new block.
    """
    if n_tabs <= 0:
        return 0
    if n_tabs >= 4:
        return 3
    return n_tabs


def _classify_line_type(line: str, n_tabs: int) -> LineType:
    """
    Classify line type (Approach D: state machine line type marking).
    Returns LineType enum value.
    """
    stripped = line.strip()
    if not stripped:
        return LineType.OTHER

    # Entry start: 0 tabs + timestamp + INFO - Session/Rift
    if n_tabs == 0 and _ENTRY_HEAD_RE.match(stripped):
        if "Session" in stripped:
            return LineType.ENTRY_START  # Will be further distinguished as Session
        return LineType.ENTRY_START  # Rift entry

    # Rift title: just "Rift" (at any indent)
    if _RIFT_TITLE_RE.match(stripped):
        return LineType.RIFT_TITLE

    # Session title: just "Session" (usually 0 tabs in continuation)
    if stripped == "Session":
        return LineType.SESSION_TITLE

    # Success/Sucess + Duration
    if _SUCCESS_DURATION_RE.match(stripped):
        return LineType.SUCCESS_DURATION

    # Step name: * Invalid
    if _STEP_INVALID_RE.match(stripped):
        return LineType.STEP_NAME

    # 4-tab repeat: indent=4 and content matches a known pattern (step name or title)
    if n_tabs == 4:
        if _STEP_INVALID_RE.match(stripped) or _RIFT_TITLE_RE.match(stripped):
            return LineType.REPEAT_4TAB

    # Earned line
    if _EARNED_RE.match(stripped):
        return LineType.EARNED_LINE

    return LineType.OTHER


def _is_entry_start(line: str) -> bool:
    """True if line has 0 leading tabs and starts with a log timestamp (Approach E: regex-based)."""
    if _count_leading_tabs(line) != 0:
        return False
    return _ENTRY_HEAD_RE.match(line.strip()) is not None


def _get_block_kind_from_entry(line: str) -> Optional[str]:
    """Extract block kind (Session or Rift) from entry start line (Approach E: regex-based)."""
    stripped = line.strip()
    m = _ENTRY_HEAD_RE.match(stripped)
    if not m:
        return None
    return m.group(1)  # "Session" or "Rift"


def _content_indent(block_indent: int, kind: str, has_ts: bool) -> int:
    """
    Determine content indent for a block (Approach A: content_indent rules).
    Session at 0 with ts: content at 0; else content at block_indent+1.
    """
    if block_indent == 0 and kind == "Session" and has_ts:
        return 0
    return block_indent + 1


def _parse_earned_line(line: str) -> Optional[Tuple[str, int]]:
    """
    If line is 'X Earned: N', return (key, value).
    Key includes ' Earned' suffix (e.g. 'Gold Earned') to match _earned_to_stats_lines expectations.
    """
    s = line.strip()
    m = _EARNED_RE.match(s)
    if not m:
        return None
    key_base = m.group(1).strip()
    # Ensure key includes ' Earned' suffix for consistency
    if not key_base.endswith(" Earned"):
        key = key_base + " Earned"
    else:
        key = key_base
    try:
        val = int(m.group(2))
    except ValueError:
        return None
    return (key, val)


def _is_earned_line(line: str) -> bool:
    return _parse_earned_line(line) is not None


def _build_blocks_approach2(
    lines: List[str],
    max_lines: int = 0,
) -> List[Dict[str, Any]]:
    """
    Parse lines with multi-level indent (Approach B + enhancements).
    Approach C: Two-pass parsing - first pass identifies block boundaries and structure,
    second pass (integrated) extracts fields using content_indent rules (Approach A).

    Each block = one entry (0-tab timestamp) plus continuation lines.
    4-tab lines do not start a new block (repeat rule).
    Returns list of blocks; each block has head_time, head_sample, head_kind, earned (dict).
    """
    blocks: List[Dict[str, Any]] = []
    current_head_time: Optional[float] = None
    current_head_sample: str = ""
    current_head_kind: Optional[str] = None  # "Session" or "Rift"
    current_block_indent: int = 0
    current_earned: Dict[str, int] = {}
    # Stack of (effective_level, content_indent, earned_dict) for nested content
    # Approach A: content_indent determines where Earned belongs
    stack: List[Tuple[int, int, Dict[str, int]]] = []
    n_read = 0

    for line in lines:
        if max_lines and n_read >= max_lines:
            break
        s = line.rstrip("\n\r")
        if not s.strip():
            continue
        n_read += 1

        n_tabs = _count_leading_tabs(line)
        eff = _effective_level(n_tabs)
        stripped = s.strip()
        line_type = _classify_line_type(line, n_tabs)  # Approach D: line type classification

        if line_type == LineType.ENTRY_START and _is_entry_start(line):
            # Save previous block
            if current_head_time is not None or current_earned:
                blocks.append({
                    "head_time": current_head_time,
                    "head_sample": current_head_sample,
                    "head_kind": current_head_kind,
                    "earned": dict(current_earned),
                })
            # New block (Approach E: regex-based block head detection)
            current_head_time = parse_line_timestamp(stripped)
            current_head_sample = stripped[:100] + ("..." if len(stripped) > 100 else "")
            current_head_kind = _get_block_kind_from_entry(line)  # "Session" or "Rift"
            current_block_indent = 0
            current_earned = {}
            # Initialize stack with block's content_indent (Approach A)
            content_indent = _content_indent(0, current_head_kind or "Rift", current_head_time is not None)
            stack = [(0, content_indent, current_earned)]
            continue

        # Continuation line
        if not stack:
            continue

        # Approach D: Handle repeat 4-tab lines - do not process further
        if line_type == LineType.REPEAT_4TAB:
            continue

        # Pop until top level < current effective level
        while len(stack) > 1 and stack[-1][0] >= eff:
            stack.pop()
        if stack and stack[-1][0] > eff:
            # Should not happen if we only push 0,1,2,3; skip
            continue

        top_level, top_content_indent, top_earned = stack[-1]

        # Approach A: Earned lines belong to block if current indent matches content_indent
        if line_type == LineType.EARNED_LINE:
            kv = _parse_earned_line(line)
            if not kv:
                continue
            key, val = kv
            # For Session at 0: content_indent is 0, accept indent 0 or 1 (but Rift keys Earned only at 0)
            if current_head_kind == "Session" and top_content_indent == 0:
                if n_tabs == 0:
                    top_earned[key] = val
                elif n_tabs == 1 and "Rift keys Earned" not in key:
                    # Session accepts 1-tab Earned except Rift keys
                    top_earned[key] = val
            elif n_tabs == top_content_indent:
                # Exact match: Earned belongs to this block level
                top_earned[key] = val
            # If indent doesn't match, skip (belongs to a different level)
            continue

        # If we go deeper (eff > top_level), push new level with appropriate content_indent
        if eff > top_level:
            # Approach A: content_indent for nested blocks
            nested_content_indent = _content_indent(eff, "Rift", False)  # Nested are Rift-like
            stack.append((eff, nested_content_indent, top_earned))

    if current_head_time is not None or current_earned:
        blocks.append({
            "head_time": current_head_time,
            "head_sample": current_head_sample,
            "head_kind": current_head_kind,
            "earned": dict(current_earned),
        })

    return blocks


def _earned_to_stats_lines(earned: Dict[str, int]) -> List[str]:
    """Convert earned dict to 'Label: value' lines for compare/poll output."""
    order = [
        "Gold Earned", "DroppedItems Earned", "KeptItems Earned", "Shards Earned",
        "XP Earned", "RunXP Earned", "SequenceXP Earned",
        "Caldeum nightshade Earned", "Arreat war tapestry Earned",
        "Corrupted angel flesh Earned", "Khanduran rune Earned",
        "Westmarch holy water Earned", "Rift keys Earned", "Distance Earned", "Xp Pools Earned",
    ]
    out: List[str] = []
    seen = set()
    for k in order:
        if k in earned:
            out.append(f"{k}: {earned[k]}")
            seen.add(k)
    for k, v in earned.items():
        if k not in seen:
            out.append(f"{k}: {v}")
    return out


def get_last_block_earned_from_path(
    log_path: str,
    from_byte_position: int = 0,
    max_lines: int = 0,
) -> Dict[str, int]:
    """
    Read log from from_byte_position (or start if 0), parse with approach2 multi-level,
    return the last block's earned dict. Lines are read with leading tabs preserved.
    """
    if not os.path.isfile(log_path):
        return {}
    lines: List[str] = []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            if from_byte_position > 0:
                f.seek(from_byte_position)
                # Discard partial line
                f.readline()
            for line in f:
                # Preserve leading tabs: only rstrip
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    blocks = _build_blocks_approach2(lines, max_lines=max_lines)
    if not blocks:
        return {}
    return blocks[-1].get("earned", {})


class HistoryInfoOrganizerApproach2:
    """
    Organizer that uses multi-level indent (approach2) to derive latest stats from
    last block's Earned when the file has no traditional stats line.
    """

    def __init__(self, history_path: str) -> None:
        self._log_path = history_path
        self._last_position: int = 0

    def get_log_path(self) -> str:
        return self._log_path

    def read_new_lines(self) -> Tuple[int, List[str]]:
        """
        Read new lines from last position. Lines keep leading whitespace (rstrip only)
        so that tab level is preserved for approach2 parsing.
        """
        if not os.path.isfile(self._log_path):
            return self._last_position, []
        try:
            with open(self._log_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._last_position)
                raw = f.read()
                self._last_position = f.tell()
        except OSError:
            return self._last_position, []
        lines = [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.rstrip("\n\r").strip()]
        return self._last_position, lines

    def seek_to_end(self) -> int:
        """Seek to end of file and return current file size."""
        if not os.path.isfile(self._log_path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._log_path)
        except OSError:
            pass
        return self._last_position

    def get_latest_stats_as_lines(self) -> List[str]:
        """
        Read new lines (with tabs preserved), parse with approach2, return last block's
        Earned as 'Label: value' lines. If no block/earned, returns [].
        """
        _, lines = self.read_new_lines()
        if not lines:
            return []
        blocks = _build_blocks_approach2(lines)
        if not blocks:
            return []
        earned = blocks[-1].get("earned", {})
        return _earned_to_stats_lines(earned)

    def poll_once_and_get_stats_lines(self) -> List[str]:
        """Poll once: same as get_latest_stats_as_lines."""
        return self.get_latest_stats_as_lines()


_approach2_cache: Dict[str, HistoryInfoOrganizerApproach2] = {}


def get_history_info_organizer_approach2(history_path: str) -> HistoryInfoOrganizerApproach2:
    """Return cached HistoryInfoOrganizerApproach2 for history_path (singleton per path)."""
    if history_path not in _approach2_cache:
        _approach2_cache[history_path] = HistoryInfoOrganizerApproach2(history_path)
    return _approach2_cache[history_path]


def get_block_earned_at_timestamp(
    log_path: str,
    target_timestamp: float,
    max_lines: int = 0,
    tolerance_seconds: float = 1.0,
) -> Dict[str, int]:
    """
    Read history.txt, parse with approach2, find the block whose head_time matches target_timestamp,
    return that block's earned dict. Used for getting fixed reference block from history.txt.
    
    Args:
        log_path: Path to history.txt (NOT logs.txt)
        target_timestamp: Target timestamp (epoch seconds)
        max_lines: Max lines to read (0 = all)
        tolerance_seconds: Time tolerance for matching (default 1.0 second)
    
    Returns:
        Earned dict from the matching block, or empty dict if not found
    """
    if not os.path.isfile(log_path):
        return {}
    lines: List[str] = []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    blocks = _build_blocks_approach2(lines, max_lines=max_lines)
    # Find block with matching timestamp (within tolerance)
    for block in blocks:
        t = block.get("head_time")
        if t is not None and abs(t - target_timestamp) < tolerance_seconds:
            return block.get("earned", {})
    return {}


def get_last_block_earned_in_time_window_approach2(
    log_path: str,
    start_epoch: float,
    max_lines: int = 0,
) -> Dict[str, int]:
    """
    Read full file (or tail), parse with approach2, find the last block whose head_time >= start_epoch,
    return that block's earned dict. Used for --compare with a time window.
    
    Args:
        log_path: Path to history.txt (NOT logs.txt)
        start_epoch: Start timestamp (epoch seconds)
        max_lines: Max lines to read (0 = all)
    
    Returns:
        Earned dict from the last block in time window, or empty dict if not found
    """
    if not os.path.isfile(log_path):
        return {}
    lines: List[str] = []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    blocks = _build_blocks_approach2(lines, max_lines=max_lines)
    # Last block with head_time >= start_epoch
    for i in range(len(blocks) - 1, -1, -1):
        t = blocks[i].get("head_time")
        if t is not None and t >= start_epoch:
            return blocks[i].get("earned", {})
    return {}


def _aggregate_blocks_in_time_window(
    blocks: List[Dict[str, Any]], start_epoch: float
) -> Tuple[Dict[str, int], int, int]:
    """
    Aggregate Session + Rift blocks in time window. Returns (earned, game_count, baseline_keys).
    Enhanced: handle case where no Session exists (aggregate all Rifts in window).
    """
    earned: Dict[str, int] = {}
    game_count = 0
    baseline_keys = 0
    last_session_idx = -1
    for i, b in enumerate(blocks):
        if b.get("head_kind") == "Session":
            last_session_idx = i
    if last_session_idx >= 0:
        # Calculate baseline: sum Rift keys from Sessions before last_session
        for i in range(last_session_idx):
            if blocks[i].get("head_kind") == "Session":
                e = blocks[i].get("earned", {})
                baseline_keys += e.get("Rift keys Earned", e.get("Rift keys", 0))
        # Collect current Session earned
        for k, v in blocks[last_session_idx].get("earned", {}).items():
            earned[k] = earned.get(k, 0) + v
    # Aggregate Rifts after last Session (or all Rifts if no Session) that are in time window
    start_idx = last_session_idx + 1 if last_session_idx >= 0 else 0
    for i in range(start_idx, len(blocks)):
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


def get_stats_lines_in_time_window_approach2(
    log_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """
    Read full file, parse with approach2, aggregate all Rifts in time window [start_epoch, ...],
    format as the same 14 "Label: value" lines as approximate. For compare mode.
    Note: log_path should be history.txt path, not logs.txt.
    """
    if not os.path.isfile(log_path):
        return []
    lines: List[str] = []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                # Preserve leading TAB (rstrip only newlines, not tabs)
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return []
    blocks = _build_blocks_approach2(lines)
    earned, game_count, baseline_keys = _aggregate_blocks_in_time_window(blocks, start_epoch)
    # Allow empty earned if game_count > 0 (Rifts found but no earned data)
    # Only return empty if both earned and game_count are 0
    if not earned and game_count == 0:
        return []
    if boting_seconds <= 0:
        boting_seconds = max(1, int(time.time() - start_epoch))
    return earned_to_approximate_stats_lines(
        earned, game_count, 0, boting_seconds, baseline_keys
    )


__all__ = [
    "HistoryInfoOrganizerApproach2",
    "get_history_info_organizer_approach2",
    "get_last_block_earned_from_path",
    "get_last_block_earned_in_time_window_approach2",
    "get_block_earned_at_timestamp",
    "get_stats_lines_in_time_window_approach2",
    "_earned_to_stats_lines",
    "_build_blocks_approach2",
]
