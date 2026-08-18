# -*- coding: utf-8 -*-
"""Shared facade for the central distributed-task history contract.

The values and matching rules live only in ``config/queue_center_contract.json``.
Keep callers importing this module; it delegates to ``queue_center_contract.py``
so Pycore, Laravel, Laravel-manager, Pycore UI, and mcp-chrome change together.
"""

from typing import Dict

from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_HISTORY_BUCKETS,
    normalize_task_history_type,
)


CANONICAL_TASK_TYPES = GLOBAL_TASK_HISTORY_BUCKETS


def normalize_task_type(raw_task_type: object) -> str:
    """
    Canonicalize task type values used by queue and history contracts.

    Returns one of:
      - word_audio
      - sentence_audio
      - translation
      - media_image
      - assist (fallback for all non-mapped legacy labels)
    """
    return normalize_task_history_type(raw_task_type)


def match_task_type(raw_task_type: object, requested_task_type: object) -> bool:
    """Compare task types with canonical fallback for backward-compatible legacy values."""
    if requested_task_type is None:
        return True
    requested_text = str(requested_task_type).strip().lower()
    if not requested_text:
        return True
    canonical_requested = normalize_task_type(requested_text)
    if canonical_requested in CANONICAL_TASK_TYPES:
        return normalize_task_type(raw_task_type) == canonical_requested
    return str(raw_task_type).strip().lower() == requested_text


def aggregate_task_counts(raw_types: Dict[str, int] | None) -> Dict[str, int]:
    """Aggregate a raw type->count map into canonical task-type buckets."""
    counts = {name: 0 for name in CANONICAL_TASK_TYPES}
    if not raw_types:
        return counts
    for raw_task_type, count in raw_types.items():
        try:
            bucket = normalize_task_type(raw_task_type)
            value = int(count) if isinstance(count, bool) or isinstance(count, (int, float)) else 0
        except Exception:
            bucket = "assist"
            value = 0
        counts[bucket] += value
    return counts
