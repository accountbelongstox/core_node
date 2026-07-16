"""
OCR Utility Package

Provides unified interface for OCR operations.

  - ocr_manager     : the CnOCR singleton (recognize_image / batch).
  - extract_text    : multi-engine orchestrator that picks the best AVAILABLE
                      local engine (windows -> easyocr -> cnocr).
  - ocr_status      : engine-availability snapshot for the UI.
"""

from pycore.pyutils.ocr_cluster.ocr.ocr_manager import ocr_manager
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import (
    OCR_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    extract_text,
    extract_text_engine,
    ocr_status,
    ocr_test,
)

__all__ = [
    'ocr_manager',
    'OCR_ENGINE_PRIORITY',
    'best_engine',
    'engine_available',
    'extract_text',
    'extract_text_engine',
    'ocr_status',
    'ocr_test',
]
