"""
OCR Utility Package

Provides unified interface for OCR operations using CnOCR engine.
Exports the main OCR manager instance for easy access.
"""

from pycore.pyutils.ocr.ocr_manager import ocr_manager

__all__ = ['ocr_manager']
