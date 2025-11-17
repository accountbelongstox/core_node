#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Manager

Encapsulates pyutils.rpc to provide speech-related API endpoints.
Provides unified RPC interface for TTS and STT operations.

Features:
- Text-to-Speech (TTS) API
- Speech-to-Text (STT) API
- Multi-language support
- Batch processing
- Auto-start capability

Usage:
    from pycore.pyctl.speech.rpc import rpc_manager

    # Server auto-starts by default
    # Access APIs:
    # POST http://localhost:8765/rpc/tts
    # POST http://localhost:8765/rpc/stt
    # POST http://localhost:8765/rpc/multi_tts
    # POST http://localhost:8765/rpc/multi_stt

API Endpoints:

    /rpc/tts - Text to Speech
        Request: {"text": "hello", "language": "en-US"}
        Response: {"success": true, "audio_base64": "..."}

    /rpc/stt - Speech to Text
        Request: {"audio": "base64...", "language": "en-US"}
        Response: {"success": true, "text": "hello"}

    /rpc/multi_tts - Multi-language TTS
        Request: {"text": "hello", "languages": ["en-US", "zh-CN", "ja-JP"]}
        Response: {"success": true, "results": {...}}

    /rpc/multi_stt - Multi-language STT
        Request: {"audio": "base64...", "languages": ["en-US", "zh-CN"]}
        Response: {"success": true, "results": {...}}

    /rpc/status - Server status
        Response: {"server_running": true, "speech_status": {...}}
"""

from pycore.pyctl.speech.rpc.rpc_manager import RpcManager, get_rpc_manager

# Export singleton instance (auto-starts by default)
rpc_manager = get_rpc_manager()

__all__ = [
    'RpcManager',
    'rpc_manager',
    'get_rpc_manager',
]
