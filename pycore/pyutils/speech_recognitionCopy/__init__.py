#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Recognition Utility

Provides speech-to-text (STT) recognition services with multiple providers.
Exports singleton instance for easy use.

Usage:
    from pycore.pyutils.speech_recognition import speech_recognizer, SPEECH_RECOGNITION_AVAILABLE

    if SPEECH_RECOGNITION_AVAILABLE:
        result = speech_recognizer.recognize_from_file("audio.wav", language="zh-CN")
        print(result['text'])
"""

from pycore.pyutils.speech_recognition.speech_recognizer import (
    SpeechRecognizer,
    get_speech_recognizer
)

# Check if speech recognition is available
SPEECH_RECOGNITION_AVAILABLE = True

# Export singleton instance
speech_recognizer = get_speech_recognizer()

__all__ = [
    'SpeechRecognizer',
    'speech_recognizer',
    'get_speech_recognizer',
    'SPEECH_RECOGNITION_AVAILABLE',
]
