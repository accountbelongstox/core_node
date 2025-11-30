#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Analyzer with OCR, Color Extraction, and Pixel Matrix
Comprehensive image analysis including OCR text positions, color palette, and pixel data
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw, get_third_package_PIL_ImageFont, get_third_package_numpy

PIL_Image = get_third_package_PIL_Image()
PIL_ImageDraw = get_third_package_PIL_ImageDraw()
PIL_ImageFont = get_third_package_PIL_ImageFont()
numpy = get_third_package_numpy()
from pycore.pyutils.ocr import ocr_manager
from pycore.pyutils.mcp.file_processing.color_palette_extractor_with_dominant_colors_and_histogram import (
    get_color_extractor_singleton
)

logger = logging.getLogger(__name__)


class ImageAnalyzerWithOCRColorExtractionAndPixelMatrix:
    """Comprehensive image analyzer with OCR, color analysis, and pixel matrix extraction"""

    async def extract_image_comprehensive_info_with_ocr_text_positions_color_palette_dimensions_and_pixel_analysis(
        self,
        image_path: str,
        include_pixel_matrix: bool = False,
        ocr_model_type: str = "general",
        num_colors: int = 10
    ) -> Dict[str, Any]:
        """
        Extract comprehensive image information including OCR, color palette, and pixel analysis

        Args:
            image_path: Path to image file
            include_pixel_matrix: Whether to include full pixel matrix data
            ocr_model_type: OCR model type (scene, doc, number, general, english, chinese_traditional)
            num_colors: Number of dominant colors to extract

        Returns:
            Comprehensive image analysis dictionary
        """
        start_time = datetime.utcnow()
        processing_methods_applied = []

        with PIL_Image.open(image_path) as img:
            # Extract basic image metadata
            image_metadata = await self._extract_image_metadata_with_dimensions_format_and_mode(img, image_path)
            processing_methods_applied.append("image_metadata_extraction")

            # Perform OCR text extraction with bounding boxes
            ocr_results = await self._perform_optical_character_recognition_with_bounding_boxes_confidence_scores_and_language_detection(
                image_path, ocr_model_type
            )
            processing_methods_applied.append("ocr_text_extraction")

            # Extract color palette analysis
            color_extractor = get_color_extractor_singleton()
            color_palette_analysis = await color_extractor.extract_color_palette_with_dominant_colors_histogram_statistics_and_brightness_analysis(
                image_path, num_colors
            )
            processing_methods_applied.append("color_palette_analysis")

            # Optional pixel matrix extraction
            pixel_matrix_data = {"available": False}
            if include_pixel_matrix:
                pixel_matrix_data = await self._analyze_pixel_data_and_generate_color_matrix_with_rgb_values(img)
                processing_methods_applied.append("pixel_matrix_extraction")

            # Calculate processing stats
            processing_duration = (datetime.utcnow() - start_time).total_seconds()

            return {
                "file_type": "image",
                "file_path": image_path,
                "image_comprehensive_analysis": {
                    "dimensions": image_metadata["dimensions"],
                    "format_info": image_metadata["format_info"],
                    "ocr_full_text_extraction": ocr_results["full_text_extraction"],
                    "ocr_text_with_bounding_box_positions": ocr_results["text_with_positions"],
                    "color_palette_analysis": color_palette_analysis,
                    "pixel_matrix_data_optional": pixel_matrix_data
                },
                "processing_comprehensive_stats": {
                    "processing_timestamp_utc": start_time.isoformat(),
                    "processing_duration_seconds": round(processing_duration, 3),
                    "processing_methods_applied": processing_methods_applied,
                    "processing_engine_versions": {
                        "ocr_engine": "cnocr",
                        "image_processor": "PIL",
                        "color_analyzer": "sklearn_kmeans"
                    },
                    "errors_and_warnings": []
                }
            }

    async def _extract_image_metadata_with_dimensions_format_and_mode(
        self, img: PIL_Image.Image, image_path: str
    ) -> Dict[str, Any]:
        """Extract basic image metadata including dimensions, format, and mode"""
        width, height = img.size

        # Determine color depth
        mode_to_bits = {
            '1': 1,
            'L': 8,
            'P': 8,
            'RGB': 24,
            'RGBA': 32,
            'CMYK': 32,
            'YCbCr': 24,
            'LAB': 24,
            'HSV': 24,
            'I': 32,
            'F': 32
        }
        color_depth = mode_to_bits.get(img.mode, 8)

        # Check transparency
        has_transparency = img.mode in ('RGBA', 'LA', 'PA') or (
            img.mode == 'P' and 'transparency' in img.info
        )

        # Calculate file size
        import os
        file_size_bytes = os.path.getsize(image_path)

        # Calculate file hash
        file_hash = await self._calculate_file_hash_sha256(image_path)

        return {
            "dimensions": {
                "width_pixels": width,
                "height_pixels": height,
                "aspect_ratio": round(width / height, 3) if height > 0 else 0
            },
            "format_info": {
                "format": img.format or "Unknown",
                "mode": img.mode,
                "color_depth_bits": color_depth,
                "has_transparency": has_transparency
            },
            "file_size_bytes": file_size_bytes,
            "file_hash_sha256": file_hash
        }

    async def _perform_optical_character_recognition_with_bounding_boxes_confidence_scores_and_language_detection(
        self, image_path: str, model_type: str = "general"
    ) -> Dict[str, Any]:
        """Perform OCR with bounding boxes and confidence scores"""
        # Use existing OCR manager singleton
        ocr_result = ocr_manager.recognize_image(image_path, model_type=model_type, return_json=False)

        # Process OCR result
        full_text = ocr_result.get("text", "")
        confidence_average = ocr_result.get("confidence", 0.0)
        words_data = ocr_result.get("words", [])

        # Format text positions with bounding boxes
        text_with_positions = []
        line_number = 1
        word_index = 0

        for word_data in words_data:
            # Extract bounding box coordinates
            position = word_data.get("position", [[0, 0], [0, 0], [0, 0], [0, 0]])

            # Calculate bounding box (x1, y1, x2, y2)
            x_coords = [p[0] for p in position]
            y_coords = [p[1] for p in position]
            x1, x2 = min(x_coords), max(x_coords)
            y1, y2 = min(y_coords), max(y_coords)

            text_with_positions.append({
                "text": word_data.get("text", ""),
                "bounding_box_coordinates": {
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2)
                },
                "confidence_score": round(word_data.get("score", 0.0), 3),
                "line_number": line_number,
                "word_index": word_index
            })
            word_index += 1

        # Calculate word and character counts
        total_words = len(full_text.split()) if full_text else 0
        total_characters = len(full_text)

        return {
            "full_text_extraction": {
                "full_text": full_text,
                "total_characters": total_characters,
                "total_words": total_words,
                "language_detected": "auto",  # CnOCR auto-detects
                "confidence_average": round(confidence_average, 3)
            },
            "text_with_positions": text_with_positions
        }

    async def _analyze_pixel_data_and_generate_color_matrix_with_rgb_values(
        self, img: PIL_Image.Image
    ) -> Dict[str, Any]:
        """Generate pixel matrix with RGB values (optional, can be large)"""
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img_rgb = img.convert('RGB')
        else:
            img_rgb = img

        # Get numpy array
        img_array = numpy.array(img_rgb)
        height, width, channels = img_array.shape

        # For large images, only return sample data
        include_full_matrix = width * height < 1000000  # Only include if < 1 megapixel

        result = {
            "available": True,
            "dimensions": [width, height],
            "channels": channels
        }

        if include_full_matrix:
            result["full_matrix"] = img_array.tolist()
        else:
            # Return sample data (center 100x100 pixels)
            center_x, center_y = width // 2, height // 2
            sample_size = 50
            x1 = max(0, center_x - sample_size)
            y1 = max(0, center_y - sample_size)
            x2 = min(width, center_x + sample_size)
            y2 = min(height, center_y + sample_size)

            sample_data = img_array[y1:y2, x1:x2].tolist()
            result["sample_data"] = sample_data
            result["sample_region"] = {
                "x1": int(x1), "y1": int(y1),
                "x2": int(x2), "y2": int(y2)
            }
            logger.warning("[WARNING] Image too large (%sx%s), returning sample pixel data only", width, height)

        return result

    async def _calculate_file_hash_sha256(self, file_path: str) -> str:
        """Calculate SHA256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()


_image_analyzer_instance = None

def get_image_analyzer_singleton() -> ImageAnalyzerWithOCRColorExtractionAndPixelMatrix:
    """Get singleton instance of image analyzer"""
    global _image_analyzer_instance
    if _image_analyzer_instance is None:
        _image_analyzer_instance = ImageAnalyzerWithOCRColorExtractionAndPixelMatrix()
    return _image_analyzer_instance
