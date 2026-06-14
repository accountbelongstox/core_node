#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy TTSSwitch compatibility layer.

SpeechSwitch now handles both TTS and STT routing. This module keeps the
old import paths working by exposing simple aliases that proxy to
SpeechSwitch, so downstream code does not break while the new switch is
adopted.
"""

from enum import Enum

from pycore.pyctl.speech.speech_switch import (
    SpeechSwitch,
    get_speech_switch,
    initialize_speech_switch,
)


class TTSProvider(Enum):
    """Backward-compatible provider enum."""
    EDGE = "edge"
    AZURE = "azure"
    BOTH = "both"


TTSSwitch = SpeechSwitch


def get_tts_switch() -> SpeechSwitch:
    """Return the unified SpeechSwitch (legacy alias)."""
    return get_speech_switch()


def initialize_tts_switch(*args, **kwargs) -> SpeechSwitch:
    """
    Initialize and return the unified SpeechSwitch (legacy alias).

    Args:
        *args, **kwargs: Ignored legacy parameters for backward compatibility.
    """
    return initialize_speech_switch()


__all__ = [
    "TTSProvider",
    "TTSSwitch",
    "get_tts_switch",
    "initialize_tts_switch",
]
