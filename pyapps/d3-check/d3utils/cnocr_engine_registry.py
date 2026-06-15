#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
d3-check CnOCR thin wrapper: delegates to pycore cnocr_engine_registry (third_party load and engine init).
Task name -> model key mapping only here (share.d4_ocr_config). Do not instantiate CnOCREngine elsewhere.
"""

from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Engine impl and third_party load in pycore; d3-check only maps task names
from pycore.pyutils.ocr_cluster.cnocr_engine_registry import (
    ensure_cnocr_loaded_and_engines_initialized as _pycore_ensure,
    get_cnocr_engine_default as _pycore_default,
    get_cnocr_engine_by_model_key as _pycore_by_model_key,
)
from share.d4_ocr_config import OCRConfig


def ensure_cnocr_loaded_and_engines_initialized() -> bool:
    """Call at app startup: delegate to pycore to load/install cnocr and pre-init all engines."""
    return _pycore_ensure()


def get_cnocr_engine_default() -> Optional["CnOCREngine"]:
    """Default engine (same config as general)."""
    return _pycore_default()


def get_cnocr_engine_general() -> Optional["CnOCREngine"]:
    """General model."""
    return _pycore_by_model_key("general")


def get_cnocr_engine_number() -> Optional["CnOCREngine"]:
    """Number model."""
    return _pycore_by_model_key("number")


def get_cnocr_engine_document() -> Optional["CnOCREngine"]:
    """Document model."""
    return _pycore_by_model_key("document")


def get_cnocr_engine_for_task(task_name: str) -> Optional["CnOCREngine"]:
    """Return engine for task name (map_name/quest_text/health_value etc.); mapping in share.d4_ocr_config."""
    model_key = OCRConfig.TASK_CONFIGS.get(task_name, "general")
    return _pycore_by_model_key(model_key)