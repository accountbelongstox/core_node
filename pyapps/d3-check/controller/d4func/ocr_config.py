# -*- coding: utf-8 -*-
"""
OCR configuration for D4 recognition tasks. Re-exports from share (controller does not own config data).
"""

from share.d4_ocr_config import (
    OCRModelConfig,
    OCRConfig,
    get_ocr_config_for_task,
    get_ocr_config_by_model,
)

__all__ = [
    "OCRModelConfig",
    "OCRConfig",
    "get_ocr_config_for_task",
    "get_ocr_config_by_model",
]
