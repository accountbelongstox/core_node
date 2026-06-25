# -*- coding: utf-8 -*-
"""
Assist-Laravel control package (pyctl layer).

The AssistWorker claims cover-image and TTS work from the SELECTED laravel
endpoint, generates locally (injected pyctl.ai.generate_image + the existing
pyutils TTS orchestrator), and submits results back. Word translations stay on
the existing TranslationWorkerService; this package only supplies the master
toggle gate for it (translation_worker_enabled_on_start).

The app layer (callmodule.services.assist_wiring) composes the endpoint
resolver and image generator in — pyctl never imports callmodule, and pyctl/*
packages never import each other.
"""

from pycore.pyctl.assist.assist_worker import (
    ASSIST_API_PREFIX,
    BATCH_LIMIT_MAX,
    BATCH_LIMIT_MIN,
    DEFAULT_SETTINGS,
    POLL_INTERVAL_MAX,
    POLL_INTERVAL_MIN,
    USER_DATA_SECTION,
    AssistWorker,
    assist_capability_enabled,
    assist_settings_exist,
    get_assist_worker,
    load_assist_settings,
    save_assist_settings,
    translation_worker_enabled_on_start,
)

__all__ = [
    "ASSIST_API_PREFIX",
    "BATCH_LIMIT_MAX",
    "BATCH_LIMIT_MIN",
    "DEFAULT_SETTINGS",
    "POLL_INTERVAL_MAX",
    "POLL_INTERVAL_MIN",
    "USER_DATA_SECTION",
    "AssistWorker",
    "assist_capability_enabled",
    "assist_settings_exist",
    "get_assist_worker",
    "load_assist_settings",
    "save_assist_settings",
    "translation_worker_enabled_on_start",
]
