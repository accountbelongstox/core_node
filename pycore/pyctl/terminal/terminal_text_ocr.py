# -*- coding: utf-8 -*-
"""Text of a live terminal window read by OCR from a full-resolution capture."""

import secrets
import threading
from typing import Any, Dict

from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.common.ocr.manager import ocr_manager
from pycore.pyutils.window.terminal_platform import terminal_backend

TERMINAL_OCR_MODEL = "general"
TERMINAL_OCR_TMP_DIR_NAME = "terminal_ocr"
TERMINAL_OCR_TMP_IMAGE_TEMPLATE = "terminal-{token}.png"
ERROR_CAPTURE_FAILED = "terminal_capture_failed"

_ocr_lock = threading.Lock()


def recognize_region_text(region: Dict[str, Any]) -> Dict[str, Any]:
    """Capture one window region and OCR it; ``text`` is empty when nothing was recognized."""
    window_id = str(region.get("id") or "")
    image = terminal_backend.capture_windows([region]).get(window_id)
    if image is None:
        return {"text": "", "error": ERROR_CAPTURE_FAILED, "confidence": None}
    directory = TMP_DIR / TERMINAL_OCR_TMP_DIR_NAME
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / TERMINAL_OCR_TMP_IMAGE_TEMPLATE.format(token=secrets.token_hex(6))
    image.save(path, format="PNG")
    try:
        with _ocr_lock:
            recognized = ocr_manager.recognize_image(str(path), model_type=TERMINAL_OCR_MODEL)
    finally:
        path.unlink(missing_ok=True)
    return {
        "text": str(recognized.get("text") or ""),
        "error": recognized.get("error"),
        "confidence": recognized.get("confidence"),
    }


__all__ = ["recognize_region_text"]
