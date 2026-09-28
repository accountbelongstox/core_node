#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser V4: State machine with line type classification.

Based on history_info_organizer_approach4.py.
Uses state machine to classify lines and build block tree.
"""
from __future__ import annotations

from typing import Any, Dict, List

from d3utils.history.base import HistoryParser
from d3utils.history_info_organizer_approach4 import Block4, parse_history_lines_state_machine


class HistoryParserV4(HistoryParser):
    """Parser V4: State machine with line type classification."""
    
    def parse_lines(self, lines: List[str], max_lines: int = 0) -> List[Dict[str, Any]]:
        """
        Parse lines using state machine approach.
        
        Converts Block4 tree to flat list of blocks.
        """
        roots = parse_history_lines_state_machine(lines)
        blocks: List[Dict[str, Any]] = []
        
        for root in roots:
            ts_epoch = root.ts.timestamp() if root.ts else None
            block_dict: Dict[str, Any] = {
                "head_time": ts_epoch,
                "head_kind": root.kind,
                "earned": dict(root.earned),
            }
            blocks.append(block_dict)
        
        return blocks
