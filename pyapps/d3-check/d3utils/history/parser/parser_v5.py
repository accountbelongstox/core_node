#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V5: Regex + indent stack.

Based on history_info_organizer_approach5.py.
Uses regex patterns for line classification and indent stack for hierarchy.
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser
from d3utils.history_info_organizer_approach5 import EntryNode, get_riftrun_entries


class HistoryParserV5(HistoryParser):
    """Parser V5: Regex + indent stack."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines using regex + indent stack approach.
        
        Note: get_riftrun_entries expects file path, so we need to adapt.
        For now, we'll parse from lines directly using the internal function.
        """
        # Import internal parsing function
        from d3utils.history_info_organizer_approach5 import _parse_lines_to_entries
        
        entries = _parse_lines_to_entries(lines)
        blocks: List[Dict[str, Any]] = []
        
        for entry in entries:
            block_dict: Dict[str, Any] = {
                "head_time": entry.timestamp_epoch,
                "head_kind": entry.kind,
                "earned": dict(entry.earned),
            }
            blocks.append(block_dict)
        
        return blocks
