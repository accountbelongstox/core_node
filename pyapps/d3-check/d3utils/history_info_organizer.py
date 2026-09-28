#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Info Organizer library.
History file (history.txt) is distinct from the other file logs.txt. Single instance per path
via get_history_info_organizer(history_path); do not construct directly.

Delegates to log_info_organizer (LogInfoOrganizer / get_log_info_organizer); exposes
history naming and get_default_history_path (fixed constant).
"""
from __future__ import annotations

from typing import List

from d3utils.log_info_organizer import (
    LogInfoOrganizer,
    get_default_history_path as _get_default_history_path,
    get_log_info_organizer,
    parse_stats_line,
)

HistoryInfoOrganizer = LogInfoOrganizer


def get_history_info_organizer(history_path: str) -> HistoryInfoOrganizer:
    """Return cached HistoryInfoOrganizer for history_path (singleton per path)."""
    return get_log_info_organizer(history_path)


def get_default_history_path() -> str:
    """Default history file path (fixed constant: history.txt)."""
    return _get_default_history_path()


__all__ = [
    "HistoryInfoOrganizer",
    "get_history_info_organizer",
    "get_default_history_path",
    "parse_stats_line",
]
