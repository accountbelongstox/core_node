#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V3: Two-pass parsing (boundaries then fields).

Based on history_info_organizer_3.py.
First pass: entry/paragraph boundaries only
Second pass: parse fields within paragraphs
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser

# Import internal functions from history_info_organizer_3
try:
    from d3utils.history_info_organizer_3 import _first_pass_entries, _second_pass_parse_paragraph
except ImportError:
    # Fallback: define minimal implementation if import fails
    def _first_pass_entries(lines):
        return []
    def _second_pass_parse_paragraph(para):
        class ParsedBlock:
            earned = {}
        return ParsedBlock()


class HistoryParserV3(HistoryParser):
    """Parser V3: Two-pass parsing approach."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines using two-pass approach.
        
        First pass: identify entry boundaries
        Second pass: parse fields within each entry
        """
        entries = _first_pass_entries(lines)
        blocks: List[Dict[str, Any]] = []
        
        for entry in entries:
            earned: Dict[str, int] = {}
            for para in entry.paragraphs:
                parsed = _second_pass_parse_paragraph(para)
                for k, v in parsed.earned.items():
                    earned[k] = earned.get(k, 0) + v
            
            block_dict: Dict[str, Any] = {
                "head_time": entry.ts_epoch,
                "head_kind": entry.kind,
                "earned": earned,
            }
            blocks.append(block_dict)
        
        return blocks
