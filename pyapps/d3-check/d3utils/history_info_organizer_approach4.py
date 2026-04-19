#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer – Approach 4: State machine + line type tagging.

Parses RoS-BoT history.txt by classifying each line (entry_start, rift_title,
success_duration, step_name, earned_line, repeat_4tab) and driving a state machine.
4-tab lines are treated as fixed duplicates: do not open a new step node.

Reference: docs/test_docdir_2/HistoryReader.md §4.4, approach 4 doc.
All code and comments in English.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from d3utils.history_stats_formatter import format_stats_lines_from_earned, _parse_duration_to_seconds

# -----------------------------------------------------------------------------
# Line type (tag per line)
# -----------------------------------------------------------------------------


class LineType(Enum):
    """Tag assigned to each non-empty line before state transition."""

    ENTRY_START = "entry_start"  # 0 tab + timestamp + INFO - Session|Rift
    RIFT_TITLE = "rift_title"  # content is exactly "Rift"
    SESSION_TITLE = "session_title"  # content is exactly "Session" (0 tab, no ts)
    SUCCESS_DURATION = "success_duration"  # Success:|Sucess: True|False| Duration: ...
    STEP_NAME = "step_name"  # ends with " Invalid" (e.g. Open Rift Invalid)
    EARNED_LINE = "earned_line"  # "X Earned: N"
    REPEAT_4TAB = "repeat_4tab"  # 4 tab and same content as previous 3-tab step/line
    OTHER = "other"


# -----------------------------------------------------------------------------
# Parsing helpers
# -----------------------------------------------------------------------------

_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:,(\d{3}))?\s+INFO\s+-\s+(.*)$")
_SUCCESS_DURATION_RE = re.compile(
    r"(?:Success|Sucess)\s*:\s*(True|False)\s*\|\s*Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)",
    re.IGNORECASE,
)
_EARNED_RE = re.compile(r"^\s*(.+?)\s+Earned:\s*(-?\d+)\s*$")
_STEP_INVALID_RE = re.compile(r"^\s*(.+?\s+Invalid)\s*$")


def _count_leading_tabs(line: str) -> int:
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _parse_timestamp(line: str) -> Optional[float]:
    s = line.strip()
    m = re.match(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:,(\d{3}))?", s)
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
        ms = int(m.group(2)) if m.group(2) else 0
        return dt.timestamp() + ms / 1000.0
    except (ValueError, TypeError):
        return None


def _classify_line(line: str, n_tabs: int, prev_3tab_content: Optional[str]) -> Tuple[LineType, Optional[datetime], Optional[str], Optional[Tuple[str, int]], Optional[Tuple[bool, str]]]:
    """
    Classify one line. Returns (line_type, ts_if_entry, step_name_if_step, earned_kv_if_earned, success_duration_if_success).
    """
    stripped = line.strip()
    if not stripped:
        return (LineType.OTHER, None, None, None, None)

    # Entry start: 0 tab, timestamp + INFO - Session or \t?Rift
    if n_tabs == 0 and _TS_RE.match(stripped):
        m = _TS_RE.match(stripped)
        if m:
            rest = (m.group(3) or "").strip().lstrip("\t")
            if rest == "Session":
                try:
                    ts_part = m.group(1) + ("," + m.group(2) if m.group(2) else "")
                    dt = datetime.strptime(ts_part[:19], "%Y-%m-%d %H:%M:%S")
                    ms = int(ts_part[20:23]) if len(ts_part) >= 23 else 0
                    ts = dt.timestamp() + ms / 1000.0
                    return (LineType.ENTRY_START, datetime.fromtimestamp(ts), None, None, None)
                except (ValueError, IndexError):
                    pass
            if rest == "Rift":
                try:
                    ts_part = m.group(1) + ("," + m.group(2) if m.group(2) else "")
                    dt = datetime.strptime(ts_part[:19], "%Y-%m-%d %H:%M:%S")
                    ms = int(ts_part[20:23]) if len(ts_part) >= 23 else 0
                    ts = dt.timestamp() + ms / 1000.0
                    return (LineType.ENTRY_START, datetime.fromtimestamp(ts), None, None, None)
                except (ValueError, IndexError):
                    return (LineType.ENTRY_START, None, None, None, None)
    if n_tabs == 0 and stripped == "Session":
        return (LineType.SESSION_TITLE, None, None, None, None)

    # Rift title: content is exactly "Rift"
    if stripped == "Rift":
        return (LineType.RIFT_TITLE, None, None, None, None)

    # Success/Sucess + Duration
    mo = _SUCCESS_DURATION_RE.search(stripped)
    if mo:
        success = mo.group(1).strip().lower() == "true"
        duration = (mo.group(2) or "").strip()
        return (LineType.SUCCESS_DURATION, None, None, None, (success, duration))

    # Step name: ends with " Invalid"
    if _STEP_INVALID_RE.match(stripped) and " Invalid" in stripped:
        step_name = stripped.strip()
        return (LineType.STEP_NAME, None, step_name, None, None)

    # 4-tab repeat: same content as prev 3-tab
    if n_tabs == 4 and prev_3tab_content is not None and stripped == prev_3tab_content:
        return (LineType.REPEAT_4TAB, None, None, None, None)

    # Earned line
    me = _EARNED_RE.match(line)
    if not me:
        me = _EARNED_RE.match(stripped)
    if me:
        key = me.group(1).strip()
        val = int(me.group(2))
        return (LineType.EARNED_LINE, None, None, (key, val), None)

    return (LineType.OTHER, None, None, None, None)


