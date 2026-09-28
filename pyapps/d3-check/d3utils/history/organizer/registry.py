#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Registry for history organizers - singleton management and default path.
"""
from __future__ import annotations

from typing import Dict

from d3utils.history.base import HistoryOrganizer
from d3utils.history.organizer.organizer_v1 import HistoryOrganizerV1
from d3utils.history.organizer.organizer_v2 import HistoryOrganizerV2
from d3utils.history.organizer.organizer_v3 import HistoryOrganizerV3
from d3utils.history.organizer.organizer_v4 import HistoryOrganizerV4
from d3utils.history.organizer.organizer_v5 import HistoryOrganizerV5
from d3utils.history.organizer.organizer_v6 import HistoryOrganizerV6
from d3utils.log_info_organizer import get_default_history_path as _get_default_history_path

# Cache: (history_path, version) -> organizer instance
_organizer_cache: Dict[tuple[str, str], HistoryOrganizer] = {}


def get_default_history_path() -> str:
    """Return default history file path."""
    return _get_default_history_path()


def get_history_organizer(
    history_path: str | None = None,
    version: str = "v1",
) -> HistoryOrganizer:
    """
    Get cached organizer instance for history_path and version.
    
    Args:
        history_path: Path to history file (default: get_default_history_path())
        version: Parser version ("v1", "v2", "v3", "v4", "v5", "v6")
    
    Returns:
        Cached HistoryOrganizer instance
    """
    if history_path is None:
        history_path = get_default_history_path()
    
    cache_key = (history_path, version)
    if cache_key not in _organizer_cache:
        organizer_class = {
            "v1": HistoryOrganizerV1,
            "v2": HistoryOrganizerV2,
            "v3": HistoryOrganizerV3,
            "v4": HistoryOrganizerV4,
            "v5": HistoryOrganizerV5,
            "v6": HistoryOrganizerV6,
        }.get(version, HistoryOrganizerV1)
        _organizer_cache[cache_key] = organizer_class(history_path)
    
    return _organizer_cache[cache_key]
