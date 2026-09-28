#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer - Approach 3 (two-pass parsing).

Approach C from HistoryReader: first pass = entry/paragraph boundaries only;
second pass = parse fields (Success/Sucess, Duration, Earned, step names) within each paragraph.
- Preserves leading TAB for indent; 4-tab lines merged with previous 3-tab paragraph (fixed repeat).
- Outputs same "Label: value" lines as parse_stats_line for compare mode.

Single instance per path via get_history_info_organizer_3(history_path). All code and comments in English.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from d3utils.history_indent_spec import parse_line_timestamp

# Entry start: 0 tabs + timestamp + INFO - then optional tab + "Session" or "Rift"
_ENTRY_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+INFO\s+-\s+\t?(Session|Rift)\s*$")
_TS_ONLY_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})")
# Success/Sucess + Duration (accept both spellings)
_SUCCESS_DURATION_RE = re.compile(r"(?:Success|Sucess)\s*:\s*(True|False)\s*\|?\s*Duration:\s*(\d{2}):(\d{2}):(\d{2})\.?\d*", re.IGNORECASE)
# X Earned: N
_EARNED_RE = re.compile(r"^\s*([A-Za-z0-9\s]+)\s+Earned:\s*(-?\d+)\s*$")
# Step name: * Invalid
_STEP_INVALID_RE = re.compile(r"^\s*(.+?)\s+Invalid\s*$")


def _leading_tabs(line: str) -> int:
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _parse_ts_from_line(line: str) -> Optional[float]:
    s = line.strip()
    m = _TS_ONLY_RE.match(s)
    if not m:
        return None
    ts_str = m.group(1)
    try:
        dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
        ms = int(ts_str[20:23]) if len(ts_str) >= 23 else 0
        return dt.timestamp() + ms / 1000.0
    except (ValueError, IndexError):
        return None


def _is_entry_start(line: str, n_tabs: int) -> Optional[Tuple[str, Optional[float]]]:
    """If line starts an entry (Session or Rift at 0 tabs with optional leading tab after INFO -). Returns (kind, ts_epoch) or None."""
    if n_tabs != 0:
        return None
    s = line.strip()
    m = _ENTRY_TS_RE.match(s)
    if m:
        ts_str = m.group(1)
        try:
            dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
            ms = int(ts_str[20:23]) if len(ts_str) >= 23 else 0
            return (m.group(2), dt.timestamp() + ms / 1000.0)
        except (ValueError, IndexError):
            return (m.group(2), None)
    return None


def _duration_seconds(h: int, m: int, s: int) -> int:
    return h * 3600 + m * 60 + s


# ---- First pass: boundaries only ----
@dataclass
class _Paragraph:
    indent: int  # 1, 2, or 3 (4-tab merged into 3)
    lines: List[str] = field(default_factory=list)


@dataclass
class _Entry:
    kind: str  # "Session" | "Rift"
    ts_epoch: Optional[float]
    paragraphs: List[_Paragraph] = field(default_factory=list)


def _first_pass_entries(lines: List[str]) -> List[_Entry]:
    """
    First pass: split into entries by 0-tab timestamp line; within each entry split into paragraphs by TAB.
    indent 4 is merged with previous 3-tab paragraph (fixed repeat, do not start new paragraph).
    """
    entries: List[_Entry] = []
    current_entry: Optional[_Entry] = None
    current_para: Optional[_Paragraph] = None
    for raw in lines:
        line = raw.rstrip("\n\r")
        if not line.strip():
            continue
        n_tabs = _leading_tabs(line)
        stripped = line.lstrip("\t").strip()
        if not stripped:
            continue
        entry_start = _is_entry_start(line, n_tabs)
        if entry_start is not None:
            kind, ts = entry_start
            if current_entry is not None and current_entry.paragraphs:
                entries.append(current_entry)
            current_entry = _Entry(kind=kind, ts_epoch=ts)
            current_para = None
            continue
        if current_entry is None:
            continue
        # Map indent: 4 -> treat as same as 3 (merge with previous 3-tab paragraph)
        para_indent = min(n_tabs, 3) if n_tabs >= 1 else n_tabs
        if current_para is None or current_para.indent != para_indent:
            current_para = _Paragraph(indent=para_indent)
            current_entry.paragraphs.append(current_para)
        current_para.lines.append(stripped)
    if current_entry is not None:
        entries.append(current_entry)
    return entries


# ---- Second pass: parse fields within paragraphs ----
@dataclass
class _ParsedBlock:
    success: Optional[bool] = None
    duration_seconds: int = 0
    earned: Dict[str, int] = field(default_factory=dict)


def _second_pass_parse_paragraph(para: _Paragraph) -> _ParsedBlock:
    """Second pass: extract Success/Sucess, Duration, and Earned from paragraph lines."""
    block = _ParsedBlock()
    for line in para.lines:
        m = _SUCCESS_DURATION_RE.search(line)
        if m:
            block.success = m.group(1).lower() == "true"
            h, mn, s = int(m.group(2)), int(m.group(3)), int(m.group(4))
            block.duration_seconds = _duration_seconds(h, mn, s)
            continue
        em = _EARNED_RE.match(line)
        if em:
            key = em.group(1).strip()
            val = int(em.group(2))
            block.earned[key] = val
    return block


def _aggregate_session_earned(entries: List[_Entry], start_epoch: float) -> Tuple[Dict[str, int], int, int, int, int]:
    """
    Find the last Session in the file; aggregate its earned and all Rifts after it that have ts >= start_epoch.
    Enhanced with baseline calculation: Keys Total = baseline (sum of Rift keys from Sessions before current) + current Session delta.
    - earned: Session-level (Rift keys only from indent 0) + sum of all Rifts in window
    - game_count: number of Rift entries in window (after last Session)
    - total_duration_seconds / last_run_duration_seconds: from Rifts in window
    - baseline_keys: sum of Rift keys from all Sessions before the current one (for Keys Total calculation)
    """
    earned: Dict[str, int] = {}
    game_count = 0
    total_duration_seconds = 0
    last_run_duration_seconds = 0
    baseline_keys = 0
    last_session: Optional[_Entry] = None
    last_session_idx = -1
    
    # Find last Session
    for idx, e in enumerate(entries):
        if e.kind == "Session":
            last_session = e
            last_session_idx = idx
    
    # Calculate baseline: sum Rift keys from all Sessions before last_session
    if last_session_idx >= 0:
        for prev_idx in range(last_session_idx):
            prev_e = entries[prev_idx]
            if prev_e.kind == "Session":
                for para in prev_e.paragraphs:
                    if para.indent == 0:
                        blk = _second_pass_parse_paragraph(para)
                        for k, v in blk.earned.items():
                            if k.replace(" ", "") == "Riftkeys":
                                baseline_keys += v
    
    if last_session is None:
        return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys
    
    # Parse current Session earned (Rift keys only from indent 0)
    session_earned: Dict[str, int] = {}
    for para in last_session.paragraphs:
        blk = _second_pass_parse_paragraph(para)
        for k, v in blk.earned.items():
            if k.replace(" ", "") == "Riftkeys":
                if para.indent == 0:
                    session_earned["Rift keys"] = session_earned.get("Rift keys", 0) + v
                continue
            session_earned[k] = session_earned.get(k, 0) + v
    
    earned = dict(session_earned)
    
    # Aggregate Rifts after last Session that are in time window
    for idx in range(last_session_idx + 1, len(entries)):
        e = entries[idx]
        if e.kind == "Rift" and e.ts_epoch is not None and e.ts_epoch >= start_epoch:
            game_count += 1
            for para in e.paragraphs:
                blk = _second_pass_parse_paragraph(para)
                for k, v in blk.earned.items():
                    earned[k] = earned.get(k, 0) + v
                if blk.duration_seconds:
                    total_duration_seconds += blk.duration_seconds
                    last_run_duration_seconds = blk.duration_seconds
    
    return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys


def _get_earned(earned: Dict[str, int], key: str, default: int = 0) -> int:
    key_flat = key.replace(" ", "")
    for k, v in earned.items():
        if k.replace(" ", "") == key_flat:
            return v
    return default


def _seconds_to_dd_hh_mm_ss(secs: int) -> str:
    secs = max(0, secs)
    d, r = divmod(secs, 86400)
    h, r = divmod(r, 3600)
    m, s = divmod(r, 60)
    return "%02d.%02d:%02d:%02d" % (d, h, m, s)


def _seconds_to_mm_ss(secs: int) -> str:
    secs = max(0, secs)
    m, s = divmod(secs, 60)
    return "%02d:%02d" % (m, s)


def _seconds_to_run_time(secs: int) -> str:
    secs = max(0, secs)
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    if h > 0:
        return "%02d:%02d:%02d" % (h, m, s)
    return "00:%02d:%02d" % (m, s)


def _fmt_xp(val: int) -> str:
    if val == 0:
        return "0"
    abs_v = abs(val)
    if abs_v >= 1e12:
        t = abs_v / 1e12
        return "%.3f T" % t if val >= 0 else "-%.3f T" % t
    b = abs_v / 1e9
    return "%.3f B" % b if val >= 0 else "-%.3f B" % b


def _earned_to_stats_lines(
    earned: Dict[str, int],
    game_count: int,
    total_duration_seconds: int,
    last_run_duration_seconds: int,
    boting_seconds: int,
    baseline_keys: int = 0,
) -> List[str]:
    """
    Format aggregated earned + counts into the 14 "Label: value" lines expected by compare.
    Enhanced: Keys Total = baseline_keys + current Session Rift keys delta.
    XP mapping: prefer "XP Earned" for Earned Xp, "RunXP Earned" for Run Xp, fallback to "SequenceXP Earned".
    boting_seconds: time since window start (e.g. mtime - window_start) for per-hour rates.
    """
    if boting_seconds < 1:
        boting_seconds = 1
    boting_dur = _seconds_to_dd_hh_mm_ss(boting_seconds)
    games_per_h = game_count * 3600.0 / boting_seconds
    run_dur = _seconds_to_mm_ss(last_run_duration_seconds)
    run_time_str = _seconds_to_run_time(last_run_duration_seconds)
    
    # Keys Total = baseline (from previous Sessions) + current Session delta
    current_keys_delta = _get_earned(earned, "Rift keys", 0)
    keys_total = baseline_keys + current_keys_delta
    keys_per_h = current_keys_delta * 3600.0 / boting_seconds if current_keys_delta else 0
    
    # XP mapping: "XP Earned" -> Earned Xp, "RunXP Earned" -> Run Xp, fallback to "SequenceXP Earned"
    xp_val = _get_earned(earned, "XP Earned", 0) or _get_earned(earned, "XP", 0) or _get_earned(earned, "SequenceXP Earned", 0)
    xp_str = _fmt_xp(xp_val)
    xp_per_h_str = _fmt_xp(int(xp_val * 3600.0 / boting_seconds)) if xp_val else "0"
    
    run_xp_val = _get_earned(earned, "RunXP Earned", 0) or _get_earned(earned, "RunXP", 0)
    run_xp_str = _fmt_xp(run_xp_val)
    run_xp_per_h_str = _fmt_xp(int(run_xp_val * 3600.0 / boting_seconds)) if run_xp_val else "0"
    
    distance_y = _get_earned(earned, "Distance Earned", 0) or _get_earned(earned, "Distance", 0)
    mi_per_h = distance_y * 3600.0 / boting_seconds / 1760 if boting_seconds and distance_y else 0
    shards = _get_earned(earned, "Shards Earned", 0) or _get_earned(earned, "Shards", 0)
    xp_pools = _get_earned(earned, "Xp Pools Earned", 0) or _get_earned(earned, "Xp Pools", 0)
    kept = _get_earned(earned, "KeptItems Earned", 0) or _get_earned(earned, "KeptItems", 0)
    looted = _get_earned(earned, "DroppedItems Earned", 0) or _get_earned(earned, "DroppedItems", 0)
    
    return [
        "Botting duration: %s day(s)" % boting_dur,
        "Game #: %s" % game_count,
        "Run time (per h): %s (%.2f/h)" % (run_time_str, games_per_h),
        "Run - Step: %s - 00:00" % run_dur,
        "Failed runs - Deaths: 0 - 0",
        "Keys Total/Looted: %s/0 %.2f/h" % (keys_total, keys_per_h),
        "Avg.Keys/Rift: - %sr 0gr" % game_count if game_count else "Avg.Keys/Rift: - 0r 0gr",
        "Shards earned: %s" % shards,
        "Earned Xp: %s (%s/h)" % (xp_str, xp_per_h_str),
        "Run Xp: %s (%s/h)" % (run_xp_str, run_xp_per_h_str),
        "Xp Pools: %s (0/h)" % xp_pools,
        "Legendaries Kept/Looted: %s/%s" % (kept, looted),
        "Distance: %sy (%.2fmi/h)" % (distance_y, mi_per_h),
        "Performance: 0/0",
    ]


