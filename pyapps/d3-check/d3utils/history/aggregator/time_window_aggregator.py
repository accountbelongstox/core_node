#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Time window aggregator - aggregates blocks in a time window.

Finds last Session, aggregates its earned + all Rifts after it in time window.
Handles baseline keys calculation from previous Sessions.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from d3utils.history.base import HistoryAggregator


class TimeWindowAggregator(HistoryAggregator):
    """
    Aggregates blocks in time window [start_epoch, ...].
    
    Strategy:
    1. Find last Session block
    2. Calculate baseline keys from Sessions before last Session
    3. Aggregate last Session's earned (Rift keys only from indent 0)
    4. Aggregate all Rift blocks after last Session that are in time window
    5. Return aggregated earned, game_count, durations, baseline_keys
    """
    
    def aggregate(
        self,
        blocks: List[Dict[str, Any]],
        start_epoch: float,
    ) -> Tuple[Dict[str, int], int, int, int, int]:
        """
        Aggregate blocks in time window.
        
        Args:
            blocks: List of parsed blocks (each has head_time, head_kind, earned)
            start_epoch: Start timestamp (epoch seconds)
        
        Returns:
            (earned_dict, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys)
        """
        earned: Dict[str, int] = {}
        game_count = 0
        total_duration_seconds = 0
        last_run_duration_seconds = 0
        baseline_keys = 0
        
        # Find last Session
        last_session_idx = -1
        for i, block in enumerate(blocks):
            if block.get("head_kind") == "Session":
                last_session_idx = i
        
        # Calculate baseline keys from Sessions before last Session
        if last_session_idx >= 0:
            for i in range(last_session_idx):
                if blocks[i].get("head_kind") == "Session":
                    block_earned = blocks[i].get("earned", {})
                    # Normalize key names (handle both "Rift keys" and "Rift keys Earned")
                    for k, v in block_earned.items():
                        k_flat = k.replace(" ", "").replace("Earned", "").strip()
                        if k_flat == "Riftkeys":
                            baseline_keys += v
        
        # Aggregate last Session earned
        if last_session_idx >= 0:
            session_earned = blocks[last_session_idx].get("earned", {})
            for k, v in session_earned.items():
                earned[k] = earned.get(k, 0) + v
        
        # Aggregate Rifts after last Session in time window
        start_idx = last_session_idx + 1 if last_session_idx >= 0 else 0
        for i in range(start_idx, len(blocks)):
            block = blocks[i]
            if block.get("head_kind") != "Rift":
                continue
            head_time = block.get("head_time")
            if head_time is None or head_time < start_epoch:
                continue
            
            game_count += 1
            block_earned = block.get("earned", {})
            for k, v in block_earned.items():
                earned[k] = earned.get(k, 0) + v
            
            # Extract duration if available
            duration_seconds = block.get("duration_seconds", 0)
            if duration_seconds:
                total_duration_seconds += duration_seconds
                last_run_duration_seconds = duration_seconds
        
        return earned, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys
