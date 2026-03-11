#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V2: Multi-level indent with enhancements (based on approach2).

Implements Approach B from HistoryReader.md with enhancements:
- Multi-level tab: level = n_tabs (0,1,2,3); tabs=4 treated as repeat
- Block stack: pop until top < current indent
- Earned lines attributed using content_indent rules
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser
from d3utils.history_info_organizer_approach2 import _build_blocks_approach2


class HistoryParserV2(HistoryParser):
    """Parser V2: Multi-level indent with content_indent rules."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines into blocks using approach2 logic.
        
        Delegates to _build_blocks_approach2 for implementation.
        """
        return _build_blocks_approach2(lines, max_lines=max_lines)
