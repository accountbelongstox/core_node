#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Common Speech Utilities

Provides the unified SpeechSwitch plus legacy compatibility helpers.
Integrates with PyHeartbeat for task management.

Components:
- SpeechSwitch: Routes both TTS and STT tasks based on provider status
- Legacy wrappers: TTSSwitch/STTSwitch aliases for backward compatibility
- Shared task models and provider status helpers
- WindowFinder: Centralized window searching utility
"""

# Legacy switch exports (proxies to SpeechSwitch)
from pycore.pyutils.common.tts_switch import (
    TTSProvider,
    TTSSwitch,
    get_tts_switch,
    initialize_tts_switch,
)
from pycore.pyutils.common.stt_switch import (
    STTProvider,
    STTSwitch,
    get_stt_switch,
    initialize_stt_switch,
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

# Speech Configuration exports (SQLite-backed, util_speech namespace)
from pycore.pyutils.common.speech_config import (
    SpeechConfig,
    speech_config
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

# Window Finder exports
from pycore.pyutils.common.window_finder import WindowFinder

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
    # Speech Configuration
    'SpeechConfig',
    'speech_config',
    # Provider Status
    'ProviderStatus',
    'ProviderInfo',
    'get_provider_status',
    # Unified Speech Switch
    'SpeechSwitch',
    'get_speech_switch',
    'initialize_speech_switch',
    # Window Finder
    'WindowFinder'
]

