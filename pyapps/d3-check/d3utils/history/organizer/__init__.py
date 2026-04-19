#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History organizers - high-level interface combining parser + aggregator + formatter.
"""
from __future__ import annotations

from d3utils.history.organizer.base_organizer import HistoryOrganizerBase
from d3utils.history.organizer.organizer_v1 import HistoryOrganizerV1
from d3utils.history.organizer.organizer_v2 import HistoryOrganizerV2
from d3utils.history.organizer.organizer_v3 import HistoryOrganizerV3
from d3utils.history.organizer.organizer_v4 import HistoryOrganizerV4
from d3utils.history.organizer.organizer_v5 import HistoryOrganizerV5
from d3utils.history.organizer.organizer_v6 import HistoryOrganizerV6
from d3utils.history.organizer.registry import (
    get_default_history_path,
    get_history_organizer,
)

__all__ = [
    "HistoryOrganizerBase",
    "HistoryOrganizerV1",
    "HistoryOrganizerV2",
    "HistoryOrganizerV3",
    "HistoryOrganizerV4",
    "HistoryOrganizerV5",
    "HistoryOrganizerV6",
    "get_default_history_path",
    "get_history_organizer",
]
