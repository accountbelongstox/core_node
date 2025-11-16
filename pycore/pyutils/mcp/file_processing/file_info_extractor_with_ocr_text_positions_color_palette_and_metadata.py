#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Info Extractor with OCR, Text Positions, Color Palette, and Metadata
Main unified entry point for comprehensive file analysis
"""

import logging
import mimetypes
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.mcp.file_processing.image_analyzer_with_ocr_color_extraction_and_pixel_matrix import (
    get_image_analyzer_singleton
)
from pycore.pyutils.mcp.file_processing.document_parser_with_text_positions_and_metadata_extraction import (
    get_document_parser_singleton
)
from pycore.pyutils.mcp.file_processing.database_manager_for_file_info_caching_and_history import (
    get_database_manager_singleton
)

logger = logging.getLogger(__name__)


class FileInfoExtractorWithOCRTextPositionsColorPaletteAndMetadata:
    """
    Unified file information extractor for all file types
    Handles images, PDFs, and Office documents with comprehensive analysis
    """

    # Supported file types
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'}
    PDF_EXTENSIONS = {'.pdf'}
    OFFICE_EXTENSIONS = {'.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'}
    SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS | OFFICE_EXTENSIONS

    async def get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
        self,
        file_path: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive file information with ALL available analysis

        This is the main unified method that handles all file types and returns
        comprehensive analysis including:
        - For images: OCR text, text positions, color palette, pixel matrix, dimensions
        - For PDFs: Text extraction, text positions, metadata, tables, images, hyperlinks
        - For Office docs: Text content, paragraphs, metadata, tables, formulas, sheets

        Args:
            file_path: Path to file to analyze
            options: Optional configuration dictionary with keys:
                - use_cache: Whether to use database caching (default: True)
                - include_pixel_matrix: For images, include full pixel matrix (default: False)
                - ocr_model_type: OCR model type (default: "general")
                - num_colors: Number of dominant colors to extract (default: 10)
                - extract_images: For documents, extract embedded images (default: True)
                - extract_tables: For documents, extract tables (default: True)
                - extract_hyperlinks: For PDFs, extract hyperlinks (default: True)

        Returns:
            Comprehensive file information dictionary with all available analysis
        """
        start_time = datetime.utcnow()

        # Parse options
        options = options or {}
        use_cache = options.get("use_cache", True)
        include_pixel_matrix = options.get("include_pixel_matrix", False)
        ocr_model_type = options.get("ocr_model_type", "general")
        num_colors = options.get("num_colors", 10)
        extract_images = options.get("extract_images", True)
        extract_tables = options.get("extract_tables", True)
        extract_hyperlinks = options.get("extract_hyperlinks", True)

        # Validate file exists
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            ColorPrint.red(f"[ERROR] File not found: {file_path}")
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "file_path": file_path
            }

        # Check cache if enabled
        if use_cache:
            db_manager = get_database_manager_singleton()
            cached_result = await db_manager.retrieve_cached_file_info_from_database_by_path_or_hash(
                file_path=file_path
            )
            if cached_result:
                ColorPrint.green(f"[CACHE HIT] Using cached result for: {file_path}")
                cached_result["processing_comprehensive_stats"]["cache_status"] = {
                    "was_cached": True,
                    "cache_key": cached_result.get("file_hash_sha256", ""),
                    "cache_timestamp": cached_result["processing_comprehensive_stats"]["processing_timestamp_utc"]
                }
                return cached_result

        # Detect file type
        file_type = await self._detect_file_type_from_extension_and_mime(file_path)
        ColorPrint.blue(f"[INFO] Processing file type: {file_type} - {file_path}")

        # Route to appropriate processor
        result = {}

        if file_type == "image":
            result = await self._process_image_file_with_ocr_and_color_analysis(
                file_path, include_pixel_matrix, ocr_model_type, num_colors
            )
        elif file_type in ["pdf", "docx", "xlsx", "pptx"]:
            result = await self._process_document_file_with_text_and_metadata_extraction(
                file_path, file_type, extract_images, extract_tables, extract_hyperlinks
            )
        else:
            ColorPrint.yellow(f"[WARNING] Unsupported file type: {file_type}")
            result = await self._process_generic_file_with_basic_info(file_path)

        # Add cache status
        if "processing_comprehensive_stats" not in result:
            result["processing_comprehensive_stats"] = {}

        result["processing_comprehensive_stats"]["cache_status"] = {
            "was_cached": False,
            "cache_key": result.get("file_hash_sha256", ""),
            "cache_timestamp": datetime.utcnow().isoformat()
        }

        # Save to cache if enabled
        if use_cache and result.get("file_hash_sha256"):
            db_manager = get_database_manager_singleton()
            await db_manager.save_file_info_to_database_with_caching_and_version_tracking(
                file_path, result
            )

        # Calculate total processing time
        total_duration = (datetime.utcnow() - start_time).total_seconds()
        result["processing_comprehensive_stats"]["total_processing_duration_seconds"] = round(total_duration, 3)

        ColorPrint.green(f"[SUCCESS] File processing complete: {file_path} ({total_duration:.3f}s)")

        return result

    async def _detect_file_type_from_extension_and_mime(self, file_path: str) -> str:
        """Detect file type from extension and MIME type"""
        file_ext = Path(file_path).suffix.lower()

        if file_ext in self.IMAGE_EXTENSIONS:
            return "image"
        elif file_ext in self.PDF_EXTENSIONS:
            return "pdf"
        elif file_ext == '.docx':
            return "docx"
        elif file_ext == '.xlsx':
            return "xlsx"
        elif file_ext == '.pptx':
            return "pptx"
        else:
            # Try MIME type detection
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type:
                if mime_type.startswith('image/'):
                    return "image"
                elif mime_type == 'application/pdf':
                    return "pdf"
                elif 'wordprocessingml' in mime_type:
                    return "docx"
                elif 'spreadsheetml' in mime_type:
                    return "xlsx"
                elif 'presentationml' in mime_type:
                    return "pptx"

            return "unknown"

    async def _process_image_file_with_ocr_and_color_analysis(
        self,
        file_path: str,
        include_pixel_matrix: bool,
        ocr_model_type: str,
        num_colors: int
    ) -> Dict[str, Any]:
        """Process image file with comprehensive analysis"""
        image_analyzer = get_image_analyzer_singleton()

        result = await image_analyzer.extract_image_comprehensive_info_with_ocr_text_positions_color_palette_dimensions_and_pixel_analysis(
            image_path=file_path,
            include_pixel_matrix=include_pixel_matrix,
            ocr_model_type=ocr_model_type,
            num_colors=num_colors
        )

        return result

    async def _process_document_file_with_text_and_metadata_extraction(
        self,
        file_path: str,
        file_type: str,
        extract_images: bool,
        extract_tables: bool,
        extract_hyperlinks: bool
    ) -> Dict[str, Any]:
        """Process document file with comprehensive parsing"""
        document_parser = get_document_parser_singleton()

        result = await document_parser.parse_document_comprehensive_with_text_positions_metadata_images_tables_and_hyperlinks(
            document_path=file_path,
            extract_images=extract_images,
            extract_tables=extract_tables,
            extract_hyperlinks=extract_hyperlinks
        )

        return result

    async def _process_generic_file_with_basic_info(self, file_path: str) -> Dict[str, Any]:
        """Process generic file with basic information"""
        import os
        import hashlib

        file_size = os.path.getsize(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)

        # Calculate hash
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()

        return {
            "file_type": "unknown",
            "file_path": file_path,
            "file_size_bytes": file_size,
            "mime_type": mime_type or "unknown",
            "file_hash_sha256": file_hash,
            "processing_comprehensive_stats": {
                "processing_timestamp_utc": datetime.utcnow().isoformat(),
                "processing_duration_seconds": 0,
                "processing_methods_applied": ["basic_file_info"],
                "processing_engine_versions": {},
                "errors_and_warnings": [{
                    "severity": "warning",
                    "message": f"Unsupported file type, only basic info extracted",
                    "component": "file_info_extractor"
                }]
            }
        }


# Create singleton instance
_file_info_extractor_instance = None

def get_file_info_extractor_singleton() -> FileInfoExtractorWithOCRTextPositionsColorPaletteAndMetadata:
    """Get singleton instance of file info extractor"""
    global _file_info_extractor_instance
    if _file_info_extractor_instance is None:
        _file_info_extractor_instance = FileInfoExtractorWithOCRTextPositionsColorPaletteAndMetadata()
    return _file_info_extractor_instance


# Convenience function with long descriptive name
async def get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
    file_path: str,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main unified entry point for comprehensive file analysis

    See FileInfoExtractorWithOCRTextPositionsColorPaletteAndMetadata class for full documentation
    """
    extractor = get_file_info_extractor_singleton()
    return await extractor.get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
        file_path, options
    )


# Shorter alias for convenience
get_file_info_with_ocr_and_document_parsing = get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats
