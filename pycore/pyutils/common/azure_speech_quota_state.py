#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Azure Speech quota state tracking.

Stores whether TTS or STT have hit quota/usage limits so other components
can mark the provider as unavailable without introducing circular imports.
"""

from typing import Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized


_QUOTA_STATE_QUEUE = "azure_speech.quota_state"
_quota_state: Dict[str, Tuple[bool, Optional[str]]] = {
    "tts": (False, None),
    "stt": (False, None),
}
_QUOTA_STATE_WORKER = SerializedWorkerThread(
    _QUOTA_STATE_QUEUE,
    "AzureSpeechQuotaStateThread",
)
_QUOTA_STATE_WORKER.start()


def _set_quota_state(kind: str, blocked: bool, error: Optional[str]) -> None:
    _quota_state[kind] = (blocked, error)


def _get_quota_state(kind: str) -> Tuple[bool, Optional[str]]:
    return _quota_state[kind]


def mark_tts_quota_exceeded(error: Optional[str] = None) -> None:
    """Mark Azure TTS as unusable due to quota reach."""
    call_serialized(
        _QUOTA_STATE_QUEUE,
        _set_quota_state,
        "tts",
        True,
        error or "Azure TTS quota exceeded",
    )


def clear_tts_quota_issue() -> None:
    """Clear stored TTS quota failure."""
    call_serialized(_QUOTA_STATE_QUEUE, _set_quota_state, "tts", False, None)


def is_tts_quota_blocked() -> Tuple[bool, Optional[str]]:
    """Return whether TTS quota is exhausted and associated error."""
    return call_serialized(_QUOTA_STATE_QUEUE, _get_quota_state, "tts")


def mark_stt_quota_exceeded(error: Optional[str] = None) -> None:
    """Mark Azure STT as unusable due to quota reach."""
    call_serialized(
        _QUOTA_STATE_QUEUE,
        _set_quota_state,
        "stt",
        True,
        error or "Azure STT quota exceeded",
    )


def clear_stt_quota_issue() -> None:
    """Clear stored STT quota failure."""
    call_serialized(_QUOTA_STATE_QUEUE, _set_quota_state, "stt", False, None)


def is_stt_quota_blocked() -> Tuple[bool, Optional[str]]:
    """Return whether STT quota is exhausted and associated error."""
    return call_serialized(_QUOTA_STATE_QUEUE, _get_quota_state, "stt")
