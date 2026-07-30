# -*- coding: utf-8 -*-
"""Shared OCR status service."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_status, ocr_test


def status():
    """OCR engine availability snapshot."""
    return ocr_status()


def test(params: Optional[Dict[str, Any]] = None):
    """Live OCR test for ONE engine (or the best available)."""
    p = params or {}
    ColorPrint.yellow("[DEPRECATED] Direct OCR test entry; use the HTTP controller")
    return ocr_test(
        engine=p.get("engine"),
        image_path=p.get("image_path"),
        image_data=p.get("image_data"),
        lang=p.get("lang"),
    )
