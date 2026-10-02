#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
d3-check CnOCR thin wrapper: delegates to pycore cnocr_registry (engines by model key, installed weights only).
Task name -> model key mapping only here (share.d4_ocr_config). Do not instantiate CnOCREngine elsewhere.
"""

from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Engine impl and third_party load in pycore; d3-check only maps task names
from pycore.pyutils.common.ocr.cnocr_registry import cnocr_registry
from share.d4_ocr_config import OCRConfig


def ensure_cnocr_loaded_and_engines_initialized() -> bool:
    """Call at app startup: pycore loads the installed cnocr and pre-inits the language engines."""
    return cnocr_registry.ensure_loaded()


def get_cnocr_engine_default() -> Optional["CnOCREngine"]:
    """Default engine (same config as general)."""
    return cnocr_registry.default()


def get_cnocr_engine_general() -> Optional["CnOCREngine"]:
    """General model."""
    return cnocr_registry.for_model_key("general")


def get_cnocr_engine_number() -> Optional["CnOCREngine"]:
    """Number model."""
    return cnocr_registry.for_model_key("number")


def get_cnocr_engine_document() -> Optional["CnOCREngine"]:
    """Document model."""
    return cnocr_registry.for_model_key("document")


def get_cnocr_engine_for_task(task_name: str) -> Optional["CnOCREngine"]:
    """Return engine for task name (map_name/quest_text/health_value etc.); mapping in share.d4_ocr_config."""
    model_key = OCRConfig.TASK_CONFIGS.get(task_name, "general")
    return cnocr_registry.for_model_key(model_key)