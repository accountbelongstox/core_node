#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer — Approach 5 (regex + indent stack).

Implements Approach E from HistoryReader.md: block heads by regex (timestamp + INFO - Rift/Session),
stack by (indent, type) with type in (entry, rift, step); 4-tab lines treated as repeat (no new node);
Earned lines attached to stack top; Session Rift keys only when stack top is Session and indent=0.

All logic and identifiers are in English. Uses history_indent_spec for tab count and timestamp parsing.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from d3utils.history_indent_spec import get_line_indent_state, parse_line_timestamp


# ----- Line classification (regex + content) -----

# Top-level: "YYYY-MM-DD HH:MM:SS,mmm INFO - " then optional tab + "Rift" or "Session"
# Note: Rift has a tab after "INFO - ", Session does not
_RE_ENTRY = re.compile(
    r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+(?:INFO|WARN)\s+-\s+\t?(Rift|Session)\s*$"
)
# Success or Sucess (typo) + Duration
_RE_SUCCESS_DURATION = re.compile(
    r"^(?:Su(?:cces|ces)s):\s*(True|False)\s*\|\s*Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)\s*$",
    re.IGNORECASE,
)
# Step name: "Open Rift Invalid", "Do Rift Invalid", etc.
_RE_STEP = re.compile(r"^.+\s+Invalid\s*$")
# Earned: "X Earned: N" (key may contain spaces; N may be negative)
_RE_EARNED = re.compile(r"^(.+?)\s+Earned:\s*(-?\d+)\s*$")

# Known step names for 4-tab repeat check (content equality)
_STEP_NAMES = frozenset({
    "Open Rift Invalid",
    "Do Rift Invalid",
    "Kill Boss Invalid",
    "RiftItem Invalid",
    "Urshi Invalid",
    "Talk to Orek Invalid",
})


def _indent_tabs(line: str) -> int:
    """Return number of leading TABs only (consistent with history.txt)."""
    n, _, _ = get_line_indent_state(line)
    return n


def _line_type(line: str, n_tabs: int, stripped: str) -> Tuple[str, Optional[Any]]:
    """
    Classify line into: entry_start, rift_title, success_duration, step_name, earned_line, repeat_4tab, other.
    Returns (type, payload). Payload: for entry_start (ts_epoch, kind), success_duration (success_bool, duration_str),
    step_name (name), earned_line (key, value), else None.
    """
    if n_tabs == 0 and stripped:
        m = _RE_ENTRY.match(stripped)
        if m:
            ts_str = m.group(1)
            kind = m.group(2).strip()
            try:
                dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
                ms = int(ts_str[20:23]) if len(ts_str) >= 23 else 0
                ts_epoch = dt.timestamp() + ms / 1000.0
            except (ValueError, IndexError):
                ts_epoch = 0.0
            return "entry_start", (ts_epoch, kind)
    if stripped == "Rift":
        return "rift_title", None
    if stripped == "Session":
        return "session_title", None
    m = _RE_SUCCESS_DURATION.match(stripped)
    if m:
        success = m.group(1).strip().lower() == "true"
        duration = m.group(2).strip()
        return "success_duration", (success, duration)
    if _RE_STEP.match(stripped):
        name = stripped.strip()
        if name in _STEP_NAMES:
            return "step_name", name
    m = _RE_EARNED.match(stripped)
    if m:
        key = m.group(1).strip()
        try:
            value = int(m.group(2))
        except ValueError:
            return "other", None
        return "earned_line", (key, value)
    return "other", None


# ----- Tree nodes (immutable-friendly dicts for JSON-like output) -----


@dataclass
class StepNode:
    """One step (Open Rift Invalid, Do Rift Invalid, ...) with success, duration, earned."""
    name: str
    success: Optional[bool] = None
    duration: Optional[str] = None
    earned: Dict[str, int] = field(default_factory=dict)


@dataclass
class RiftNode:
    """Nested Rift block: success, duration, earned, steps."""
    success: Optional[bool] = None
    duration: Optional[str] = None
    earned: Dict[str, int] = field(default_factory=dict)
    steps: List[StepNode] = field(default_factory=list)


@dataclass
class EntryNode:
    """One log entry (timestamp + Rift or Session): run-level success/duration/earned + nested rifts/steps."""
    timestamp_epoch: float
    kind: str  # "Rift" | "Session"
    success: Optional[bool] = None
    duration: Optional[str] = None
    earned: Dict[str, int] = field(default_factory=dict)
    rifts: List[RiftNode] = field(default_factory=list)


