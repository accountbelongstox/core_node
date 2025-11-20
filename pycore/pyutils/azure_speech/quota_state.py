#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech quota state tracking.

Stores whether TTS or STT have hit quota/usage limits so other components
can mark the provider as unavailable without introducing circular imports.
"""

from typing import Optional, Tuple

_tts_blocked: bool = False
_tts_error: Optional[str] = None

_stt_blocked: bool = False
_stt_error: Optional[str] = None


def mark_tts_quota_exceeded(error: Optional[str] = None) -> None:
    """Mark Azure TTS as unusable due to quota reach."""
    global _tts_blocked, _tts_error
    _tts_blocked = True
    _tts_error = error or "Azure TTS quota exceeded"


def clear_tts_quota_issue() -> None:
    """Clear stored TTS quota failure."""
    global _tts_blocked, _tts_error
    _tts_blocked = False
    _tts_error = None


def is_tts_quota_blocked() -> Tuple[bool, Optional[str]]:
    """Return whether TTS quota is exhausted and associated error."""
    return _tts_blocked, _tts_error


def mark_stt_quota_exceeded(error: Optional[str] = None) -> None:
    """Mark Azure STT as unusable due to quota reach."""
    global _stt_blocked, _stt_error
    _stt_blocked = True
    _stt_error = error or "Azure STT quota exceeded"


def clear_stt_quota_issue() -> None:
    """Clear stored STT quota failure."""
    global _stt_blocked, _stt_error
    _stt_blocked = False
    _stt_error = None


def is_stt_quota_blocked() -> Tuple[bool, Optional[str]]:
    """Return whether STT quota is exhausted and associated error."""
    return _stt_blocked, _stt_error
