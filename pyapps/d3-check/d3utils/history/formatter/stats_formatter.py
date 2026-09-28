#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stats formatter - formats aggregated earned data into 14 "Label: value" lines.

Reuses logic from history_stats_formatter.py but implements HistoryFormatter interface.
"""
from __future__ import annotations

from typing import Dict, List

from d3utils.history.base import HistoryFormatter
from d3utils.history_stats_formatter import format_stats_lines_from_earned


class HistoryStatsFormatter(HistoryFormatter):
    """Formatter that produces 14-line stats format compatible with APPROXIMATE_STATS_LINES."""
    
    def format_stats_lines(
        self,
        earned: Dict[str, int],
        game_count: int,
        last_run_duration_seconds: int,
        boting_seconds: int,
        baseline_keys: int = 0,
    ) -> List[str]:
        """
        Format aggregated data into 14 "Label: value" lines.
        
        Delegates to format_stats_lines_from_earned for consistency with existing code.
        """
        return format_stats_lines_from_earned(
            earned,
            game_count,
            last_run_duration_seconds,
            boting_seconds,
            baseline_keys,
        )