def _read_history_lines_preserve_tabs(file_path: str, max_bytes: int = 0) -> List[str]:
    """Read history file; preserve leading TAB (rstrip only). Optional max_bytes from end for tail."""
    if not os.path.isfile(file_path):
        return []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            if max_bytes > 0:
                size = f.seek(0, 2)
                start = max(0, size - max_bytes)
                f.seek(start)
                if start > 0:
                    f.readline()
                raw = f.read()
            else:
                raw = f.read()
        return [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.strip()]
    except Exception:
        return []


def get_stats_lines_in_time_window(history_path: str, start_epoch: float, boting_seconds: int = 0) -> List[str]:
    """
    Two-pass parse history file; aggregate last Session in window [start_epoch, ...]; return 14 "Label: value" lines.
    Enhanced with baseline Keys Total calculation and improved XP field mapping.
    If boting_seconds <= 0, use (now - start_epoch) for per-hour rates.
    """
    lines = _read_history_lines_preserve_tabs(history_path)
    if not lines:
        return []
    entries = _first_pass_entries(lines)
    earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys = _aggregate_session_earned(
        entries, start_epoch
    )
    if not earned and game_count == 0:
        return []
    if boting_seconds <= 0:
        import time
        boting_seconds = max(1, int(time.time() - start_epoch))
    return _earned_to_stats_lines(
        earned,
        game_count,
        total_duration_seconds,
        last_run_duration_seconds,
        boting_seconds,
        baseline_keys,
    )


class HistoryInfoOrganizer3:
    """
    History organizer using two-pass parsing. Exposes same poll interface as LogInfoOrganizer
    for compare mode: poll_once_and_get_stats_lines() returns stats derived from history content.
    """

    def __init__(self, history_path: str) -> None:
        self._history_path = history_path
        self._last_position: int = 0

    def get_log_path(self) -> str:
        return self._history_path

    def seek_to_end(self) -> int:
        if not os.path.isfile(self._history_path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._history_path)
        except Exception:
            pass
        return self._last_position

    def poll_once_and_get_stats_lines(self, start_epoch: Optional[float] = None, boting_seconds: int = 0) -> List[str]:
        """
        One poll: two-pass parse history, aggregate last Session in time window, return 14 "Label: value" lines.
        If start_epoch is None, use 0 so all entries are in window.
        """
        if start_epoch is None:
            start_epoch = 0.0
        return get_stats_lines_in_time_window(self._history_path, start_epoch, boting_seconds)


_organizer3_cache: Dict[str, HistoryInfoOrganizer3] = {}


def get_history_info_organizer_3(history_path: str) -> HistoryInfoOrganizer3:
    """Return cached HistoryInfoOrganizer3 for history_path (singleton per path)."""
    if history_path not in _organizer3_cache:
        _organizer3_cache[history_path] = HistoryInfoOrganizer3(history_path)
    return _organizer3_cache[history_path]


def get_default_history_path() -> str:
    """Default history file path (fixed constant: history.txt)."""
    from providor.providor_index import HISTORY_FILE_PATH
    return HISTORY_FILE_PATH


__all__ = [
    "HistoryInfoOrganizer3",
    "get_history_info_organizer_3",
    "get_stats_lines_in_time_window",
    "get_default_history_path",
]
