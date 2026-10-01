# -*- coding: utf-8 -*-
"""OCR test entry for the UI route (parameter binding over ocr_test)."""

from typing import Any, Dict, Optional

from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_test


def test(params: Optional[Dict[str, Any]] = None):
    """Live OCR test for ONE engine (or the best available)."""
    request = params or {}
    return ocr_test(
        engine=request.get("engine"),
        image_path=request.get("image_path"),
        image_data=request.get("image_data"),
        lang=request.get("lang"),
    )