def _parse_lines_to_entries(lines: List[str]) -> List[EntryNode]:
    """
    Parse a list of lines (with leading TABs preserved) into a list of EntryNode.
    Uses stack of (indent, type, node). 4-tab line with same content as last 3-tab step is treated as repeat (no new step).
    """
    entries: List[EntryNode] = []
    stack: List[Tuple[int, str, Any]] = []  # (indent, "entry"|"rift"|"step", node)
    last_3tab_step_content: Optional[str] = None

    for raw_line in lines:
        line = raw_line.rstrip("\n\r")
        stripped = line.lstrip("\t").strip()
        if not stripped:
            continue
        n_tabs = _indent_tabs(line)
        ltype, payload = _line_type(line, n_tabs, stripped)

        if ltype == "entry_start":
            while stack:
                stack.pop()
            ts_epoch, kind = payload
            node = EntryNode(timestamp_epoch=ts_epoch, kind=kind)
            entries.append(node)
            stack.append((0, "entry", node))
            last_3tab_step_content = None
            continue

        if ltype == "rift_title":
            while stack and stack[-1][0] >= n_tabs:
                stack.pop()
            # Only push rift for nested rifts (n_tabs >= 2)
            # 1-tab "Rift" is just a title marker, not a nested block
            if n_tabs >= 2 and stack and stack[-1][1] == "entry":
                parent = stack[-1][2]
                rift = RiftNode()
                parent.rifts.append(rift)
                stack.append((n_tabs, "rift", rift))
            # For 1-tab Rift, don't push - keep stack as entry so run-level Earned goes to entry
            last_3tab_step_content = None
            continue

        if ltype == "session_title":
            while stack and stack[-1][0] >= n_tabs:
                stack.pop()
            last_3tab_step_content = None
            continue

        if ltype == "success_duration":
            if not stack:
                continue
            success, duration = payload
            # Pop until we find a node at indent <= current indent
            while len(stack) > 1 and stack[-1][0] > n_tabs:
                stack.pop()
            top_indent, top_type, top = stack[-1]
            if hasattr(top, "success"):
                top.success = success
            if hasattr(top, "duration"):
                top.duration = duration
            last_3tab_step_content = None
            continue

        if ltype == "step_name":
            if n_tabs == 4 and last_3tab_step_content is not None and stripped.strip() == last_3tab_step_content:
                continue
            last_3tab_step_content = stripped.strip()
            while stack and stack[-1][0] >= n_tabs:
                stack.pop()
            if not stack:
                continue
            parent = stack[-1][2]
            if hasattr(parent, "steps"):
                step = StepNode(name=last_3tab_step_content)
                parent.steps.append(step)
                stack.append((n_tabs, "step", step))
            continue

        if ltype == "earned_line":
            if not stack:
                continue
            key_base, value = payload
            # Ensure key includes ' Earned' suffix for consistency with _earned_to_stats_lines
            if not key_base.endswith(" Earned"):
                key = key_base + " Earned"
            else:
                key = key_base
            top_indent, top_type, top = stack[-1]
            # Session: only accept indent=0 earned
            if top_type == "entry" and top.kind == "Session" and n_tabs != 0:
                continue
            # For Rift entries: 1-tab earned goes to entry (run-level), 2+ tab earned goes to nested rift/step
            # If current indent is less than top indent, we may need to pop to find the right parent
            while len(stack) > 1 and stack[-1][0] > n_tabs:
                stack.pop()
            top_indent, top_type, top = stack[-1]
            if hasattr(top, "earned"):
                top.earned[key] = value
            last_3tab_step_content = None
            continue

        last_3tab_step_content = None

    return entries


def parse_history_file(
    file_path: str,
    max_lines: int = 0,
    encoding: str = "utf-8",
) -> List[EntryNode]:
    """
    Read history file and parse into list of EntryNode.
    Preserves leading TABs (no strip of entire line). max_lines=0 means no limit.
    """
    if not os.path.isfile(file_path):
        return []
    lines: List[str] = []
    n = 0
    try:
        with open(file_path, "r", encoding=encoding, errors="ignore") as f:
            for line in f:
                if max_lines and n >= max_lines:
                    break
                lines.append(line.rstrip("\n\r"))
                if line.strip():
                    n += 1
    except Exception:
        return []
    return _parse_lines_to_entries(lines)


def get_riftrun_entries(history_path: str, max_lines: int = 0) -> List[EntryNode]:
    """
    Public API: return list of EntryNode for the given history file.
    Uses full line (with leading TABs) for parsing.
    """
    if not os.path.isfile(history_path):
        return []
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if max_lines and len(lines) >= max_lines:
                    break
                lines.append(line)
    except Exception:
        return []
    return _parse_lines_to_entries(lines)