# -----------------------------------------------------------------------------
# Block node for tree output (compatible with rosbot_history_parser.Block usage)
# -----------------------------------------------------------------------------


@dataclass
class Block4:
    """One block: entry or rift or step, with optional ts, earned dict, children."""

    indent: int
    kind: str  # "Session" | "Rift" | "Step"
    ts: Optional[datetime] = None
    success: Optional[bool] = None
    duration: Optional[str] = None
    step_name: Optional[str] = None
    earned: Dict[str, int] = field(default_factory=dict)
    children: List[Block4] = field(default_factory=list)

    def get(self, key: str, default: int = 0) -> int:
        k = key.replace(" ", "")
        for ek, v in self.earned.items():
            if ek.replace(" ", "") == k:
                return v
        return default


# -----------------------------------------------------------------------------
# State machine
# -----------------------------------------------------------------------------


def parse_history_lines_state_machine(lines: List[str]) -> List[Block4]:
    """
    Parse lines into a tree of Block4 using state machine + line types.
    - entry_start starts a new top-level block (Session or Rift).
    - rift_title / success_duration / earned_line attach to current block by indent.
    - step_name at 3 tab starts a step; 4-tab repeat does not start a new step.
    - Earned lines are attributed to the current block (content_indent rule).
    """
    roots: List[Block4] = []
    stack: List[Tuple[Block4, int]] = []  # (block, content_indent for direct content)
    prev_3tab_content: Optional[str] = None
    current_step_name: Optional[str] = None

    for line in lines:
        raw = line.rstrip("\n\r")
        n_tabs = _count_leading_tabs(raw)
        line_type, ts, step_name, earned_kv, success_duration = _classify_line(
            raw, n_tabs, prev_3tab_content
        )

        if line_type == LineType.REPEAT_4TAB:
            continue

        if line_type == LineType.ENTRY_START and ts is not None:
            # Determine kind from rest after "INFO - "
            rest = ""
            m = _TS_RE.match(raw.strip())
            if m:
                rest = (m.group(3) or "").strip().lstrip("\t")
            kind = "Session" if rest == "Session" else "Rift"
            while stack and stack[-1][0].indent >= 0:
                stack.pop()
            b = Block4(indent=0, kind=kind, ts=ts)
            roots.append(b)
            content_indent = 0 if kind == "Session" else 1
            stack.append((b, content_indent))
            prev_3tab_content = None
            current_step_name = None
            continue

        if line_type == LineType.SESSION_TITLE and n_tabs == 0:
            # Duplicate "Session" line after timestamp line; keep current block
            continue

        if line_type == LineType.RIFT_TITLE:
            while stack and stack[-1][0].indent >= n_tabs:
                stack.pop()
            # Rift title starts a new child block only if we have a parent
            parent_indent = stack[-1][0].indent if stack else -1
            if n_tabs > parent_indent and stack:
                b = Block4(indent=n_tabs, kind="Rift")
                stack[-1][0].children.append(b)
                # Rift content (Success, Earned) is at n_tabs + 1 (e.g., 1-tab Rift has 2-tab content)
                # But actually, 1-tab Rift has 1-tab Earned lines, so content_indent = n_tabs
                stack.append((b, n_tabs))
            prev_3tab_content = None
            current_step_name = None
            continue

        if line_type == LineType.STEP_NAME and step_name and n_tabs == 3:
            while stack and stack[-1][0].indent >= n_tabs:
                stack.pop()
            if stack:
                b = Block4(indent=n_tabs, kind="Step", step_name=step_name)
                stack[-1][0].children.append(b)
                # Step content (Sucess, Earned) is at same indent 3, not 4 (4-tab = repeat)
                stack.append((b, 3))
            prev_3tab_content = step_name
            current_step_name = step_name
            continue

        if line_type == LineType.SUCCESS_DURATION and success_duration is not None and stack:
            success, duration = success_duration
            stack[-1][0].success = success
            stack[-1][0].duration = duration
            continue

        if line_type == LineType.EARNED_LINE and earned_kv is not None and stack:
            key, val = earned_kv
            # Pop until we find block whose content_indent matches n_tabs
            while stack and stack[-1][1] > n_tabs:
                stack.pop()
            if stack:
                block, cindent = stack[-1]
                # Match content_indent exactly, or handle special cases
                if n_tabs == cindent:
                    block.earned[key] = val
                elif block.indent == 0 and block.kind == "Session" and block.ts is not None:
                    # Session: 0-tab or 1-tab (except Rift keys) go to Session
                    if n_tabs == 0 or (n_tabs == 1 and key.replace(" ", "") != "Riftkeys"):
                        block.earned[key] = val
                elif block.indent == 0 and block.kind == "Rift" and block.ts is not None:
                    # Rift entry: 1-tab Earned goes to Rift block
                    if n_tabs == 1:
                        block.earned[key] = val
            continue

        # Indent decreased: pop stack
        if stack and n_tabs < stack[-1][0].indent:
            while stack and stack[-1][0].indent >= n_tabs:
                stack.pop()
            if line_type == LineType.EARNED_LINE and earned_kv is not None and stack:
                key, val = earned_kv
                block, cindent = stack[-1]
                if n_tabs == cindent or (
                    block.indent == 0
                    and block.kind == "Session"
                    and block.ts is not None
                    and (n_tabs == 0 or (n_tabs == 1 and key.replace(" ", "") != "Riftkeys"))
                ):
                    block.earned[key] = val

    return roots


