# -*- coding: utf-8 -*-
"""Shared Books filter normalization and drill-down query helpers."""

from typing import List, Optional


def normalize_formats(formats: Optional[List[str]]) -> Optional[set]:
    """Normalize format names to lower-case dotted extensions."""
    if not formats:
        return None
    normalized = set()
    for value in formats:
        extension = (value or "").strip().lower()
        if not extension:
            continue
        normalized.add(extension if extension.startswith(".") else f".{extension}")
    return normalized or None


def apply_query(
    items: List[dict],
    query: Optional[str],
    text_key: str = "text",
) -> List[dict]:
    """Filter list records by one case-insensitive text field."""
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return items
    return [
        row
        for row in items
        if normalized_query in str(row.get(text_key) or "").lower()
    ]


def apply_slot_query(
    slots: List[dict],
    query: Optional[str],
    view_language: Optional[str] = None,
) -> List[dict]:
    """Filter correspondence slots and optionally project one language."""
    normalized_query = (query or "").strip().lower()
    language = (view_language or "").strip().lower()
    filtered = []
    for slot in slots:
        languages = slot.get("langs") or {}
        if language:
            text = languages.get(language)
            if not text or not str(text).strip():
                continue
            if normalized_query and normalized_query not in str(text).lower():
                continue
            filtered.append(
                {
                    "seq": slot.get("seq"),
                    "text": text,
                    "chapter_index": slot.get("chapter_index"),
                    "corr_id": slot.get("corr_id"),
                    "language": language,
                    "grain": slot.get("grain"),
                }
            )
            continue
        if normalized_query and not any(
            normalized_query in str(value).lower()
            for value in languages.values()
            if value
        ):
            continue
        filtered.append(slot)
    return filtered
