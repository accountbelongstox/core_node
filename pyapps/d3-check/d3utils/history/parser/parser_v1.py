#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V1: TAB + content_indent stack (uses rosbot_history_parser).

Based on history_info_organizer_1.py, uses rosbot_history_parser.Block structure.
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser
from d3utils.rosbot_history_parser import Block, parse_history_lines


class HistoryParserV1(HistoryParser):
    """Parser V1: Uses rosbot_history_parser for TAB + content_indent parsing."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines into blocks using rosbot_history_parser.
        
        Converts Block objects to dict format for consistency.
        """
        roots = parse_history_lines(lines)
        blocks: List[Dict[str, Any]] = []
        
        for root in roots:
            block_dict: Dict[str, Any] = {
                "head_time": root.entry_ts if hasattr(root, "entry_ts") else None,
                "head_kind": root.kind,
                "earned": dict(root.earned),
            }
            blocks.append(block_dict)
        
        return blocks