def _earned_get(earned: Dict[str, int], key: str, default: int = 0) -> int:
    """
    Get value by key with space-normalized match (like Block.get).
    Enhanced: matches both "Gold" and "Gold Earned", "Shards" and "Shards Earned", etc.
    """
    k = key.replace(" ", "").replace("Earned", "").strip()
    for ek, v in earned.items():
        ek_normalized = ek.replace(" ", "").replace("Earned", "").strip()
        if ek_normalized == k:
            return v
    return default


def earned_to_label_value_lines(earned: Dict[str, int]) -> List[str]:
    """Convert earned dict to 'Label: value' lines for display (compatible with parse_stats_line output)."""
    out: List[str] = []
    labels = [
        "Gold Earned",
        "DroppedItems Earned",
        "KeptItems Earned",
        "Shards Earned",
        "XP Earned",
        "RunXP Earned",
        "SequenceXP Earned",
        "Rift keys Earned",
        "Distance Earned",
        "Xp Pools Earned",
    ]
    for label in labels:
        v = _earned_get(earned, label)
        out.append(f"{label}: {v}")
    return out


def _last_block_earned(roots: List[Block4]) -> Optional[Dict[str, int]]:
    """Return earned dict of the last top-level block (Session or Rift) that has ts or is Rift."""
    if not roots:
        return None
    last = roots[-1]
    return dict(last.earned) if last.earned else None


def get_latest_earned_as_lines(history_path: str, max_lines: int = 0) -> List[str]:
    """
    Read history file (from end or full), parse with state machine, return last block earned
    as 'Label: value' lines. Preserves leading TAB by reading raw lines (rstrip only).
    """
    if not os.path.isfile(history_path):
        return []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            if max_lines > 0:
                lines = []
                for _ in range(max_lines):
                    line = f.readline()
                    if not line:
                        break
                    lines.append(line.rstrip("\n\r"))
            else:
                lines = [ln.rstrip("\n\r") for ln in f]
    except Exception:
        return []
    non_empty = [ln for ln in lines if ln.strip()]
    roots = parse_history_lines_state_machine(non_empty)
    earned = _last_block_earned(roots)
    if not earned:
        return []
    return earned_to_label_value_lines(earned)


