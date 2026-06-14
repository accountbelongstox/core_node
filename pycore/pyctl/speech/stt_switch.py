#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy STTSwitch compatibility layer.

SpeechSwitch now powers both TTS and STT routing. This module exposes the
previous STTSwitch API as thin aliases so existing imports continue to
work without maintaining duplicated implementations.
"""

from enum import Enum

from pycore.pyctl.speech.speech_switch import (
    SpeechSwitch,
    get_speech_switch,
    initialize_speech_switch,
)


class STTProvider(Enum):
    """Backward-compatible provider enum."""
    WHISPER = "whisper"
    AZURE = "azure"
    LOCAL = "local"
    AUTO = "auto"


STTSwitch = SpeechSwitch


def get_stt_switch() -> SpeechSwitch:
    """Return the unified SpeechSwitch (legacy alias)."""
    return get_speech_switch()


def initialize_stt_switch(*args, **kwargs) -> SpeechSwitch:
    """
    Initialize and return the unified SpeechSwitch (legacy alias).

    Args:
        *args, **kwargs: Ignored legacy parameters kept for compatibility.
    """
    return initialize_speech_switch()


__all__ = [
    "STTProvider",
    "STTSwitch",
    "get_stt_switch",
    "initialize_stt_switch",
]
