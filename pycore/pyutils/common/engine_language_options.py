# -*- coding: utf-8 -*-
"""Canonical language options for OCR, STT, and TTS engine test suites."""

from typing import Dict, List

# Core 4 languages supported across all speech & vision engines (EN + CJK)
COMMON_CORE_LANGUAGE_OPTIONS: List[Dict[str, str]] = [
    {"value": "en", "label": "English"},
    {"value": "zh", "label": "中文"},
    {"value": "ja", "label": "日本語"},
    {"value": "ko", "label": "한국어"},
]

# Extended language options accepted by multilingual TTS engines
COMMON_TTS_LANGUAGE_OPTIONS: List[Dict[str, str]] = COMMON_CORE_LANGUAGE_OPTIONS + [
    {"value": "es", "label": "Español"},
    {"value": "fr", "label": "Français"},
]

__all__ = [
    "COMMON_CORE_LANGUAGE_OPTIONS",
    "COMMON_TTS_LANGUAGE_OPTIONS",
]
