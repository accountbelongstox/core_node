#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Whisper STT (Speech-to-Text) Module

Provides speech recognition using OpenAI's Whisper model.
Supports multiple input sources:
- Audio files (auto format conversion)
- Microphone input
- System audio capture (Windows)
- Audio URL
- Video files (audio extraction)

Usage:
    from pycore.pyutils.whisper_stt import whisper_stt_provider, WhisperSTTProvider

    # Initialize
    provider = whisper_stt_provider
    provider.initialize()

    # Transcribe from file
    result = provider.recognize_from_file("audio.mp3")

    # Transcribe from microphone
    provider.recognize_from_microphone(
        on_recognized=lambda text, conf: print(text)
    )
"""

from pycore.pyutils.whisper_stt.whisper_provider import (
    WhisperSTTProvider,
    get_whisper_stt_provider,
)

# Global singleton instance
whisper_stt_provider = get_whisper_stt_provider()

__all__ = [
    'WhisperSTTProvider',
    'whisper_stt_provider',
    'get_whisper_stt_provider',
]
