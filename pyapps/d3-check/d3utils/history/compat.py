#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compatibility layer for existing code using old history_info_organizer interfaces.

Provides backward-compatible functions that delegate to new architecture.
"""
from __future__ import annotations

from typing import List

from d3utils.history.organizer.registry import (
    get_default_history_path,
    get_history_organizer,
)
from d3utils.history.base import HistoryOrganizer


# Backward compatibility: expose old function names
def get_history_info_organizer(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v1 (default)."""
    return get_history_organizer(history_path, version="v1")


def get_history_info_organizer_1(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v1."""
    return get_history_organizer(history_path, version="v1")


def get_history_info_organizer_3(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v3."""
    return get_history_organizer(history_path, version="v3")


def get_history_info_organizer_6(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v6."""
    return get_history_organizer(history_path, version="v6")


def get_history_info_organizer_approach2(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v2."""
    return get_history_organizer(history_path, version="v2")


def get_history_info_organizer_approach4(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v4."""
    return get_history_organizer(history_path, version="v4")


def get_history_info_organizer_approach5(history_path: str) -> HistoryOrganizer:
    """Backward compatibility: returns organizer v5."""
    return get_history_organizer(history_path, version="v5")


# Backward compatibility: stats lines functions
def get_stats_lines_in_time_window_organizer1(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v1."""
    org = get_history_organizer(history_path, version="v1")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_approach3(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v3."""
    org = get_history_organizer(history_path, version="v3")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_approach6(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v6."""
    org = get_history_organizer(history_path, version="v6")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_approach2(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v2."""
    org = get_history_organizer(history_path, version="v2")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_approach4(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v4."""
    org = get_history_organizer(history_path, version="v4")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_stats_lines_in_time_window_approach5(
    history_path: str, start_epoch: float, boting_seconds: int = 0
) -> List[str]:
    """Backward compatibility: get stats lines in time window using v5."""
    org = get_history_organizer(history_path, version="v5")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


# Backward compatibility: last block earned functions
def get_last_block_earned_in_time_window_approach2(
    history_path: str, start_epoch: float
) -> dict:
    """Backward compatibility: get last block earned in time window using v2."""
    from d3utils.history.parser.parser_v2 import HistoryParserV2
    from d3utils.history.aggregator.time_window_aggregator import TimeWindowAggregator
    
    parser = HistoryParserV2()
    aggregator = TimeWindowAggregator()
    
    # Read file
    import os
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    
    blocks = parser.parse_lines(lines)
    if not blocks:
        return {}
    
    # Find last block in time window
    for i in range(len(blocks) - 1, -1, -1):
        block = blocks[i]
        head_time = block.get("head_time")
        if head_time is not None and head_time >= start_epoch:
            return block.get("earned", {})
    
    return {}


def get_block_earned_at_timestamp(
    history_path: str, target_timestamp: float, tolerance_seconds: float = 1.0
) -> dict:
    """Backward compatibility: get block earned at specific timestamp."""
    from d3utils.history.parser.parser_v2 import HistoryParserV2
    
    parser = HistoryParserV2()
    
    # Read file
    import os
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    
    blocks = parser.parse_lines(lines)
    
    # Find block with matching timestamp
    for block in blocks:
        t = block.get("head_time")
        if t is not None and abs(t - target_timestamp) < tolerance_seconds:
            return block.get("earned", {})
    
    return {}


def get_last_entry_earned_in_time_window_approach5(
    history_path: str, start_epoch: float
) -> dict:
    """Backward compatibility: get last entry earned in time window using v5."""
    from d3utils.history.parser.parser_v5 import HistoryParserV5
    
    parser = HistoryParserV5()
    
    # Read file
    import os
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    
    blocks = parser.parse_lines(lines)
    if not blocks:
        return {}
    
    # Find last block in time window
    for i in range(len(blocks) - 1, -1, -1):
        block = blocks[i]
        head_time = block.get("head_time")
        if head_time is not None and head_time >= start_epoch:
            return block.get("earned", {})
    
    return {}


def get_last_block_earned_in_time_window_approach4(
    history_path: str, start_epoch: float
) -> dict:
    """Backward compatibility: get last block earned in time window using v4."""
    from d3utils.history.parser.parser_v4 import HistoryParserV4
    
    parser = HistoryParserV4()
    
    # Read file
    import os
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return {}
    
    blocks = parser.parse_lines(lines)
    if not blocks:
        return {}
    
    # Find last block in time window
    for i in range(len(blocks) - 1, -1, -1):
        block = blocks[i]
        head_time = block.get("head_time")
        if head_time is not None and head_time >= start_epoch:
            return block.get("earned", {})
    
    return {}


def get_latest_stats_as_lines_in_time_window(
    history_path: str, start_epoch: float
) -> List[str]:
    """Backward compatibility: get latest stats in time window using v1."""
    org = get_history_organizer(history_path, version="v1")
    return org.get_latest_stats_as_lines(min_entry_ts=start_epoch)


def get_latest_stats_as_lines_approach5(history_path: str) -> List[str]:
    """Backward compatibility: get latest stats using v5."""
    org = get_history_organizer(history_path, version="v5")
    return org.get_latest_stats_as_lines()


def get_latest_earned_as_lines(history_path: str) -> List[str]:
    """Backward compatibility: get latest earned as lines using v4."""
    org = get_history_organizer(history_path, version="v4")
    return org.get_latest_stats_as_lines()


def earned_to_label_value_lines(earned: dict) -> List[str]:
    """Backward compatibility: convert earned dict to label:value lines."""
    return [f"{k}: {v}" for k, v in sorted(earned.items())]


def get_riftrun_entries(history_path: str, max_lines: int = 0):
    """Backward compatibility: get rift/run entries using v5 parser."""
    from d3utils.history.parser.parser_v5 import HistoryParserV5
    from d3utils.history_info_organizer_approach5 import EntryNode
    
    parser = HistoryParserV5()
    
    # Read file
    import os
    lines: List[str] = []
    try:
        with open(history_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                lines.append(line.rstrip("\n\r"))
    except OSError:
        return []
    
    # Use v5's internal parsing to get EntryNode objects
    from d3utils.history_info_organizer_approach5 import _parse_lines_to_entries
    return _parse_lines_to_entries(lines)


def _earned_to_stats_lines(earned: dict) -> List[str]:
    """Backward compatibility: convert earned dict to stats lines."""
    from d3utils.history_info_organizer_approach2 import _earned_to_stats_lines as _impl
    return _impl(earned)


def parse_stats_line(line: str) -> List[str]:
    """Backward compatibility: parse stats line (not used for history.txt)."""
    # history.txt doesn't use single-line stats format
    return []