def entry_to_label_value_lines(entry: EntryNode) -> List[str]:
    """
    Convert one EntryNode to "Label: value" lines (for comparison with stats-style output).
    Includes timestamp, kind, run success/duration, and run-level earned keys.
    """
    out: List[str] = []
    out.append(f"Timestamp: {entry.timestamp_epoch}")
    out.append(f"Kind: {entry.kind}")
    if entry.success is not None:
        out.append(f"Success: {entry.success}")
    if entry.duration is not None:
        out.append(f"Duration: {entry.duration}")
    for k, v in sorted(entry.earned.items()):
        out.append(f"{k} Earned: {v}")
    return out


def get_latest_earned_from_history(history_path: str, max_lines: int = 0) -> Optional[Dict[str, int]]:
    """
    Return the run-level earned dict of the last entry in the file, or None if no entry.
    Useful for comparing last block stats.
    """
    entries = get_riftrun_entries(history_path, max_lines=max_lines)
    if not entries:
        return None
    return dict(entries[-1].earned)


def _earned_to_stats_lines(earned: Dict[str, int]) -> List[str]:
    """
    Convert earned dict to 'Label: value' lines for compare/poll output.
    Maps history.txt Earned keys to approximate labels where possible for comparison:
    - "Shards Earned" -> "Shards earned" (lowercase, no " Earned")
    - "Distance Earned" -> "Distance" (no " Earned")
    - "Xp Pools Earned" -> "Xp Pools" (no " Earned")
    - "XP Earned" -> "Earned Xp" (reordered, different case)
    - "RunXP Earned" -> "Run Xp" (space, no " Earned")
    - Others keep "X Earned" format for clarity.
    Order matches approach2 for consistency.
    """
    # Map history Earned keys to approximate labels (for comparison with APPROXIMATE_STATS_LINES)
    _EARNED_TO_APPROX_LABEL = {
        "Shards Earned": "Shards earned",
        "Distance Earned": "Distance",
        "Xp Pools Earned": "Xp Pools",
        "XP Earned": "Earned Xp",
        "RunXP Earned": "Run Xp",
        # Others keep "X Earned" format (e.g. "Gold Earned", "Rift keys Earned")
    }
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
            label = _EARNED_TO_APPROX_LABEL.get(k, k)
            out.append(f"{label}: {earned[k]}")
            seen.add(k)
    for k, v in earned.items():
        if k not in seen:
            label = _EARNED_TO_APPROX_LABEL.get(k, k)
            out.append(f"{label}: {v}")
    return out


def get_last_entry_earned_in_time_window_approach5(
    history_path: str,
    start_epoch: float,
    max_lines: int = 0,
) -> Dict[str, int]:
    """
    Read full file (or tail), parse with approach5, find the last entry whose timestamp_epoch >= start_epoch,
    return that entry's earned dict. Used for --compare with a time window.
    """
    entries = get_riftrun_entries(history_path, max_lines=max_lines)
    if not entries:
        return {}
    # Last entry with timestamp >= start_epoch
    for i in range(len(entries) - 1, -1, -1):
        entry = entries[i]
        if entry.timestamp_epoch >= start_epoch:
            return dict(entry.earned)
    return {}


def _parse_duration_to_seconds(duration_str: Optional[str]) -> int:
    """Parse duration string (HH:MM:SS.ffffff) to seconds."""
    if not duration_str:
        return 0
    from d3utils.history_stats_formatter import _parse_duration_to_seconds as _parse
    return _parse(duration_str)


def _collect_all_earned_from_entry(entry: EntryNode) -> Dict[str, int]:
    """
    Recursively collect all earned from entry, including nested rifts and steps.
    Returns aggregated earned dict.
    """
    earned = dict(entry.earned)
    
    # Collect from nested rifts
    for rift in entry.rifts:
        for k, v in rift.earned.items():
            earned[k] = earned.get(k, 0) + v
        # Collect from nested steps
        for step in rift.steps:
            for k, v in step.earned.items():
                earned[k] = earned.get(k, 0) + v
    
    return earned


