#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Manager

High-level speech management combining TTS and STT utilities from pyutils.
Provides unified interface for both text-to-speech and speech-to-text operations.

Usage:
    from pycore.pyctl.speech import speech_manager

    # Speech-to-text
    result = speech_manager.recognize_from_file("audio.wav")
    print(result['text'])

    # Text-to-speech
    speech_manager.synthesize_to_file("Hello world", "output.mp3")
"""

from pycore.pyctl.speech.speech_manager import SpeechManager, get_speech_manager

# Export singleton instance
speech_manager = get_speech_manager()

__all__ = [
    'SpeechManager',
    'speech_manager',
    'get_speech_manager',
]
