# -*- coding: utf-8 -*-
"""
Per-engine test parameter definitions for every OCR engine.

Each entry declares the fields the engine accepts for a live test call,
plus metadata that the frontend uses to render the correct form controls.
The field keys match the kwargs accepted by ``ocr_test()`` in
``ocr_orchestrator.py``.
"""

from typing import Any, Dict, List

from pycore.pyutils.common.engine_language_options import COMMON_CORE_LANGUAGE_OPTIONS

_COMMON_OCR_LANGS: List[Dict[str, str]] = COMMON_CORE_LANGUAGE_OPTIONS

OCR_ENGINE_TEST_PARAMS: Dict[str, Dict[str, Any]] = {
    "windows_ocr": {
        "fields": ["ocr_text", "lang"],
        "ocr_text_default": "Hello OCR 123\n你好世界",
        "language_options": _COMMON_OCR_LANGS,
        "language_default": "en",
        "windows_only": True,
        "grid_position": True,
        "grid_position_hint": "Optional 1–9 grid cell to crop before OCR (None = full image)",
        "note": "Windows.Media.Ocr (WinRT). Built-in Windows 10+, no extra model download.",
    },
    "easyocr": {
        "fields": ["ocr_text", "lang"],
        "ocr_text_default": "Hello OCR 123\n你好世界",
        "language_options": [
            {"value": "en", "label": "English"},
            {"value": "zh", "label": "中文 (ch_sim+en)"},
            {"value": "ja", "label": "日本語"},
            {"value": "ko", "label": "한국어"},
        ],
        "language_default": "en",
        "lang_list": ["ch_sim", "en", "ja", "ko"],
        "long_wait": True,
        "note": "EasyOCR. GPU speeds up detection; weights come from Step46_InstallOcr.ps1 / 125_install_ocr.sh.",
    },
    "cnocr": {
        "fields": ["ocr_text", "lang", "model_type"],
        "ocr_text_default": "Hello OCR 123\n你好世界",
        "language_options": [
            {"value": "en", "label": "English"},
            {"value": "zh", "label": "中文 (general)"},
            {"value": "cht", "label": "繁體中文"},
            {"value": "ja", "label": "日本語 (general)"},
            {"value": "ko", "label": "한국어 (general)"},
        ],
        "language_default": "zh",
        "model_type_options": [
            {"value": "general", "label": "General (densenet_lite_136-gru)"},
            {"value": "scene", "label": "Scene (scene-densenet_lite_136-gru)"},
            {"value": "doc", "label": "Document (doc-densenet_lite_136-gru)"},
            {"value": "number", "label": "Number (number-densenet_lite_136-gru)"},
            {"value": "english", "label": "English (en_PP-OCRv3)"},
            {"value": "chinese_traditional", "label": "Traditional Chinese (PP-OCRv3)"},
        ],
        "model_type_default": "general",
        "model_type_hint": "Detection + recognition model pair. 'general' is best for mixed text.",
        "long_wait": True,
        "note": "CnOCR. Lightweight Chinese/English OCR; good for printed text.",
    },
}


__all__ = ["OCR_ENGINE_TEST_PARAMS"]
