# -*- coding: utf-8 -*-
"""Text of a live terminal window read by OCR from a full-resolution capture."""

import secrets
from typing import Any, Dict

from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import extract_text
from pycore.pyutils.window.terminal_platform import terminal_backend

TERMINAL_OCR_TMP_DIR_NAME = "terminal_ocr"
TERMINAL_OCR_TMP_IMAGE_TEMPLATE = "terminal-{token}.png"
ERROR_CAPTURE_FAILED = "terminal_capture_failed"


def recognize_region_text(region: Dict[str, Any]) -> Dict[str, Any]:
    """Capture one window region and OCR it with the best installed engine; ``text`` is empty when nothing was read."""
    window_id = str(region.get("id") or "")
    image = terminal_backend.capture_windows([region]).get(window_id)
    if image is None:
        return {"text": "", "error": ERROR_CAPTURE_FAILED, "engine": None}
    directory = TMP_DIR / TERMINAL_OCR_TMP_DIR_NAME
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / TERMINAL_OCR_TMP_IMAGE_TEMPLATE.format(token=secrets.token_hex(6))
    image.save(path, format="PNG")
    try:
        recognized = extract_text(str(path))
    finally:
        path.unlink(missing_ok=True)
    return {
        "text": str(recognized.get("text") or ""),
        "error": recognized.get("error"),
        "engine": recognized.get("engine"),
    }


__all__ = ["recognize_region_text"]
