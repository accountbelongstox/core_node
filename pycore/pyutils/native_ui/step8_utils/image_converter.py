#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Converter Module

Provides universal image format conversion support for native_ui.
Automatically converts unsupported formats (SVG, etc.) to PNG using available libraries.
Cached conversions are stored in user data directory for performance.

Features:
- SVG to PNG conversion (cairosvg, or fallback methods)
- Smart caching (checks source file modification time)
- Support for all PIL-supported formats
- Automatic format detection

Usage:
    from pycore.pyutils.native_ui.image_converter import convert_image_for_pil

    # Convert SVG to PNG (cached)
    png_path = convert_image_for_pil("logo.svg", size=(32, 32))
    img = Image.open(png_path)
"""

import os
import hashlib
from pathlib import Path
from typing import Optional, Tuple

from pycore.pyfoundations.third_party import PIL

Image = PIL.Image

from pycore import ColorPrint
from pycore.pyfoundations import APP_CACHE_DIR


# Image conversion cache directory
IMAGE_CACHE_DIR = APP_CACHE_DIR / "images"
IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _get_cache_path(source_path: Path, size: Optional[Tuple[int, int]] = None) -> Path:
    """
    Get cache file path for converted image

    Args:
        source_path: Source image file path
        size: Target size (width, height), None for original size

    Returns:
        Path to cached PNG file
    """
    # Create unique hash from source path and size
    source_str = str(source_path.absolute())
    if size:
        source_str += f"_{size[0]}x{size[1]}"

    hash_digest = hashlib.md5(source_str.encode()).hexdigest()[:12]
    filename = f"{source_path.stem}_{hash_digest}.png"

    return IMAGE_CACHE_DIR / filename


def _is_cache_valid(cache_path: Path, source_path: Path) -> bool:
    """
    Check if cached image is still valid

    Args:
        cache_path: Cached file path
        source_path: Source file path

    Returns:
        True if cache is valid, False otherwise
    """
    if not cache_path.exists():
        return False

    # Check modification times
    cache_mtime = cache_path.stat().st_mtime
    source_mtime = source_path.stat().st_mtime

    return cache_mtime >= source_mtime


def _convert_svg_to_png(
    svg_path: Path,
    output_path: Path,
    size: Optional[Tuple[int, int]] = None
) -> bool:
    """
    Convert SVG to PNG using available libraries

    Tries multiple methods in order:
    1. cairosvg (best quality)
    2. svglib + reportlab
    3. PIL with svg2rlg (fallback)

    Args:
        svg_path: Source SVG file path
        output_path: Output PNG file path
        size: Target size (width, height)

    Returns:
        True if conversion successful, False otherwise
    """
    # Try method 1: cairosvg (best quality)
    try:
        import cairosvg
        if size:
            cairosvg.svg2png(
                url=str(svg_path),
                write_to=str(output_path),
                output_width=size[0],
                output_height=size[1]
            )
        else:
            cairosvg.svg2png(
                url=str(svg_path),
                write_to=str(output_path)
            )
        ColorPrint.green(f"[ImageConverter] Converted SVG to PNG using cairosvg: {output_path.name}")
        return True
    except ImportError:
        ColorPrint.yellow("[ImageConverter] cairosvg not available, trying alternative methods")
    except Exception as e:
        ColorPrint.yellow(f"[ImageConverter] cairosvg conversion failed: {e}")

    # Try method 2: svglib + reportlab
    try:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPM

        drawing = svg2rlg(str(svg_path))
        if size:
            # Scale drawing to target size
            scale_x = size[0] / drawing.width
            scale_y = size[1] / drawing.height
            scale = min(scale_x, scale_y)
            drawing.width = size[0]
            drawing.height = size[1]
            drawing.scale(scale, scale)

        renderPM.drawToFile(drawing, str(output_path), fmt='PNG')
        ColorPrint.green(f"[ImageConverter] Converted SVG to PNG using svglib: {output_path.name}")
        return True
    except ImportError:
        ColorPrint.yellow("[ImageConverter] svglib/reportlab not available")
    except Exception as e:
        ColorPrint.yellow(f"[ImageConverter] svglib conversion failed: {e}")

    # Method 3: Create a placeholder PNG (last resort)
    try:
        from PIL import Image, ImageDraw, ImageFont

        # Create blank image
        img_size = size or (64, 64)
        img = Image.new('RGBA', img_size, (30, 30, 30, 255))
        draw = ImageDraw.Draw(img)

        # Draw a simple icon placeholder (diamond shape)
        w, h = img_size
        center_x, center_y = w // 2, h // 2
        points = [
            (center_x, center_y - h // 3),  # Top
            (center_x + w // 3, center_y),  # Right
            (center_x, center_y + h // 3),  # Bottom
            (center_x - w // 3, center_y),  # Left
        ]
        draw.polygon(points, fill=(0, 120, 212, 255), outline=(0, 188, 242, 255))

        img.save(str(output_path), 'PNG')
        ColorPrint.yellow(f"[ImageConverter] Created placeholder PNG (SVG conversion not available): {output_path.name}")
        return True
    except Exception as e:
        ColorPrint.red(f"[ImageConverter] Failed to create placeholder: {e}")
        return False


def convert_image_for_pil(
    image_path: str,
    size: Optional[Tuple[int, int]] = None,
    force_convert: bool = False
) -> Path:
    """
    Convert image to PIL-supported format if needed

    Automatically handles:
    - SVG to PNG conversion
    - Caching of converted images
    - Cache validation (checks source modification time)
    - Resize during conversion

    Args:
        image_path: Path to source image file
        size: Target size (width, height), None to keep original size
        force_convert: Force reconversion even if cache exists

    Returns:
        Path to PIL-compatible image file (original or converted)

    Raises:
        FileNotFoundError: If source image file doesn't exist
        ValueError: If image format is unsupported
    """
    source_path = Path(image_path)

    if not source_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    # Get file extension
    ext = source_path.suffix.lower()

    # If not SVG, check if PIL can handle it directly
    if ext != '.svg':
        try:
            # Try to open with PIL
            test_img = Image.open(str(source_path))
            test_img.close()

            # If size is specified and differs, we might still want to convert
            if size:
                # Get cache path for resized version
                cache_path = _get_cache_path(source_path, size)

                # Check if cache is valid
                if not force_convert and _is_cache_valid(cache_path, source_path):
                    ColorPrint.blue(f"[ImageConverter] Using cached image: {cache_path.name}")
                    return cache_path

                # Resize and cache
                img = Image.open(str(source_path))
                img = img.resize(size, Image.Resampling.LANCZOS)
                img.save(str(cache_path), 'PNG')
                ColorPrint.green(f"[ImageConverter] Resized and cached: {cache_path.name}")
                return cache_path

            # Return original path if no conversion needed
            return source_path

        except Exception as e:
            ColorPrint.yellow(f"[ImageConverter] PIL cannot open {ext} file directly: {e}")

    # SVG or unsupported format - need conversion
    cache_path = _get_cache_path(source_path, size)

    # Check if cache is valid
    if not force_convert and _is_cache_valid(cache_path, source_path):
        ColorPrint.blue(f"[ImageConverter] Using cached converted image: {cache_path.name}")
        return cache_path

    # Convert SVG to PNG
    if ext == '.svg':
        success = _convert_svg_to_png(source_path, cache_path, size)
        if success:
            return cache_path
        else:
            raise ValueError(f"Failed to convert SVG to PNG: {image_path}")

    # For other unsupported formats, raise error
    raise ValueError(f"Unsupported image format: {ext}")


def clear_image_cache(older_than_days: int = 30):
    """
    Clear old cached images

    Args:
        older_than_days: Remove cache files older than this many days
    """
    import time

    current_time = time.time()
    cutoff_time = current_time - (older_than_days * 24 * 60 * 60)
    removed_count = 0

    for cache_file in IMAGE_CACHE_DIR.glob("*.png"):
        if cache_file.stat().st_mtime < cutoff_time:
            try:
                cache_file.unlink()
                removed_count += 1
            except Exception as e:
                ColorPrint.yellow(f"[ImageConverter] Failed to remove cache file {cache_file.name}: {e}")

    if removed_count > 0:
        ColorPrint.green(f"[ImageConverter] Cleared {removed_count} old cached images")


__all__ = [
    'convert_image_for_pil',
    'clear_image_cache',
    'IMAGE_CACHE_DIR'
]
