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
    from pycore.pyctl.rpc import rpc_manager

    # Server auto-starts by default
    # Access APIs:
    # POST http://localhost:8765/api/tts
    # POST http://localhost:8765/api/stt
    # POST http://localhost:8765/api/multi_tts
    # POST http://localhost:8765/api/multi_stt

API Endpoints:

    /api/tts - Text to Speech
        Request: {"text": "hello", "language": "en-US"}
        Response: {"success": true, "audio_base64": "..."}

    /api/stt - Speech to Text
        Request: {"audio": "base64...", "language": "en-US"}
        Response: {"success": true, "text": "hello"}

    /api/multi_tts - Multi-language TTS
        Request: {"text": "hello", "languages": ["en-US", "zh-CN", "ja-JP"]}
        Response: {"success": true, "results": {...}}

    /api/multi_stt - Multi-language STT
        Request: {"audio": "base64...", "languages": ["en-US", "zh-CN"]}
        Response: {"success": true, "results": {...}}

    /api/status - Server status
        Response: {"server_running": true, "speech_status": {...}}
"""

from pycore.pyctl.rpc.rpc_manager import RpcManager, get_rpc_manager

# Export singleton instance (auto-starts by default)
rpc_manager = get_rpc_manager()

__all__ = [
    'RpcManager',
    'rpc_manager',
    'get_rpc_manager',
]
