#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Module - Unified Speech Processing System

High-level speech management combining TTS, STT, RPC, and AI utilities.
Provides unified interface for speech operations and AI-enhanced features.

Sub-modules:
- speech_manager: Core speech TTS/STT functionality
- rpc: RPC server for web API endpoints
- ai: AI-enhanced features (chat, parse, expand, translate)

Usage:
    # Speech TTS/STT
    from pycore.pyctl.speech import speech_manager
    result = speech_manager.recognize_from_file("audio.wav")
    speech_manager.synthesize_to_file("Hello world", "output.mp3")

    # RPC Server
    from pycore.pyctl.speech.rpc import rpc_manager
    rpc_manager.start()

    # AI Features (future)
    from pycore.pyctl.speech.ai import ai_manager
    response = ai_manager.chat("Hello")
"""

from pycore.pyctl.speech.speech_manager import SpeechManager, get_speech_manager

# Export singleton instance
speech_manager = get_speech_manager()

__all__ = [
    'SpeechManager',
    'speech_manager',
    'get_speech_manager',
]
