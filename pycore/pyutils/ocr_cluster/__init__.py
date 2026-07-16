"""
OCR cluster package.

Re-exports the public OCR API from the ``ocr`` subpackage.
"""

from pycore.pyutils.ocr_cluster.ocr import (
    OCR_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    extract_text,
    extract_text_engine,
    ocr_manager,
    ocr_status,
    ocr_test,
)

__all__ = [
    "ocr_manager",
    "OCR_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "extract_text",
    "extract_text_engine",
    "ocr_status",
    "ocr_test",
]
