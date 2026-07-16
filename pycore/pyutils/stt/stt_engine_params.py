# -*- coding: utf-8 -*-
"""
Per-engine test parameter definitions for every STT engine.

Each entry declares the fields the engine accepts for a live test call,
plus metadata that the frontend uses to render the correct form controls.
The field keys match the kwargs accepted by ``stt_test()`` in
``stt_orchestrator.py``.
"""

from typing import Any, Dict, List

_COMMON_STT_LANGS: List[Dict[str, str]] = [
    {"value": "en", "label": "English"},
    {"value": "zh", "label": "中文"},
    {"value": "ja", "label": "日本語"},
    {"value": "ko", "label": "한국어"},
]

STT_ENGINE_TEST_PARAMS: Dict[str, Dict[str, Any]] = {
    "faster-whisper": {
        "fields": ["text", "language"],
        "text_default": "The quick brown fox jumps over the lazy dog.",
        "text_hint": "Phrase to synthesize (TTS) then recognize. Round-trip test.",
        "language_options": _COMMON_STT_LANGS,
        "language_default": "en",
        "round_trip": True,
        "managed_service": True,
        "model_idle_unload_s": 60,
        "long_wait": True,
        "note": "CTranslate2 Whisper. large-v3 first load ~1 min.",
    },
    "whisper": {
        "fields": ["text", "language"],
        "text_default": "The quick brown fox jumps over the lazy dog.",
        "text_hint": "Phrase to synthesize (TTS) then recognize. Round-trip test.",
        "language_options": _COMMON_STT_LANGS,
        "language_default": "en",
        "round_trip": True,
        "managed_service": True,
        "model_idle_unload_s": 60,
        "long_wait": True,
        "note": "OpenAI Whisper (whisper.cpp). large-v3 round-trip phrase test.",
    },
    "vosk": {
        "fields": ["text", "language"],
        "text_default": "The quick brown fox jumps over the lazy dog.",
        "text_hint": "Phrase to synthesize (TTS) then recognize. Round-trip test.",
        "language_options": _COMMON_STT_LANGS,
        "language_default": "en",
        "round_trip": True,
        "needs_wav": True,
        "managed_service": True,
        "model_idle_unload_s": 60,
        "note": "Vosk offline. Small models, fast once loaded. Needs WAV sample.",
    },
    "azure": {
        "fields": ["text", "language"],
        "text_default": "The quick brown fox jumps over the lazy dog.",
        "text_hint": "Phrase to synthesize (TTS) then recognize. Round-trip test.",
        "language_options": _COMMON_STT_LANGS,
        "language_default": "en",
        "round_trip": True,
        "needs_wav": True,
        "requires_key": True,
        "key_env": "AZURE_SPEECH_KEY",
        "quota": {
            "tier": "free-F0",
            "limit": "~0.5M chars/month",
            "note": "Free tier; throttles with HTTP 429 when exhausted",
        },
        "note": "Azure Speech STT cloud (free F0). Round-trip uses TTS sample audio.",
    },
}


def get_stt_engine_params(engine: str) -> Dict[str, Any]:
    """Return the test-parameter schema for an STT engine, or an empty dict if unknown."""
    return STT_ENGINE_TEST_PARAMS.get((engine or "").strip().lower(), {})


__all__ = ["STT_ENGINE_TEST_PARAMS", "get_stt_engine_params"]
