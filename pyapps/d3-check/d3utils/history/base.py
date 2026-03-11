#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base interfaces and abstract classes for history processing.

Defines the contract for parsers, aggregators, formatters, and organizers.
All code and comments in English.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

# Common types
EarnedDict = Dict[str, int]
BlockDict = Dict[str, Any]  # head_time, head_kind, earned, etc.


class HistoryParser(ABC):
    """Abstract base class for history file parsers."""
    
    @abstractmethod
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[BlockDict]:
        """
        Parse lines into structured blocks.
        
        Args:
            lines: List of lines (with leading TAB preserved)
            max_lines: Maximum lines to parse (0 = all)
        
        Returns:
            List of block dicts, each with at least: head_time, head_kind, earned
        """
        pass


class HistoryAggregator(ABC):
    """Abstract base class for aggregating blocks."""
    
    @abstractmethod
    def aggregate(
        self,
        blocks: List[BlockDict],
        start_epoch: float,
    ) -> Tuple[EarnedDict, int, int, int, int]:
        """
        Aggregate blocks in time window.
        
        Args:
            blocks: List of parsed blocks
            start_epoch: Start timestamp (epoch seconds)
        
        Returns:
            (earned_dict, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys)
        """
        pass


class HistoryFormatter(ABC):
    """Abstract base class for formatting aggregated data."""
    
    @abstractmethod
    def format_stats_lines(
        self,
        earned: EarnedDict,
        game_count: int,
        last_run_duration_seconds: int,
        boting_seconds: int,
        baseline_keys: int = 0,
    ) -> List[str]:
        """
        Format aggregated data into "Label: value" lines.
        
        Args:
            earned: Aggregated earned dict
            game_count: Number of games/rifts
            last_run_duration_seconds: Duration of last run
            boting_seconds: Time window duration for per-hour rates
            baseline_keys: Baseline keys from previous sessions
        
        Returns:
            List of "Label: value" lines
        """
        pass


class HistoryOrganizer(ABC):
    """Abstract base class for history organizers (high-level interface)."""
    
    @abstractmethod
    def get_log_path(self) -> str:
        """Return the history file path."""
        pass
    
    @abstractmethod
    def seek_to_end(self) -> int:
        """Seek to end of file, return current position."""
        pass
    
    @abstractmethod
    def read_new_lines(self) -> Tuple[int, List[str]]:
        """Read new lines since last position. Returns (position, lines)."""
        pass
    
    @abstractmethod
    def get_latest_stats_as_lines(self, min_entry_ts: Optional[float] = None) -> List[str]:
        """
        Get latest stats as "Label: value" lines.
        
        Args:
            min_entry_ts: Optional minimum entry timestamp (for time window)
        
        Returns:
            List of "Label: value" lines
        """
        pass
    
    @abstractmethod
    def poll_once_and_get_stats_lines(self) -> List[str]:
        """Poll once and return stats lines (same as get_latest_stats_as_lines)."""
        pass
