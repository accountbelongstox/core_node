#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Placeholder Image Generator with OCR-Based Replacement
Generate placeholder images using OCR text from original images
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
    get_third_package_numpy,
)

PIL_Image = get_third_package_PIL_Image()
PIL_ImageDraw = get_third_package_PIL_ImageDraw()
PIL_ImageFont = get_third_package_PIL_ImageFont()
numpy = get_third_package_numpy()
from pycore.pyfoundations.pygvar import PYTOOLS_TMP_DIR
from pycore.pyutils.common.ocr.manager import ocr_manager

logger = logging.getLogger(__name__)


class PlaceholderImageGeneratorWithOCRBasedReplacement:
    """Generate placeholder images with OCR text from original images"""

    async def generate_placeholder_image_with_ocr_text_replacement_and_custom_styling(
        self,
        original_image_path: str,
        output_path: str,
        placeholder_text: Optional[str] = None,
        style_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate placeholder image using OCR text from original

        Args:
            original_image_path: Path to original image
            output_path: Path to save placeholder image
            placeholder_text: Override text (if None, use OCR)
            style_options: Style configuration with keys:
                - background_color: Background color (default: "#CCCCCC")
                - text_color: Text color (default: "#333333")
                - font_size: Font size (default: 20)
                - padding: Padding around text (default: 20)
                - max_text_length: Maximum text length (default: 100)

        Returns:
            Dictionary with generation results
        """
        start_time = datetime.utcnow()

        # Parse style options
        style_options = style_options or {}
        background_color = style_options.get("background_color", "#CCCCCC")
        text_color = style_options.get("text_color", "#333333")
        font_size = style_options.get("font_size", 20)
        padding = style_options.get("padding", 20)
        max_text_length = style_options.get("max_text_length", 100)

        # Get original image dimensions
        with PIL_Image.open(original_image_path) as original_img:
            width, height = original_img.size

        # Get text from OCR if not provided
        if placeholder_text is None:
            logger.info("Performing OCR on original image: %s", original_image_path)
            ocr_result = ocr_manager.recognize_image(original_image_path, model_type="general")
            placeholder_text = ocr_result.get("text", "")

            # Truncate if too long
            if len(placeholder_text) > max_text_length:
                placeholder_text = placeholder_text[:max_text_length] + "..."

            # Fallback if no text detected
            if not placeholder_text.strip():
                placeholder_text = f"Placeholder {width}x{height}"

        logger.info("Placeholder text: %s", placeholder_text[:50])

        # Create placeholder image
        placeholder_img = PIL_Image.new('RGB', (width, height), color=background_color)
        draw = PIL_ImageDraw.Draw(placeholder_img)

        # Try to use a default font, fallback to default if not available
        font = PIL_ImageFont.load_default()

        # Calculate text position (centered)
        text_bbox = draw.textbbox((0, 0), placeholder_text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]

        x = (width - text_width) // 2
        y = (height - text_height) // 2

        # Draw text
        draw.text((x, y), placeholder_text, fill=text_color, font=font)

        # Save placeholder image
        placeholder_img.save(output_path)

        processing_duration = (datetime.utcnow() - start_time).total_seconds()

        logger.debug("Placeholder image generated: %s", output_path)

        return {
            "success": True,
            "original_image_path": original_image_path,
            "placeholder_image_path": output_path,
            "placeholder_text": placeholder_text,
            "dimensions": {
                "width": width,
                "height": height
            },
            "style_used": {
                "background_color": background_color,
                "text_color": text_color,
                "font_size": font_size
            },
            "processing_stats": {
                "processing_timestamp_utc": start_time.isoformat(),
                "processing_duration_seconds": round(processing_duration, 3)
            }
        }

    async def replace_images_in_document_with_ocr_based_placeholder_generation(
        self,
        document_path: str,
        output_path: str,
        style_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Replace all images in document with OCR-based placeholders

        Args:
            document_path: Path to document (PDF, DOCX, etc.)
            output_path: Path to save modified document
            style_options: Style configuration for placeholders

        Returns:
            Dictionary with replacement results
        """
        start_time = datetime.utcnow()

        # Detect document type
        file_ext = Path(document_path).suffix.lower()

        if file_ext == '.pdf':
            result = await self._replace_pdf_images_with_placeholders(
                document_path, output_path, style_options
            )
        elif file_ext == '.docx':
            result = await self._replace_docx_images_with_placeholders(
                document_path, output_path, style_options
            )
        else:
            logger.error("Unsupported document type for image replacement: %s", file_ext)
            return {
                "success": False,
                "error": f"Unsupported document type: {file_ext}"
            }

        processing_duration = (datetime.utcnow() - start_time).total_seconds()
        result["processing_stats"]["total_processing_duration_seconds"] = round(processing_duration, 3)

        return result

    async def _replace_pdf_images_with_placeholders(
        self,
        pdf_path: str,
        output_path: str,
        style_options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Replace images in PDF with placeholders"""
        logger.warning("PDF image replacement not fully implemented")
        return {
            "success": False,
            "error": "PDF image replacement not implemented",
            "processing_stats": {
                "processing_timestamp_utc": datetime.utcnow().isoformat(),
                "processing_duration_seconds": 0
            }
        }

    async def _replace_docx_images_with_placeholders(
        self,
        docx_path: str,
        output_path: str,
        style_options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Replace images in DOCX with placeholders"""
        logger.warning("DOCX image replacement not fully implemented")
        return {
            "success": False,
            "error": "DOCX image replacement not implemented",
            "processing_stats": {
                "processing_timestamp_utc": datetime.utcnow().isoformat(),
                "processing_duration_seconds": 0
            }
        }


_PLACEHOLDER_GENERATOR_PROVIDER = SerializedSingletonProvider(
    PlaceholderImageGeneratorWithOCRBasedReplacement,
    "mcp.placeholder_generator.provider",
    "MCPPlaceholderGeneratorProviderThread",
)

def get_placeholder_generator_singleton() -> PlaceholderImageGeneratorWithOCRBasedReplacement:
    """Get singleton instance of placeholder image generator"""
    return _PLACEHOLDER_GENERATOR_PROVIDER.get()
