#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V6: Multi-level indent (simplified).

Based on history_info_organizer_6.py.
Uses indent_key_to_level_history for multi-level structure.
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser
from d3utils.history_info_organizer_6 import _build_blocks_approach6


class HistoryParserV6(HistoryParser):
    """Parser V6: Multi-level indent using indent_key_to_level_history."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines using approach6 block building logic.
        
        Delegates to _build_blocks_approach6 for implementation.
        """
        return _build_blocks_approach6(lines, max_lines=max_lines)
