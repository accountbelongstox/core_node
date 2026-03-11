#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Organizer V1: Uses parser V1 (rosbot_history_parser) + aggregator + formatter.
"""
from __future__ import annotations

import os
import time
from typing import List, Optional

from d3utils.history.aggregator.time_window_aggregator import TimeWindowAggregator
from d3utils.history.formatter.stats_formatter import HistoryStatsFormatter
from d3utils.history.organizer.base_organizer import HistoryOrganizerBase
from d3utils.history.parser.parser_v1 import HistoryParserV1


class HistoryOrganizerV1(HistoryOrganizerBase):
    """Organizer V1: TAB + content_indent parser with time window aggregation."""
    
    def __init__(self, history_path: str) -> None:
        super().__init__(history_path)
        self._parser = HistoryParserV1()
        self._aggregator = TimeWindowAggregator()
        self._formatter = HistoryStatsFormatter()
    
    def get_latest_stats_as_lines(self, min_entry_ts: Optional[float] = None) -> List[str]:
        """Get latest stats, optionally filtered by time window."""
        if not os.path.isfile(self._path):
            return []
        
        # Read tail chunk for efficiency (from approach1)
        tail_chunk_bytes = 2 * 1024 * 1024  # 2 MB
        lines: List[str] = []
        try:
            size = os.path.getsize(self._path)
            chunk = min(size, tail_chunk_bytes)
            with open(self._path, "r", encoding="utf-8", errors="ignore") as f:
                if size <= chunk:
                    raw = f.read()
                else:
                    f.seek(size - chunk)
                    f.readline()  # drop partial line
                    raw = f.read()
            lines = [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.strip()]
        except OSError:
            return []
        
        blocks = self._parser.parse_lines(lines)
        if not blocks:
            return []
        
        if min_entry_ts is None:
            # Return last block's earned
            last_block = blocks[-1]
            earned = last_block.get("earned", {})
            return [f"{k}: {v}" for k, v in sorted(earned.items())]
        
        # For time window, need full file
        full_lines: List[str] = []
        try:
            with open(self._path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    full_lines.append(line.rstrip("\n\r"))
        except OSError:
            return []
        
        full_blocks = self._parser.parse_lines(full_lines)
        earned, game_count, total_duration, last_run_duration, baseline_keys = (
            self._aggregator.aggregate(full_blocks, min_entry_ts)
        )
        
        if not earned and game_count == 0:
            return []
        
        boting_seconds = max(1, int(time.time() - min_entry_ts))
        return self._formatter.format_stats_lines(
            earned, game_count, last_run_duration, boting_seconds, baseline_keys
        )