def _aggregate_session_and_rifts_approach4(
    roots: List[Block4],
    start_epoch: float,
) -> Tuple[Dict[str, int], int, int, int]:
    """
    Aggregate last Session and all Rifts after it in time window.
    Returns (earned, game_count, total_duration_seconds, last_run_duration_seconds).
    Enhanced from approach3: uses Block4 tree structure.
    """
    earned: Dict[str, int] = {}
    game_count = 0
    total_duration_seconds = 0
    last_run_duration_seconds = 0
    last_session: Optional[Block4] = None
    last_session_idx = -1
    
    # Find last Session
    for idx, block in enumerate(roots):
        if block.kind == "Session":
            last_session = block
            last_session_idx = idx
    
    if last_session is None:
        return earned, game_count, total_duration_seconds, last_run_duration_seconds
    
    # Parse Session earned (Rift keys only from indent 0)
    session_earned: Dict[str, int] = {}
    for k, v in last_session.earned.items():
        if k.replace(" ", "") == "Riftkeys":
            session_earned["Rift keys"] = session_earned.get("Rift keys", 0) + v
        else:
            session_earned[k] = session_earned.get(k, 0) + v
    
    earned = dict(session_earned)
    
    # Aggregate Rifts after last Session that are in time window
    for idx in range(last_session_idx + 1, len(roots)):
        block = roots[idx]
        if block.kind == "Rift" and block.ts is not None:
            ts_epoch = block.ts.timestamp()
            if ts_epoch >= start_epoch:
                game_count += 1
                # Aggregate earned
                for k, v in block.earned.items():
                    earned[k] = earned.get(k, 0) + v
                # Aggregate duration
                if block.duration:
                    dur_sec = _parse_duration_to_seconds(block.duration)
                    total_duration_seconds += dur_sec
                    last_run_duration_seconds = dur_sec
    
    return earned, game_count, total_duration_seconds, last_run_duration_seconds


def get_last_block_earned_in_time_window_approach4(
    history_path: str,
    start_epoch: float,
    max_lines: int = 0,
) -> Dict[str, int]:
    """
    Read full file (or tail), parse with approach4 state machine, find the last block whose head_time >= start_epoch,
    return that block's earned dict. Used for --compare with a time window (enhanced from approach2).
    
    Enhanced: Also checks nested Rift blocks (children) for earned if top-level block has no earned.
    """
    if not os.path.isfile(history_path):
        return {}
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except Exception:
        return {}
    non_empty = [ln for ln in lines if ln.strip()]
    roots = parse_history_lines_state_machine(non_empty)
    # Find last block with ts >= start_epoch (enhanced: check nested rifts)
    last_block: Optional[Block4] = None
    for block in reversed(roots):
        if block.ts is not None:
            ts_epoch = block.ts.timestamp()
            if ts_epoch >= start_epoch:
                last_block = block
                break
    if last_block is None:
        return {}
    # If top-level block has no earned, try nested Rift (enhanced from approach2)
    if not last_block.earned and last_block.children:
        for child in reversed(last_block.children):
            if child.kind == "Rift" and child.earned:
                return dict(child.earned)
    return dict(last_block.earned) if last_block.earned else {}


def get_stats_lines_in_time_window_approach4(
    history_path: str,
    start_epoch: float,
    boting_seconds: int = 0,
) -> List[str]:
    """
    Parse history file with approach4 state machine; aggregate last Session and Rifts in time window;
    return 14 "Label: value" lines matching APPROXIMATE_STATS_LINES format.
    
    Enhanced: Uses shared formatting from history_stats_formatter (same as approach3).
    """
    if not os.path.isfile(history_path):
        return []
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except Exception:
        return []
    non_empty = [ln for ln in lines if ln.strip()]
    roots = parse_history_lines_state_machine(non_empty)
    
    # Aggregate Session and Rifts
    earned, game_count, total_duration_seconds, last_run_duration_seconds = _aggregate_session_and_rifts_approach4(
        roots, start_epoch
    )
    
    # Calculate baseline keys (sum from previous Sessions)
    baseline_keys = 0
    for block in roots:
        if block.kind == "Session" and block.ts is not None:
            ts_epoch = block.ts.timestamp()
            if ts_epoch < start_epoch:
                for k, v in block.earned.items():
                    if k.replace(" ", "") == "Riftkeys":
                        baseline_keys += v
    
    # Use shared formatter
    return format_stats_lines_from_earned(
        earned,
        game_count,
        last_run_duration_seconds,
        boting_seconds,
        baseline_keys,
    )


def get_default_history_path() -> str:
    """Default history file path (same as log_info_organizer)."""
    try:
        from d3utils.log_info_organizer import get_default_history_path as _get
        return _get()
    except ImportError:
        return os.path.join(os.path.expanduser("~"), "Documents", "RoS-BoT", "Logs", "history.txt")


__all__ = [
    "Block4",
    "LineType",
    "parse_history_lines_state_machine",
    "get_latest_earned_as_lines",
    "get_last_block_earned_in_time_window_approach4",
    "get_stats_lines_in_time_window_approach4",
    "earned_to_label_value_lines",
    "get_default_history_path",
]
