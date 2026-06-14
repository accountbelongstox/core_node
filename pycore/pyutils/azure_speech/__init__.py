#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Azure Speech Services utility package."""

from pycore.pyutils.azure_speech.azure_speech_client import (
    AzureSpeechClient,
    get_azure_speech_client,
)
from pycore.pyutils.azure_speech.config import AzureSpeechConfig
from pycore.pyutils.common.stt_base_provider import BaseSpeechRecognitionProvider
from pycore.pyutils.azure_speech.stt_provider import AzureSpeechRecognitionProvider
from pycore.pyutils.azure_speech.speech_recognizer import (
    SpeechRecognizer,
    get_speech_recognizer,
)

SPEECH_RECOGNITION_AVAILABLE = True
speech_recognizer = get_speech_recognizer()

__all__ = [
    "AzureSpeechClient",
    "get_azure_speech_client",
    "AzureSpeechConfig",
    "BaseSpeechRecognitionProvider",
    "AzureSpeechRecognitionProvider",
    "SpeechRecognizer",
    "get_speech_recognizer",
    "speech_recognizer",
    "SPEECH_RECOGNITION_AVAILABLE",
]

