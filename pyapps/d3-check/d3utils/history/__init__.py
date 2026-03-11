#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History file processing library - unified interface.

This module provides a clean, layered architecture for parsing, aggregating,
and formatting history.txt files from RoS-BoT.

Architecture:
- parser/: Parsing strategies (v1-v6) for converting raw lines to structured blocks
- aggregator/: Aggregation strategies for combining blocks (time window, block-level)
- formatter/: Formatting strategies for converting data to output lines
- organizer/: High-level organizers that combine parser + aggregator + formatter

All code and comments in English.
"""
from __future__ import annotations

from d3utils.history.organizer import (
    get_default_history_path,
    get_history_organizer,
    HistoryOrganizer,
)

__all__ = [
    "get_default_history_path",
    "get_history_organizer",
    "HistoryOrganizer",
]
