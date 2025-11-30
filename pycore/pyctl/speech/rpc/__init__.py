#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Service - Launcher-integrated Speech RPC

Integrates with PyHeartbeat and the unified SpeechSwitch for task-based processing.
Receives RPC server instance from pylauncher for non-blocking operation.

Features:
- Text-to-Speech (TTS) via PyHeartbeat queue
- Speech-to-Text (STT) via PyHeartbeat queue
- Task-based async processing
- SpeechSwitch routing to providers (edge/azure)
- Global state in Encyclopedia

Usage:
    # Modern approach: Use with pylauncher
    from pycore.pylauncher import launch_services, create_speech_service_config
    from pycore.pyctl.speech.rpc import start_rpc_service

    # Launch services (creates RPC server + heartbeat + speech_switch)
    config = create_speech_service_config(rpc_port=59000)
    instances = launch_services(config)

    # Start RPC service with routes
    rpc_service = start_rpc_service(instances.rpc_server, instances.tts_switch)

    # Access APIs:
    # POST http://localhost:59000/rpc/tts
    # POST http://localhost:59000/rpc/stt
    # GET http://localhost:59000/rpc/status

API Endpoints:

    /rpc/tts - Text to Speech (via GlobalTaskQueue)
        Request: {"text": "hello", "language": "en-US", "async": true}
        Response (async): {"success": true, "status": "accepted", "task_id": "..."}
        Response (sync): {"success": true, "audio_path": "...", "cached": false}

    /rpc/stt - Speech to Text (via GlobalTaskQueue)
        Request: {"audio_file": "/path/to/audio.wav", "language": "zh-CN"}
        Response: {"success": true, "text": "...", "confidence": 0.95}

    /rpc/status - Service status (includes Encyclopedia data)
        Response: {"success": true, "tts_switch": {...}, "thread_pool": {...}}

    /rpc/queue_stats - Heartbeat queue statistics
        Response: {"success": true, "stats": {"tasks_pushed": 100, ...}}
"""

# Launcher-integrated RPC service
from pycore.pyctl.speech.rpc.rpc_service import (
    RPCService,
    get_rpc_service,
    start_rpc_service
)

__all__ = [
    'RPCService',
    'get_rpc_service',
    'start_rpc_service',
]
