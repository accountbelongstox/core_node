#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pycore.pyctl.speech.launch_speech_rpc import launch_speech_rpc_service
"""
Speech Module - Unified Speech Processing System

High-level speech management combining TTS, STT, RPC, and AI utilities.
Integrates with PyHeartbeat and the unified SpeechSwitch for task-based processing.

Sub-modules:
- speech_manager: Core speech TTS/STT functionality
- rpc: RPC server integrated with PyHeartbeat
- ai: AI-enhanced features (chat, parse, expand, translate)
- launch_speech_rpc: Entry point for RPC-only service

Usage:
    # Launch RPC service (recommended)
    from pycore.pyctl.speech import launch_speech_rpc_service

    instances = launch_speech_rpc_service(port=59000)
    # Now accessible via:
    # POST http://localhost:59000/rpc/tts
    # POST http://localhost:59000/rpc/stt

    # Direct speech manager usage
    from pycore.pyctl.speech import get_speech_manager
    speech_manager = get_speech_manager()
    result = speech_manager.recognize_from_file("audio.wav")
    speech_manager.synthesize_to_file("Hello world", "output.mp3")

    # New RPC service (PyHeartbeat-integrated)
    from pycore.pyctl.speech.rpc import start_rpc_service

Architecture:
    Web Request → RPC Server → GlobalTaskQueue → HeartbeatPusher → SpeechSwitch → Provider → Response
"""

from pycore.pyctl.speech.speech_manager import SpeechManager, get_speech_manager

# Lazy: launch_speech_rpc imports pylauncher; avoid that during package init
# (pythreadpool -> speech_thread -> pyctl.speech must not circle back).

__all__ = [
    'SpeechManager',
    'get_speech_manager',
    'launch_speech_rpc_service',
]


def __getattr__(name: str):
    if name == 'launch_speech_rpc_service':
        return launch_speech_rpc_service
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
