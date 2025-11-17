#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Common Utilities - TTS Switch and Shared Components

Provides unified TTS routing and common utilities.
Integrates with PyHeartbeat system for task management.

Components:
- TTSSwitch: Routes TTS tasks to available providers (edge_tts, azure_tts)
- Shared utilities for speech processing

Usage:
    from pycore.pyutils.common import get_tts_switch, initialize_tts_switch

    # Initialize TTS switch
    switch = initialize_tts_switch(
        max_queue_size=50,
        default_provider='edge',
        register_heartbeat=True  # Register with GlobalThreadPool
    )

    # Check status
    status = switch.get_status()
    print(f"Available: {switch.get_available_providers()}")

    # Direct task submission (bypassing heartbeat)
    from pycore.pyfoundations import Task
    task = Task(task_type='tts', task_data={'text': 'Hello', 'language': 'en-US'})
    switch.accept_task(task)

Architecture:
    Web Request → RPC → GlobalTaskQueue → HeartbeatPusher → TTSSwitch → Provider → Callback
    or
    Direct → TTSSwitch.accept_task() → Provider → Callback

Thread Safety:
    - All operations are thread-safe
    - Uses internal queue for task processing
    - Integrates with PyHeartbeat GlobalThreadPool
    - Non-blocking task acceptance
"""

# TTS Switch exports
from pycore.pyutils.common.tts_switch import (
    TTSProvider,
    TTSSwitch,
    get_tts_switch,
    initialize_tts_switch
)

# STT Switch exports
from pycore.pyutils.common.stt_switch import (
    STTProvider,
    STTSwitch,
    get_stt_switch,
    initialize_stt_switch
)

# Speech Task Models exports
from pycore.pyutils.common.speech_task_models import (
    SpeechTaskType,
    TTSTaskData,
    STTTaskData,
    TTSTaskResult,
    STTTaskResult,
    create_tts_task,
    create_stt_task
)

# Global Configuration exports (SQLite-backed)
from pycore.pyutils.common.global_config import (
    GlobalConfig,
    global_config
)

# Provider Status exports
from pycore.pyutils.common.provider_status import (
    ProviderStatus,
    ProviderInfo,
    get_provider_status
)

# Unified Speech Switch exports
from pycore.pyutils.common.speech_switch import (
    SpeechSwitch,
    get_speech_switch,
    initialize_speech_switch
)

__all__ = [
    # TTS Switch
    'TTSProvider',
    'TTSSwitch',
    'get_tts_switch',
    'initialize_tts_switch',
    # STT Switch
    'STTProvider',
    'STTSwitch',
    'get_stt_switch',
    'initialize_stt_switch',
    # Speech Task Models
    'SpeechTaskType',
    'TTSTaskData',
    'STTTaskData',
    'TTSTaskResult',
    'STTTaskResult',
    'create_tts_task',
    'create_stt_task',
    # Global Configuration
    'GlobalConfig',
    'global_config',
    # Provider Status
    'ProviderStatus',
    'ProviderInfo',
    'get_provider_status',
    # Unified Speech Switch
    'SpeechSwitch',
    'get_speech_switch',
    'initialize_speech_switch'
]
