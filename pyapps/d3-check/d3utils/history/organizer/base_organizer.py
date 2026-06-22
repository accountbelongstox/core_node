#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base organizer implementation with common functionality.
"""
from __future__ import annotations

import os
from typing import List, Optional, Tuple

from d3utils.history.base import HistoryOrganizer


class HistoryOrganizerBase(HistoryOrganizer):
    """Base implementation with common file reading and position tracking."""
    
    def __init__(self, history_path: str) -> None:
        self._path = history_path
        self._last_position: int = 0
    
    def get_log_path(self) -> str:
        """Return the history file path."""
        return self._path
    
    def seek_to_end(self) -> int:
        """Seek to end of file, return current position."""
        if not os.path.isfile(self._path):
            return self._last_position
        try:
            self._last_position = os.path.getsize(self._path)
        except OSError:
            pass
        return self._last_position
    
    def read_new_lines(self) -> Tuple[int, List[str]]:
        """
        Read new lines since last position.
        
        Lines are rstrip('\n\r') only, preserving leading TAB.
        """
        if not os.path.isfile(self._path):
            return self._last_position, []
        try:
            with open(self._path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._last_position)
                raw = f.read()
                self._last_position = f.tell()
        except OSError:
            return self._last_position, []
        lines = [ln.rstrip("\n\r") for ln in raw.splitlines() if ln.rstrip("\n\r").strip()]
        return self._last_position, lines
    
    def get_latest_stats_as_lines(self, min_entry_ts: Optional[float] = None) -> List[str]:
        """
        Get latest stats as "Label: value" lines.
        
        Subclasses should override this method.
        """
        raise NotImplementedError("Subclasses must implement get_latest_stats_as_lines")
    
    def poll_once_and_get_stats_lines(self) -> List[str]:
        """Poll once and return stats lines."""
        return self.get_latest_stats_as_lines()