def _aggregate_entries_in_time_window_approach5(
    entries: List[EntryNode],
    start_epoch: float,
) -> Tuple[Dict[str, int], int, int, int, int]:
    """
    Aggregate entries in time window [start_epoch, ...]:
    - Find last Session before or in window
    - Aggregate Session-level earned (Rift keys only from indent 0) + all Rifts after Session in window
    - Calculate game_count (Rift entries in window), durations, baseline_keys
    
    Returns: (earned_dict, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys)
    """
    earned: Dict[str, int] = {}
    game_count = 0
    total_duration_seconds = 0
    last_run_duration_seconds = 0
    baseline_keys = 0
    
    # Find last Session
    last_session: Optional[EntryNode] = None
    last_session_idx = -1
    for idx, e in enumerate(entries):
        if e.kind == "Session":
            last_session = e
            last_session_idx = idx
    
    if last_session is None:
        # No Session found, aggregate all Rifts in window
        for e in entries:
            if e.kind == "Rift" and e.timestamp_epoch >= start_epoch:
                game_count += 1
                entry_earned = _collect_all_earned_from_entry(e)
                for k, v in entry_earned.items():
                    earned[k] = earned.get(k, 0) + v
                dur_secs = _parse_duration_to_seconds(e.duration)
                if dur_secs:
                    total_duration_seconds += dur_secs
                    last_run_duration_seconds = dur_secs
        return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys
    
    # Calculate baseline: sum Rift keys from all Sessions before last_session
    for prev_idx in range(last_session_idx):
        prev_e = entries[prev_idx]
        if prev_e.kind == "Session":
            # Session-level Rift keys (only from indent 0, but approach5 stores at entry level)
            # Collect all earned to find Rift keys
            prev_earned = _collect_all_earned_from_entry(prev_e)
            rift_keys = prev_earned.get("Rift keys Earned", 0)
            baseline_keys += rift_keys
    
    # Parse current Session earned (all earned, including nested)
    session_earned = _collect_all_earned_from_entry(last_session)
    # For Session, only Rift keys Earned should be included (from indent 0)
    # But approach5 stores all earned at entry level, so we take Rift keys only
    session_rift_keys = session_earned.get("Rift keys Earned", 0)
    earned["Rift keys Earned"] = session_rift_keys
    
    # Aggregate all Rifts after last_session that are in window
    for idx in range(last_session_idx + 1, len(entries)):
        e = entries[idx]
        if e.kind == "Rift" and e.timestamp_epoch >= start_epoch:
            game_count += 1
            entry_earned = _collect_all_earned_from_entry(e)
            for k, v in entry_earned.items():
                earned[k] = earned.get(k, 0) + v
            dur_secs = _parse_duration_to_seconds(e.duration)
            if dur_secs:
                total_duration_seconds += dur_secs
                last_run_duration_seconds = dur_secs
    
    return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys


def get_stats_lines_in_time_window_approach5(
    history_path: str,
    start_epoch: float,
    boting_seconds: int = 0,
    max_lines: int = 0,
) -> List[str]:
    """
    Parse history file with approach5, aggregate entries in time window [start_epoch, ...],
    return 14 "Label: value" lines matching APPROXIMATE_STATS_LINES format.
    
    Uses format_stats_lines_from_earned from history_stats_formatter for consistency.
    """
    from d3utils.history_stats_formatter import format_stats_lines_from_earned
    
    entries = get_riftrun_entries(history_path, max_lines=max_lines)
    if not entries:
        return []
    
    earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys = (
        _aggregate_entries_in_time_window_approach5(entries, start_epoch)
    )
    
    if not earned and game_count == 0:
        return []
    
    if boting_seconds <= 0:
        import time
        boting_seconds = max(1, int(time.time() - start_epoch))
    
    return format_stats_lines_from_earned(
        earned,
        game_count,
        last_run_duration_seconds,
        boting_seconds,
        baseline_keys,
    )


def get_latest_stats_as_lines_approach5(history_path: str, max_lines: int = 0) -> List[str]:
    """
    Return "Label: value" lines for the last entry (approach5 style).
    If no entry or no earned, returns placeholder lines so caller can compare.
    """
    entries = get_riftrun_entries(history_path, max_lines=max_lines)
    if not entries:
        return ["Kind: (no entry)", "Success: --", "Duration: --"]
    entry = entries[-1]
    if not entry.earned:
        return ["Kind: " + entry.kind, "Success: --", "Duration: --"]
    return _earned_to_stats_lines(entry.earned)


__all__ = [
    "EntryNode",
    "RiftNode",
    "StepNode",
    "get_riftrun_entries",
    "get_latest_earned_from_history",
    "get_last_entry_earned_in_time_window_approach5",
    "get_stats_lines_in_time_window_approach5",
    "get_latest_stats_as_lines_approach5",
    "parse_history_file",
    "entry_to_label_value_lines",
    "_earned_to_stats_lines",
]
