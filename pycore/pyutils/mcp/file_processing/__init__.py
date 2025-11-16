#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP File Processing Utilities Module
Comprehensive file information extraction with OCR, document parsing, color analysis

All library implementations for file processing
"""

from .file_info_extractor_with_ocr_text_positions_color_palette_and_metadata import (
    get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats,
    get_file_info_with_ocr_and_document_parsing
)

__all__ = [
    'get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats',
    'get_file_info_with_ocr_and_document_parsing'
]

__version__ = "1.0.0"
