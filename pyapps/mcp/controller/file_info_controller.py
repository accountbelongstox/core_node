#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Info Controller - Organizational Logic Only
Thin wrapper around pycore utilities for MCP protocol
"""

from typing import Dict, Any, Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.mcp.file_processing import (
    get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats
)
from pycore.pyutils.mcp.file_processing.placeholder_image_generator_with_ocr_based_replacement import (
    get_placeholder_generator_singleton
)
from pycore.pyutils.mcp.file_processing.database_manager_for_file_info_caching_and_history import (
    get_database_manager_singleton
)


class FileInfoController:
    """
    File information controller for MCP tools
    Provides organizational logic and routing to pycore utilities
    """

    def __init__(self):
        """Initialize controller"""
        self.placeholder_generator = get_placeholder_generator_singleton()
        self.db_manager = get_database_manager_singleton()
        ColorPrint.green("[INFO] FileInfoController initialized")

    async def get_file_info_with_comprehensive_analysis(
        self,
        file_path: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive file information (routes to pycore)

        Args:
            file_path: Path to file to analyze
            options: Analysis options

        Returns:
            Comprehensive file information dictionary
        """
        ColorPrint.blue(f"[CONTROLLER] Processing file: {file_path}")

        # Call pycore utility
        result = await get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
            file_path=file_path,
            options=options
        )

        ColorPrint.green(f"[CONTROLLER] File processing complete: {file_path}")
        return result

    async def generate_placeholder_image(
        self,
        original_image_path: str,
        output_path: str,
        placeholder_text: Optional[str] = None,
        style_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate placeholder image (routes to pycore)

        Args:
            original_image_path: Path to original image
            output_path: Path to save placeholder
            placeholder_text: Override text
            style_options: Style configuration

        Returns:
            Generation results
        """
        ColorPrint.blue(f"[CONTROLLER] Generating placeholder: {original_image_path} -> {output_path}")

        result = await self.placeholder_generator.generate_placeholder_image_with_ocr_text_replacement_and_custom_styling(
            original_image_path=original_image_path,
            output_path=output_path,
            placeholder_text=placeholder_text,
            style_options=style_options
        )

        if result.get("success"):
            ColorPrint.green(f"[CONTROLLER] Placeholder generated successfully")
        else:
            ColorPrint.red(f"[CONTROLLER] Placeholder generation failed: {result.get('error')}")

        return result

    async def query_processing_history(
        self,
        file_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Query file processing history (routes to pycore)

        Args:
            file_type: Filter by file type
            date_from: Start date filter
            date_to: End date filter
            limit: Maximum results
            offset: Pagination offset

        Returns:
            Query results with pagination
        """
        ColorPrint.blue(f"[CONTROLLER] Querying processing history (type={file_type}, limit={limit})")

        result = await self.db_manager.query_file_processing_history_with_filters_and_pagination(
            file_type=file_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset
        )

        ColorPrint.green(f"[CONTROLLER] Query complete: {len(result.get('results', []))} results")
        return result

    async def clear_cache(self, file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Clear cached file information (routes to pycore)

        Args:
            file_path: Specific file to clear (None = clear all)

        Returns:
            Operation results
        """
        if file_path:
            ColorPrint.yellow(f"[CONTROLLER] Clearing cache for: {file_path}")
        else:
            ColorPrint.yellow(f"[CONTROLLER] WARNING: Clearing ALL cache entries")

        # For now, return a simple response
        # Full implementation would call db_manager methods
        return {
            "success": True,
            "message": "Cache clear operation not fully implemented",
            "file_path": file_path
        }


# Singleton instance
_file_info_controller_singleton = None


def get_file_info_controller_singleton() -> FileInfoController:
    """Get or create the singleton FileInfoController instance"""
    global _file_info_controller_singleton
    if _file_info_controller_singleton is None:
        _file_info_controller_singleton = FileInfoController()
    return _file_info_controller_singleton
