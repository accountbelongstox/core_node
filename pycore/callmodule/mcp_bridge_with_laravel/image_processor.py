#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Intelligent Image Processing for OCR
Smart image compression, resizing, and optimization
"""

import os
import io
import logging
import tempfile
import math
from typing import Tuple, Optional, Dict, Any
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_PIL_ImageEnhance, get_third_package_PIL_ImageFilter

Image = get_third_package_PIL_Image()
ImageEnhance = get_third_package_PIL_ImageEnhance()
ImageFilter = get_third_package_PIL_ImageFilter()

from ocr_config import OCRLimits, ProcessingConfig

logger = logging.getLogger(__name__)

class SmartImageProcessor:
    """Intelligent image processor for OCR optimization"""

    def __init__(self):
        self.limits = OCRLimits()
        self.config = ProcessingConfig()
        self.temp_files = []  # Track temporary files for cleanup

    def process_for_ocr(self, image_path: str, target_engine: str = "free") -> Tuple[str, Dict[str, Any]]:
        """
        Process image for optimal OCR recognition

        Args:
            image_path: Path to input image
            target_engine: Target OCR engine ("free" or "tencent")

        Returns:
            Tuple of (processed_image_path, processing_info)
        """
        try:
            logger.info(f"Processing image for {target_engine} OCR: {image_path}")

            # Get engine limits
            engine_limits = self.limits.FREE_OCR if target_engine == "free" else self.limits.TENCENT_OCR

            # Load and analyze image
            with Image.open(image_path) as img:
                original_info = self._get_image_info(img, image_path)
                logger.info(f"Original image: {original_info['width']}x{original_info['height']}, "
                          f"size: {original_info['file_size']} bytes, format: {original_info['format']}")

                # Check if processing is needed
                processing_info = {
                    "original_size": original_info['file_size'],
                    "original_resolution": (original_info['width'], original_info['height']),
                    "original_format": original_info['format'],
                    "processing_applied": [],
                    "final_size": 0,
                    "final_resolution": (0, 0),
                    "compression_ratio": 0,
                    "engine_target": target_engine
                }

                # Determine if processing is needed
                needs_processing = self._needs_processing(original_info, engine_limits)

                if not needs_processing:
                    logger.info("Image meets OCR requirements, no processing needed")
                    processing_info["processing_applied"] = ["none"]
                    processing_info["final_size"] = original_info['file_size']
                    processing_info["final_resolution"] = (original_info['width'], original_info['height'])
                    return image_path, processing_info

                # Process image
                processed_img = self._optimize_image(img, engine_limits, processing_info)

                # Save processed image
                output_path = self._save_processed_image(processed_img, image_path, engine_limits)
                self.temp_files.append(output_path)

                # Update final processing info
                with Image.open(output_path) as final_img:
                    final_size = os.path.getsize(output_path)
                    processing_info["final_size"] = final_size
                    processing_info["final_resolution"] = final_img.size
                    processing_info["compression_ratio"] = (
                        (original_info['file_size'] - final_size) / original_info['file_size'] * 100
                        if original_info['file_size'] > 0 else 0
                    )

                logger.info(f"Image processed: {final_img.size}, size: {final_size} bytes, "
                          f"compression: {processing_info['compression_ratio']:.1f}%")

                return output_path, processing_info

        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            raise

    def _get_image_info(self, img: Image.Image, file_path: str) -> Dict[str, Any]:
        """Get comprehensive image information"""
        return {
            "width": img.width,
            "height": img.height,
            "format": img.format,
            "mode": img.mode,
            "file_size": os.path.getsize(file_path),
            "has_transparency": img.mode in ('RGBA', 'LA') or 'transparency' in img.info,
            "dpi": img.info.get('dpi', (72, 72)),
            "aspect_ratio": img.width / img.height if img.height > 0 else 1
        }

    def _needs_processing(self, image_info: Dict[str, Any], engine_limits: Dict[str, Any]) -> bool:
        """Determine if image needs processing"""
        file_size = image_info['file_size']
        width, height = image_info['width'], image_info['height']
        max_width, max_height = engine_limits['max_image_resolution']

        # Check file size
        if file_size > engine_limits['file_size_limit']:
            return True

        # Check resolution
        if width > max_width or height > max_height:
            return True

        # Check format optimization potential
        if image_info['format'] not in ['JPEG', 'JPG'] and file_size > 100 * 1024:  # > 100KB
            return True

        return False

    def _optimize_image(self, img: Image.Image, engine_limits: Dict[str, Any],
                       processing_info: Dict[str, Any]) -> Image.Image:
        """Optimize image for OCR processing"""
        processed_img = img.copy()

        # 1. Resize if necessary
        processed_img = self._resize_image(processed_img, engine_limits, processing_info)

        # 2. Enhance for OCR
        processed_img = self._enhance_for_ocr(processed_img, processing_info)

        # 3. Convert format if needed
        processed_img = self._optimize_format(processed_img, processing_info)

        return processed_img

    def _resize_image(self, img: Image.Image, engine_limits: Dict[str, Any],
                     processing_info: Dict[str, Any]) -> Image.Image:
        """Intelligently resize image while preserving OCR quality"""
        max_width, max_height = engine_limits['max_image_resolution']
        current_width, current_height = img.size

        if current_width <= max_width and current_height <= max_height:
            return img

        # Calculate optimal resize ratio
        width_ratio = max_width / current_width
        height_ratio = max_height / current_height
        resize_ratio = min(width_ratio, height_ratio)

        # Ensure minimum readable size (text should be at least 12px high)
        min_dimension = max(64, min(max_width, max_height) // 20)
        if min(current_width * resize_ratio, current_height * resize_ratio) < min_dimension:
            # Adjust ratio to maintain readability
            resize_ratio = min_dimension / min(current_width, current_height)

        new_width = int(current_width * resize_ratio)
        new_height = int(current_height * resize_ratio)

        # Use high-quality resampling for OCR
        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        processing_info["processing_applied"].append(
            f"resize_{current_width}x{current_height}_to_{new_width}x{new_height}"
        )
        logger.info(f"Resized image: {current_width}x{current_height} -> {new_width}x{new_height}")

        return resized_img

    def _enhance_for_ocr(self, img: Image.Image, processing_info: Dict[str, Any]) -> Image.Image:
        """Enhance image quality for better OCR results"""
        enhanced_img = img

        try:
            # Convert to RGB if necessary
            if enhanced_img.mode not in ('RGB', 'L'):
                enhanced_img = enhanced_img.convert('RGB')
                processing_info["processing_applied"].append("convert_to_rgb")

            # Enhance contrast slightly for better text recognition
            enhancer = ImageEnhance.Contrast(enhanced_img)
            enhanced_img = enhancer.enhance(1.1)  # Slight contrast boost

            # Enhance sharpness for clearer text
            enhancer = ImageEnhance.Sharpness(enhanced_img)
            enhanced_img = enhancer.enhance(1.1)  # Slight sharpness boost

            processing_info["processing_applied"].append("enhance_contrast_sharpness")

        except Exception as e:
            logger.warning(f"Image enhancement failed: {e}")

        return enhanced_img

    def _optimize_format(self, img: Image.Image, processing_info: Dict[str, Any]) -> Image.Image:
        """Optimize image format for OCR"""
        # For OCR, we generally want RGB images
        if img.mode == 'RGBA':
            # Create white background for transparency
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
            img = background
            processing_info["processing_applied"].append("remove_transparency")

        elif img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
            processing_info["processing_applied"].append("convert_format")

        return img

    def _save_processed_image(self, img: Image.Image, original_path: str,
                            engine_limits: Dict[str, Any]) -> str:
        """Save processed image with optimal compression"""
        # Generate output path
        original_name = Path(original_path).stem
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, f"{original_name}_processed_ocr.jpg")

        # Determine optimal quality for target file size
        target_size = engine_limits['file_size_limit']
        quality = self._find_optimal_quality(img, target_size)

        # Save with optimization
        save_kwargs = {
            'format': 'JPEG',
            'quality': quality,
            'optimize': True,
            'progressive': True
        }

        img.save(output_path, **save_kwargs)

        # Verify file size
        actual_size = os.path.getsize(output_path)
        if actual_size > target_size:
            # Try again with lower quality
            quality = max(50, quality - 10)
            img.save(output_path, format='JPEG', quality=quality, optimize=True)
            logger.warning(f"Reduced quality to {quality} to meet size limit")

        return output_path

    def _find_optimal_quality(self, img: Image.Image, target_size: int) -> int:
        """Find optimal JPEG quality to meet target file size"""
        # Test different quality levels
        quality_levels = [95, 85, 75, 65, 55, 45]

        for quality in quality_levels:
            # Test save to memory
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=quality, optimize=True)
            test_size = buffer.tell()

            if test_size <= target_size:
                return quality

        # If still too large, use minimum quality
        return 40

    def estimate_processing_time(self, image_path: str, target_engine: str = "free") -> float:
        """Estimate processing time for image"""
        try:
            with Image.open(image_path) as img:
                pixels = img.width * img.height
                file_size = os.path.getsize(image_path)

                # Base time estimates (seconds)
                base_time = 0.1
                pixel_factor = pixels / (1920 * 1080) * 0.5  # Reference: 1080p
                size_factor = file_size / (1024 * 1024) * 0.2  # Reference: 1MB

                return base_time + pixel_factor + size_factor

        except Exception:
            return 1.0  # Default estimate

    def cleanup_temp_files(self):
        """Clean up temporary files created during processing"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
                    logger.debug(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")

        self.temp_files.clear()

    def __del__(self):
        """Cleanup on object destruction"""
        self.cleanup_temp_files()
