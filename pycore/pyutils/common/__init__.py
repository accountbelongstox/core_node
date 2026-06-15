#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pyutils.common - the SHARED BASE for pyutils.

Generic helpers that ANY pyutils group may import. This package MUST NOT import a
group package (no `common -> edge_tts`); that direction is backwards (see
PYTHON_PYCORE.md S2.2 / S3.2).

Provides:
- Speech CONTRACTS shared by speech groups: task models, provider-status data,
  speech/global config (the cross-group speech ORCHESTRATORS - SpeechSwitch,
  ProviderStatus, TTS/STT switches - now live in `pycore.pyctl.speech`, since
  coordinating groups is a pyctl concern).
- WindowFinder / BrowserWindowDetector: window searching utilities.
- Plus stand-alone modules imported directly: clipboard_text, system_launcher,
  process_manager, app_launcher, dev_reload, robust_downloader, port_utils,
  zip_task_queue, build_config_parser, capabilities, icon_generator, appusermodelid.
"""

# Speech Task Models exports (shared contracts)
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

# Window Finder exports
from pycore.pyutils.common.window_finder import WindowFinder

# Browser Window Detector (exe-based, auxiliary)
from pycore.pyutils.common.browser_window_detector import (
    BrowserWindowDetector,
    get_default_skip_browser_callable,
    get_process_exe_path,
    is_browser_process_by_path,
)

__all__ = [
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
    # Window Finder
    'WindowFinder',
    # Browser Window Detector
    'BrowserWindowDetector',
    'get_default_skip_browser_callable',
    'get_process_exe_path',
    'is_browser_process_by_path',
]
