#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Services Utility

Provides Azure Cognitive Services Speech SDK integration.
Shares queue and data models with edge_tts.
"""

from pycore.pyutils.azure_speech.azure_speech_client import AzureSpeechClient, get_azure_speech_client
from pycore.pyutils.azure_speech.config import AzureSpeechConfig

__all__ = [
    'AzureSpeechClient',
    'get_azure_speech_client',
    'AzureSpeechConfig',
]

