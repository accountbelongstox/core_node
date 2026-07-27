# -*- coding: utf-8 -*-
"""Shared task-type normalization helpers for queue-center and task-history contracts."""

from typing import Dict


CANONICAL_TASK_TYPES = (
    "word_audio",
    "sentence_audio",
    "translation",
    "assist",
    "media_image",
)


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
    if raw_task_type is None:
        return "assist"
    task_type = str(raw_task_type).strip().lower()
    if not task_type:
        return "assist"
    if task_type in CANONICAL_TASK_TYPES:
        return task_type

    if task_type in {"word_translation", "prompt_translation", "google_translate", "word-translation"}:
        return "translation"
    if "word_audio" in task_type or ("word" in task_type and ("tts" in task_type or "audio" in task_type)):
        return "word_audio"
    if "sentence_audio" in task_type or (
        "sentence" in task_type
        and ("tts" in task_type or "audio" in task_type or "prompt" in task_type)
    ):
        return "sentence_audio"
    if "word_translation" in task_type or "ai_translate" in task_type or "translation" in task_type or "prompt_translation" in task_type:
        return "translation"
    if any(token in task_type for token in ("media", "image", "cover", "poster", "screenshot", "book")):
        return "media_image"
    if "word_media" in task_type:
        return "media_image"

    return "assist"


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
