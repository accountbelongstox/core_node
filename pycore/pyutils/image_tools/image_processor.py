#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced Image Processing Tools
Comprehensive image manipulation: crop, split, transform, compress, merge, text overlay

This module is the public facade of the image_tools subpackage. The split/crop
operations live in image_split.py and the geometry/merge transforms live in
image_transform.py; the ImageTools class below delegates to them, preserving
the original public method API. compress_image, add_text_to_image and
apply_filter are kept inline here.

Public API:
    ImageTools            - image processing toolkit class
    image_tools           - module singleton instance of ImageTools
"""

import os
import logging
from typing import Tuple, Optional, Dict, Any, List, Union
from pathlib import Path

from pycore.pyfoundations.third_party import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
    get_third_package_PIL_ImageEnhance,
    get_third_package_PIL_ImageFilter,
    get_third_package_PIL_ImageOps,
)

from . import image_split, image_transform

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()
ImageEnhance = get_third_package_PIL_ImageEnhance()
ImageFilter = get_third_package_PIL_ImageFilter()
ImageOps = get_third_package_PIL_ImageOps()

logger = logging.getLogger(__name__)


class ImageTools:
    """Advanced image processing toolkit"""

    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.gif'}
    DEFAULT_QUALITY = 85
    DEFAULT_FORMAT = 'PNG'

    def __init__(self):
        self.temp_files = []

    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    logger.debug(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Failed to clean temp file {temp_file}: {e}")
        self.temp_files.clear()

    def _validate_image_path(self, path: str) -> Path:
        """Validate image path and format"""
        img_path = Path(path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        if img_path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {img_path.suffix}. Supported: {self.SUPPORTED_FORMATS}")
        return img_path

    def _get_output_path(self, input_path: str, output_path: Optional[str], suffix: str = "") -> str:
        """Generate output path"""
        if output_path:
            return output_path

        input_p = Path(input_path)
        if suffix:
            return str(input_p.parent / f"{input_p.stem}{suffix}{input_p.suffix}")
        else:
            return str(input_p.parent / f"{input_p.stem}_processed{input_p.suffix}")

    # ==================== CROP & SPLIT (delegate to image_split) ====================

    def split_image_equal(
        self,
        image_path: str,
        count: int,
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """Split image into equal parts (auto-detect sprite size)"""
        return image_split.split_image_equal(self, image_path, count, direction, output_dir, name_pattern)

    def split_image_custom(
        self,
        image_path: str,
        split_points: List[int],
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """Split image at custom points"""
        return image_split.split_image_custom(self, image_path, split_points, direction, output_dir, name_pattern)

    def create_image_grid(
        self,
        image_paths: List[str],
        cols: int,
        output_path: str,
        spacing: int = 0,
        background_color: Union[str, Tuple[int, int, int]] = "white",
        cell_width: Optional[int] = None,
        cell_height: Optional[int] = None,
        resize_mode: str = "fit"
    ) -> Dict[str, Any]:
        """Create image grid/collage from multiple images"""
        return image_split.create_image_grid(
            self, image_paths, cols, output_path, spacing, background_color,
            cell_width, cell_height, resize_mode
        )

    def crop_image(
        self,
        image_path: str,
        x: int,
        y: int,
        width: int,
        height: int,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Crop image to specified rectangle"""
        return image_split.crop_image(self, image_path, x, y, width, height, output_path)

    def split_image_grid(
        self,
        image_path: str,
        rows: int,
        cols: int,
        output_dir: Optional[str] = None,
        name_pattern: str = "tile_{row}_{col}"
    ) -> Dict[str, Any]:
        """Split image into grid (rows x cols)"""
        return image_split.split_image_grid(self, image_path, rows, cols, output_dir, name_pattern)

    def split_sprite_sheet(
        self,
        image_path: str,
        sprite_width: int,
        sprite_height: int,
        output_dir: Optional[str] = None,
        name_pattern: str = "sprite_{index}",
        direction: str = "horizontal"
    ) -> Dict[str, Any]:
        """Split sprite sheet into individual sprites"""
        return image_split.split_sprite_sheet(
            self, image_path, sprite_width, sprite_height, output_dir, name_pattern, direction
        )

    # ==================== GEOMETRY TRANSFORMS & MERGE (delegate to image_transform) ====================

    def resize_image(
        self,
        image_path: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        max_size: Optional[int] = None,
        keep_aspect: bool = True,
        resample: str = "LANCZOS",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resize image with various options"""
        return image_transform.resize_image(
            self, image_path, width, height, max_size, keep_aspect, resample, output_path
        )

    def rotate_image(
        self,
        image_path: str,
        angle: float,
        expand: bool = True,
        fill_color: Union[str, Tuple[int, int, int]] = "white",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Rotate image by angle"""
        return image_transform.rotate_image(self, image_path, angle, expand, fill_color, output_path)

    def flip_image(
        self,
        image_path: str,
        direction: str = "horizontal",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Flip image horizontally or vertically"""
        return image_transform.flip_image(self, image_path, direction, output_path)

    def merge_images_horizontal(
        self,
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """Merge images horizontally"""
        return image_transform.merge_images_horizontal(self, image_paths, output_path, spacing, align)

    def merge_images_vertical(
        self,
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """Merge images vertically"""
        return image_transform.merge_images_vertical(self, image_paths, output_path, spacing, align)

    # ==================== COMPRESSION ====================

    def compress_image(
        self,
        image_path: str,
        quality: int = 85,
        max_width: Optional[int] = None,
        max_height: Optional[int] = None,
        output_format: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compress image with quality and size control

        Args:
            image_path: Input image path
            quality: JPEG quality (1-100)
            max_width: Maximum width
            max_height: Maximum height
            output_format: Output format (JPEG, PNG, WEBP)
            output_path: Output path

        Returns:
            Result dictionary with compression ratio
        """
        try:
            img_path = self._validate_image_path(image_path)

            # Determine output format
            if output_format:
                fmt = output_format.upper()
                ext = f".{output_format.lower()}"
            else:
                fmt = None
                ext = img_path.suffix

            output = output_path or self._get_output_path(image_path, None, "_compressed")
            if output_format and not output.endswith(ext):
                output = str(Path(output).with_suffix(ext))

            original_size = os.path.getsize(img_path)

            with Image.open(img_path) as img:
                orig_width, orig_height = img.size

                # Resize if needed
                if max_width or max_height:
                    max_w = max_width or orig_width
                    max_h = max_height or orig_height
                    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

                # Convert RGBA to RGB if saving as JPEG
                if (fmt == 'JPEG' or ext.lower() in ['.jpg', '.jpeg']) and img.mode == 'RGBA':
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[3])
                    img = rgb_img

                # Save with compression
                save_kwargs = {'quality': quality, 'optimize': True}
                if fmt:
                    save_kwargs['format'] = fmt
                img.save(output, **save_kwargs)

            compressed_size = os.path.getsize(output)
            ratio = (1 - compressed_size / original_size) * 100

            logger.info(f"Compressed: {original_size} -> {compressed_size} bytes ({ratio:.1f}% reduction)")
            return {
                'success': True,
                'output_path': output,
                'original_size': original_size,
                'compressed_size': compressed_size,
                'compression_ratio': f"{ratio:.1f}%",
                'quality': quality
            }

        except Exception as e:
            logger.error(f"Compression failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== TEXT OVERLAY ====================

    def add_text_to_image(
        self,
        image_path: str,
        text: str,
        position: Tuple[int, int] = (10, 10),
        font_size: int = 24,
        font_color: Union[str, Tuple[int, int, int]] = "black",
        font_path: Optional[str] = None,
        background_color: Optional[Union[str, Tuple[int, int, int, int]]] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add text overlay to image

        Args:
            image_path: Input image path
            text: Text to add
            position: (x, y) position
            font_size: Font size
            font_color: Text color
            font_path: Custom font file path (TTF)
            background_color: Text background color (with alpha)
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, "_text")

            with Image.open(img_path) as img:
                # Convert to RGBA for transparency support
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')

                # Create drawing layer
                overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
                draw = ImageDraw.Draw(overlay)

                # Load font
                try:
                    if font_path:
                        font = ImageFont.truetype(font_path, font_size)
                    else:
                        # Try to load default font
                        font = ImageFont.truetype("arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()
                    logger.warning("Using default font")

                # Draw background if specified
                if background_color:
                    bbox = draw.textbbox(position, text, font=font)
                    padding = 5
                    draw.rectangle(
                        [bbox[0] - padding, bbox[1] - padding, bbox[2] + padding, bbox[3] + padding],
                        fill=background_color
                    )

                # Draw text
                draw.text(position, text, font=font, fill=font_color)

                # Composite
                result = Image.alpha_composite(img, overlay)

                # Convert back if needed
                if img_path.suffix.lower() in ['.jpg', '.jpeg']:
                    result = result.convert('RGB')

                result.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Added text to image: {text}")
            return {
                'success': True,
                'output_path': output,
                'text': text,
                'position': position,
                'font_size': font_size
            }

        except Exception as e:
            logger.error(f"Add text failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== FILTERS & EFFECTS ====================

    def apply_filter(
        self,
        image_path: str,
        filter_type: str,
        intensity: float = 1.0,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Apply image filter/effect

        Args:
            image_path: Input image path
            filter_type: Filter type (blur, sharpen, brightness, contrast, grayscale, sepia)
            intensity: Filter intensity (0.0 - 2.0)
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, f"_{filter_type}")

            with Image.open(img_path) as img:
                if filter_type == "blur":
                    result = img.filter(ImageFilter.GaussianBlur(radius=intensity * 5))
                elif filter_type == "sharpen":
                    enhancer = ImageEnhance.Sharpness(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "brightness":
                    enhancer = ImageEnhance.Brightness(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "contrast":
                    enhancer = ImageEnhance.Contrast(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "grayscale":
                    result = ImageOps.grayscale(img)
                elif filter_type == "sepia":
                    result = ImageOps.grayscale(img).convert('RGB')
                    pixels = result.load()
                    for y in range(result.height):
                        for x in range(result.width):
                            r, g, b = pixels[x, y]
                            tr = int(r * 0.393 + g * 0.769 + b * 0.189)
                            tg = int(r * 0.349 + g * 0.686 + b * 0.168)
                            tb = int(r * 0.272 + g * 0.534 + b * 0.131)
                            pixels[x, y] = (min(tr, 255), min(tg, 255), min(tb, 255))
                else:
                    raise ValueError(f"Unknown filter: {filter_type}")

                result.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Applied {filter_type} filter")
            return {
                'success': True,
                'output_path': output,
                'filter_type': filter_type,
                'intensity': intensity
            }

        except Exception as e:
            logger.error(f"Filter failed: {e}")
            return {'success': False, 'error': str(e)}

    def __del__(self):
        """Cleanup on deletion"""
        self._cleanup_temp_files()


# Singleton instance
image_tools = ImageTools()
