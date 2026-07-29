#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Icon Analyzer - Comprehensive Icon Information Extraction

Provides unified interface for:
- Image metadata (size, dimensions, format, colors)
- OCR text recognition (position, confidence)
- Icon classification and feature detection
"""

import os
import sys
import logging
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_PIL_ImageStat

Image = get_third_package_PIL_Image()
ImageStat = get_third_package_PIL_ImageStat()

logger = logging.getLogger(__name__)


class IconAnalyzer:
    """
    Comprehensive icon analyzer that combines:
    - Image metadata extraction
    - OCR text recognition
    - Visual feature detection
    """

    SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.ico', '.tiff', '.tif'}

    def __init__(self, ocr_engine: Optional[Any] = None):
        """
        Initialize icon analyzer

        Args:
            ocr_engine: Optional OCR engine instance (FreeOCREngine, etc.)
        """
        self.ocr_engine = ocr_engine
        self._ocr_available = ocr_engine is not None

    def analyze_icon(
        self,
        image_path: str,
        include_ocr: bool = True,
        include_colors: bool = True,
        include_hash: bool = True,
        ocr_language: str = 'eng'
    ) -> Dict[str, Any]:
        """
        Comprehensive icon analysis

        Args:
            image_path: Path to icon/image file
            include_ocr: Include OCR text recognition
            include_colors: Include color analysis
            include_hash: Include image hash for deduplication
            ocr_language: Language for OCR (eng, chs, etc.)

        Returns:
            Dictionary with comprehensive icon information:
            {
                'success': bool,
                'file_info': {...},
                'image_info': {...},
                'ocr_results': {...},  # if include_ocr=True
                'color_info': {...},   # if include_colors=True
                'hash': str,           # if include_hash=True
                'error': str           # if success=False
            }
        """
        try:
            img_path = Path(image_path)

            # Validate file
            if not img_path.exists():
                return {
                    'success': False,
                    'error': f'File not found: {image_path}'
                }

            if img_path.suffix.lower() not in self.SUPPORTED_FORMATS:
                return {
                    'success': False,
                    'error': f'Unsupported format: {img_path.suffix}'
                }

            result = {
                'success': True,
                'file_info': self._get_file_info(img_path),
                'image_info': self._get_image_info(img_path)
            }

            # OCR text recognition
            if include_ocr and self._ocr_available:
                result['ocr_results'] = self._extract_ocr_text(image_path, ocr_language)
            elif include_ocr:
                result['ocr_results'] = {
                    'available': False,
                    'message': 'OCR engine not initialized'
                }

            # Color analysis
            if include_colors:
                result['color_info'] = self._analyze_colors(img_path)

            # Image hash
            if include_hash:
                result['hash'] = self._calculate_hash(img_path)

            logger.info(f"Icon analysis completed: {image_path}")
            return result

        except Exception as e:
            logger.error(f"Icon analysis failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_file_info(self, img_path: Path) -> Dict[str, Any]:
        """
        Extract file-level information

        Returns:
            {
                'path': str,
                'name': str,
                'extension': str,
                'size_bytes': int,
                'size_kb': float,
                'size_mb': float
            }
        """
        file_size = img_path.stat().st_size

        return {
            'path': str(img_path.absolute()),
            'name': img_path.name,
            'stem': img_path.stem,
            'extension': img_path.suffix.lower(),
            'size_bytes': file_size,
            'size_kb': round(file_size / 1024, 2),
            'size_mb': round(file_size / (1024 * 1024), 2),
            'parent_directory': str(img_path.parent)
        }

    def _get_image_info(self, img_path: Path) -> Dict[str, Any]:
        """
        Extract image-level information

        Returns:
            {
                'width': int,
                'height': int,
                'dimensions': str,
                'aspect_ratio': float,
                'format': str,
                'mode': str,
                'has_transparency': bool,
                'dpi': tuple,
                'total_pixels': int
            }
        """
        with Image.open(img_path) as img:
            width, height = img.size
            aspect_ratio = width / height if height > 0 else 0

            # Check for transparency
            has_transparency = (
                img.mode in ('RGBA', 'LA', 'PA') or
                (img.mode == 'P' and 'transparency' in img.info)
            )

            # Get DPI
            dpi = img.info.get('dpi', (0, 0))

            return {
                'width': width,
                'height': height,
                'dimensions': f"{width}x{height}",
                'aspect_ratio': round(aspect_ratio, 3),
                'aspect_ratio_str': self._get_aspect_ratio_str(aspect_ratio),
                'format': img.format or 'Unknown',
                'mode': img.mode,
                'has_transparency': has_transparency,
                'dpi': dpi,
                'total_pixels': width * height,
                'is_square': width == height,
                'is_landscape': width > height,
                'is_portrait': height > width
            }

    def _extract_ocr_text(self, image_path: str, language: str) -> Dict[str, Any]:
        """
        Extract text from image using OCR

        Returns:
            {
                'available': bool,
                'text': str,
                'confidence': float,
                'words': list[dict],
                'lines': list[dict],
                'provider': str,
                'language': str
            }
        """
        if not self._ocr_available or not self.ocr_engine:
            return {
                'available': False,
                'message': 'OCR not available'
            }

        try:
            # Assuming OCR engine has a recognize method
            ocr_result = self.ocr_engine.recognize(image_path, language=language)

            return {
                'available': True,
                'text': ocr_result.text if hasattr(ocr_result, 'text') else str(ocr_result),
                'confidence': getattr(ocr_result, 'confidence', 0.0),
                'words': getattr(ocr_result, 'words', []),
                'lines': getattr(ocr_result, 'lines', []),
                'provider': getattr(ocr_result, 'provider', 'unknown'),
                'language': language,
                'processing_time': getattr(ocr_result, 'processing_time', 0.0)
            }

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {
                'available': True,
                'error': str(e),
                'text': '',
                'confidence': 0.0
            }

    def _analyze_colors(self, img_path: Path) -> Dict[str, Any]:
        """
        Analyze color information

        Returns:
            {
                'dominant_color': tuple,
                'average_color': tuple,
                'color_palette': list[tuple],
                'brightness': float,
                'is_grayscale': bool,
                'unique_colors': int
            }
        """
        with Image.open(img_path) as img:
            # Convert to RGB for analysis
            if img.mode != 'RGB':
                img_rgb = img.convert('RGB')
            else:
                img_rgb = img

            # Get statistics
            stat = ImageStat.Stat(img_rgb)

            # Average color
            avg_color = tuple(int(x) for x in stat.mean)

            # Brightness (0-255)
            brightness = sum(avg_color) / 3

            # Check if grayscale (all RGB channels similar)
            is_grayscale = max(avg_color) - min(avg_color) < 10

            # Get unique colors (sample if too large)
            if img_rgb.width * img_rgb.height < 100000:
                colors = img_rgb.getcolors(maxcolors=img_rgb.width * img_rgb.height)
                unique_colors = len(colors) if colors else 0

                # Dominant color (most frequent)
                if colors:
                    dominant_color = max(colors, key=lambda x: x[0])[1]
                else:
                    dominant_color = avg_color
            else:
                unique_colors = -1  # Too many to count
                dominant_color = avg_color

            # Simple color palette (top 5 colors if available)
            color_palette = []
            if unique_colors > 0 and unique_colors <= 100000:
                sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)
                color_palette = [color[1] for color in sorted_colors[:5]]

            return {
                'dominant_color': dominant_color,
                'dominant_color_hex': '#{:02x}{:02x}{:02x}'.format(*dominant_color),
                'average_color': avg_color,
                'average_color_hex': '#{:02x}{:02x}{:02x}'.format(*avg_color),
                'color_palette': color_palette[:5],
                'color_palette_hex': ['#{:02x}{:02x}{:02x}'.format(*c) for c in color_palette[:5]],
                'brightness': round(brightness, 2),
                'brightness_percent': round(brightness / 255 * 100, 2),
                'is_grayscale': is_grayscale,
                'unique_colors': unique_colors if unique_colors > 0 else 'many',
                'std_dev': [round(x, 2) for x in stat.stddev]
            }

    def _calculate_hash(self, img_path: Path) -> str:
        """
        Calculate perceptual hash for image deduplication

        Returns:
            MD5 hash of image content
        """
        try:
            with Image.open(img_path) as img:
                # Resize to 8x8 for perceptual hashing
                img_small = img.resize((8, 8), Image.Resampling.LANCZOS).convert('L')

                # Get pixel data
                pixels = list(img_small.getdata())

                # Calculate average
                avg = sum(pixels) / len(pixels)

                # Create binary hash
                bits = ''.join(['1' if p > avg else '0' for p in pixels])

                # Convert to hex
                phash = hex(int(bits, 2))[2:].zfill(16)

                # Also calculate MD5 for exact match
                md5 = hashlib.md5()
                md5.update(img.tobytes())
                md5_hash = md5.hexdigest()

                return {
                    'perceptual_hash': phash,
                    'md5_hash': md5_hash
                }

        except Exception as e:
            logger.error(f"Hash calculation failed: {e}")
            return {
                'perceptual_hash': 'error',
                'md5_hash': 'error',
                'error': str(e)
            }

    def _get_aspect_ratio_str(self, ratio: float) -> str:
        """
        Convert aspect ratio to common string format

        Args:
            ratio: Numeric aspect ratio (width/height)

        Returns:
            String like "16:9", "4:3", "1:1", etc.
        """
        common_ratios = {
            1.0: "1:1",
            1.333: "4:3",
            1.5: "3:2",
            1.6: "16:10",
            1.777: "16:9",
            2.0: "2:1",
            0.75: "3:4",
            0.666: "2:3"
        }

        # Find closest match
        closest = min(common_ratios.keys(), key=lambda x: abs(x - ratio))

        if abs(closest - ratio) < 0.05:
            return common_ratios[closest]
        else:
            return f"{ratio:.2f}:1"

    def batch_analyze(
        self,
        image_paths: List[str],
        include_ocr: bool = False,
        include_colors: bool = True,
        include_hash: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze multiple icons in batch

        Args:
            image_paths: List of image paths
            include_ocr: Include OCR analysis
            include_colors: Include color analysis
            include_hash: Include hash calculation

        Returns:
            {
                'success': bool,
                'total': int,
                'analyzed': int,
                'failed': int,
                'results': list[dict],
                'errors': list[dict]
            }
        """
        results = []
        errors = []

        for img_path in image_paths:
            result = self.analyze_icon(
                img_path,
                include_ocr=include_ocr,
                include_colors=include_colors,
                include_hash=include_hash
            )

            if result['success']:
                results.append(result)
            else:
                errors.append({
                    'path': img_path,
                    'error': result.get('error', 'Unknown error')
                })

        return {
            'success': True,
            'total': len(image_paths),
            'analyzed': len(results),
            'failed': len(errors),
            'results': results,
            'errors': errors
        }

    def find_similar_icons(
        self,
        target_image: str,
        candidate_images: List[str],
        threshold: float = 0.9
    ) -> List[Dict[str, Any]]:
        """
        Find similar icons using perceptual hashing

        Args:
            target_image: Target icon path
            candidate_images: List of candidate icon paths
            threshold: Similarity threshold (0-1)

        Returns:
            List of similar icons with similarity scores
        """
        try:
            # Get target hash
            target_info = self.analyze_icon(target_image, include_ocr=False, include_colors=False)
            if not target_info['success']:
                return []

            target_hash = target_info['hash']['perceptual_hash']

            similar = []

            for candidate in candidate_images:
                cand_info = self.analyze_icon(candidate, include_ocr=False, include_colors=False)

                if not cand_info['success']:
                    continue

                cand_hash = cand_info['hash']['perceptual_hash']

                # Calculate Hamming distance
                if target_hash != 'error' and cand_hash != 'error':
                    distance = sum(c1 != c2 for c1, c2 in zip(target_hash, cand_hash))
                    max_distance = len(target_hash)
                    similarity = 1 - (distance / max_distance)

                    if similarity >= threshold:
                        similar.append({
                            'path': candidate,
                            'similarity': round(similarity, 3),
                            'distance': distance,
                            'file_info': cand_info['file_info'],
                            'image_info': cand_info['image_info']
                        })

            # Sort by similarity
            similar.sort(key=lambda x: x['similarity'], reverse=True)

            return similar

        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []


def create_icon_analyzer(ocr_engine: Optional[Any] = None) -> IconAnalyzer:
    """
    Factory function to create IconAnalyzer instance

    Args:
        ocr_engine: Optional OCR engine instance

    Returns:
        IconAnalyzer instance
    """
    return IconAnalyzer(ocr_engine=ocr_engine)
