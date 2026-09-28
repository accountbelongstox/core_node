#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Common formatting functions for history stats lines.

Shared by multiple approaches (approach3, approach4, etc.) to format earned data
into "Label: value" lines compatible with parse_stats_line output.
All code and comments in English.
"""
from __future__ import annotations

from typing import Dict


def _get_earned(earned: Dict[str, int], key: str, default: int = 0) -> int:
    """Get value by key with space-normalized match."""
    key_flat = key.replace(" ", "").replace("Earned", "").strip()
    for k, v in earned.items():
        k_flat = k.replace(" ", "").replace("Earned", "").strip()
        if k_flat == key_flat:
            return v
    return default


def _seconds_to_dd_hh_mm_ss(secs: int) -> str:
    """Format seconds as DD.HH:MM:SS."""
    secs = max(0, secs)
    d, r = divmod(secs, 86400)
    h, r = divmod(r, 3600)
    m, s = divmod(r, 60)
    return "%02d.%02d:%02d:%02d" % (d, h, m, s)


def _seconds_to_mm_ss(secs: int) -> str:
    """Format seconds as MM:SS."""
    secs = max(0, secs)
    m, s = divmod(secs, 60)
    return "%02d:%02d" % (m, s)


def _seconds_to_run_time(secs: int) -> str:
    """Format seconds as HH:MM:SS or MM:SS."""
    secs = max(0, secs)
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    if h > 0:
        return "%02d:%02d:%02d" % (h, m, s)
    return "00:%02d:%02d" % (m, s)


def _fmt_xp(val: int) -> str:
    """Format XP value as B (billions) or T (trillions)."""
    if val == 0:
        return "0"
    abs_v = abs(val)
    if abs_v >= 1e12:
        t = abs_v / 1e12
        return "%.3f T" % t if val >= 0 else "-%.3f T" % t
    b = abs_v / 1e9
    return "%.3f B" % b if val >= 0 else "-%.3f B" % b


def _parse_duration_to_seconds(duration_str: str) -> int:
    """Parse duration string (HH:MM:SS.ffffff) to seconds."""
    if not duration_str:
        return 0
    parts = duration_str.split(":")
    if len(parts) != 3:
        return 0
    try:
        h = int(parts[0])
        m = int(parts[1])
        s_parts = parts[2].split(".")
        s = int(s_parts[0])
        return h * 3600 + m * 60 + s
    except (ValueError, IndexError):
        return 0


def format_stats_lines_from_earned(
    earned: Dict[str, int],
    game_count: int,
    last_run_duration_seconds: int,
    boting_seconds: int,
    baseline_keys: int = 0,
) -> list[str]:
    """
    Format aggregated earned + counts into the 14 "Label: value" lines expected by compare.
    
    Args:
        earned: Aggregated earned dict
        game_count: Number of Rift entries
        last_run_duration_seconds: Duration of last run in seconds
        boting_seconds: Time window duration for per-hour rates
        baseline_keys: Baseline Rift keys from previous Sessions (for Keys Total)
    
    Returns:
        List of 14 "Label: value" lines matching APPROXIMATE_STATS_LINES format.
    """
    if boting_seconds < 1:
        boting_seconds = 1
    boting_dur = _seconds_to_dd_hh_mm_ss(boting_seconds)
    games_per_h = game_count * 3600.0 / boting_seconds if boting_seconds else 0
    run_dur = _seconds_to_mm_ss(last_run_duration_seconds)
    run_time_str = _seconds_to_run_time(last_run_duration_seconds)
    
    # Keys Total = baseline (from previous Sessions) + current Session delta
    current_keys_delta = _get_earned(earned, "Rift keys", 0)
    keys_total = baseline_keys + current_keys_delta
    keys_per_h = current_keys_delta * 3600.0 / boting_seconds if current_keys_delta and boting_seconds else 0
    
    # XP mapping: "XP Earned" -> Earned Xp, "RunXP Earned" -> Run Xp
    xp_val = _get_earned(earned, "XP Earned", 0) or _get_earned(earned, "XP", 0) or _get_earned(earned, "SequenceXP Earned", 0)
    xp_str = _fmt_xp(xp_val)
    xp_per_h_str = _fmt_xp(int(xp_val * 3600.0 / boting_seconds)) if xp_val and boting_seconds else "0"
    
    run_xp_val = _get_earned(earned, "RunXP Earned", 0) or _get_earned(earned, "RunXP", 0)
    run_xp_str = _fmt_xp(run_xp_val)
    run_xp_per_h_str = _fmt_xp(int(run_xp_val * 3600.0 / boting_seconds)) if run_xp_val and boting_seconds else "0"
    
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


__all__ = [
    "format_stats_lines_from_earned",
    "_parse_duration_to_seconds",
    "_get_earned",
]
