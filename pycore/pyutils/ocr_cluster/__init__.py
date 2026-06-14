"""
OCR cluster package.

Re-exports the public OCR API from the ``ocr`` subpackage.
"""

from pycore.pyutils.ocr_cluster.ocr import (
    OCR_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    extract_text,
    ocr_manager,
    ocr_status,
)

__all__ = [
    "ocr_manager",
    "OCR_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "extract_text",
    "ocr_status",
]
