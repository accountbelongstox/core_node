#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image geometry transforms and merge operations for ImageTools.

Extracted from image_processor.py to keep modules under 800 lines. These are
free functions that receive the ImageTools instance (``tools``) so they can
reuse its helpers (_validate_image_path, _get_output_path) and constants
(DEFAULT_QUALITY). The ImageTools facade in image_processor.py delegates to
these functions, preserving the public method API.

Public functions (called via ImageTools methods):
    resize_image, rotate_image, flip_image,
    merge_images_horizontal, merge_images_vertical
"""

import logging
from typing import Tuple, Optional, Dict, Any, List, Union

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

logger = logging.getLogger(__name__)


def resize_image(
    tools,
    image_path: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    max_size: Optional[int] = None,
    keep_aspect: bool = True,
    resample: str = "LANCZOS",
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Resize image with various options

    Args:
        image_path: Input image path
        width: Target width
        height: Target height
        max_size: Max dimension (used if width/height not specified)
        keep_aspect: Keep aspect ratio
        resample: Resampling method (LANCZOS, BILINEAR, BICUBIC, NEAREST)
        output_path: Output path

    Returns:
        Result dictionary
    """
    try:
        img_path = tools._validate_image_path(image_path)
        output = tools._get_output_path(image_path, output_path, "_resized")

        resample_filter = getattr(Image.Resampling, resample, Image.Resampling.LANCZOS)

        with Image.open(img_path) as img:
            orig_width, orig_height = img.size

            if max_size:
                img.thumbnail((max_size, max_size), resample_filter)
                new_size = img.size
            elif width and height:
                if keep_aspect:
                    img.thumbnail((width, height), resample_filter)
                    new_size = img.size
                else:
                    img = img.resize((width, height), resample_filter)
                    new_size = (width, height)
            elif width:
                ratio = width / orig_width
                new_height = int(orig_height * ratio)
                img = img.resize((width, new_height), resample_filter)
                new_size = (width, new_height)
            elif height:
                ratio = height / orig_height
                new_width = int(orig_width * ratio)
                img = img.resize((new_width, height), resample_filter)
                new_size = (new_width, height)
            else:
                raise ValueError("Must specify width, height, or max_size")

            img.save(output, quality=tools.DEFAULT_QUALITY)

        logger.info(f"Resized from {orig_width}x{orig_height} to {new_size[0]}x{new_size[1]}")
        return {
            'success': True,
            'output_path': output,
            'original_size': f"{orig_width}x{orig_height}",
            'new_size': f"{new_size[0]}x{new_size[1]}"
        }

    except Exception as e:
        logger.error(f"Resize failed: {e}")
        return {'success': False, 'error': str(e)}


def rotate_image(
    tools,
    image_path: str,
    angle: float,
    expand: bool = True,
    fill_color: Union[str, Tuple[int, int, int]] = "white",
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Rotate image by angle

    Args:
        image_path: Input image path
        angle: Rotation angle in degrees (counter-clockwise)
        expand: Expand canvas to fit rotated image
        fill_color: Background color for expanded area
        output_path: Output path

    Returns:
        Result dictionary
    """
    try:
        img_path = tools._validate_image_path(image_path)
        output = tools._get_output_path(image_path, output_path, "_rotated")

        with Image.open(img_path) as img:
            rotated = img.rotate(angle, expand=expand, fillcolor=fill_color)
            rotated.save(output, quality=tools.DEFAULT_QUALITY)

        logger.info(f"Rotated image by {angle} degrees")
        return {
            'success': True,
            'output_path': output,
            'angle': angle,
            'expand': expand
        }

    except Exception as e:
        logger.error(f"Rotate failed: {e}")
        return {'success': False, 'error': str(e)}


def flip_image(
    tools,
    image_path: str,
    direction: str = "horizontal",
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Flip image horizontally or vertically

    Args:
        image_path: Input image path
        direction: 'horizontal' or 'vertical'
        output_path: Output path

    Returns:
        Result dictionary
    """
    try:
        img_path = tools._validate_image_path(image_path)
        output = tools._get_output_path(image_path, output_path, f"_flip_{direction}")

        with Image.open(img_path) as img:
            if direction == "horizontal":
                flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
            elif direction == "vertical":
                flipped = img.transpose(Image.FLIP_TOP_BOTTOM)
            else:
                raise ValueError(f"Invalid direction: {direction}")

            flipped.save(output, quality=tools.DEFAULT_QUALITY)

        logger.info(f"Flipped image {direction}")
        return {
            'success': True,
            'output_path': output,
            'direction': direction
        }

    except Exception as e:
        logger.error(f"Flip failed: {e}")
        return {'success': False, 'error': str(e)}


def merge_images_horizontal(
    tools,
    image_paths: List[str],
    output_path: str,
    spacing: int = 0,
    align: str = "center"
) -> Dict[str, Any]:
    """
    Merge images horizontally

    Args:
        image_paths: List of image paths
        output_path: Output path
        spacing: Space between images
        align: Vertical alignment ('top', 'center', 'bottom')

    Returns:
        Result dictionary
    """
    try:
        if not image_paths:
            raise ValueError("No images provided")

        images = [Image.open(p) for p in image_paths]
        widths, heights = zip(*(img.size for img in images))

        total_width = sum(widths) + spacing * (len(images) - 1)
        max_height = max(heights)

        merged = Image.new('RGB', (total_width, max_height), (255, 255, 255))

        x_offset = 0
        for img in images:
            if align == "top":
                y_offset = 0
            elif align == "center":
                y_offset = (max_height - img.height) // 2
            elif align == "bottom":
                y_offset = max_height - img.height
            else:
                y_offset = 0

            merged.paste(img, (x_offset, y_offset))
            x_offset += img.width + spacing

        merged.save(output_path, quality=tools.DEFAULT_QUALITY)

        for img in images:
            img.close()

        logger.info(f"Merged {len(images)} images horizontally")
        return {
            'success': True,
            'output_path': output_path,
            'image_count': len(images),
            'final_size': f"{total_width}x{max_height}",
            'align': align
        }

    except Exception as e:
        logger.error(f"Horizontal merge failed: {e}")
        return {'success': False, 'error': str(e)}


def merge_images_vertical(
    tools,
    image_paths: List[str],
    output_path: str,
    spacing: int = 0,
    align: str = "center"
) -> Dict[str, Any]:
    """
    Merge images vertically

    Args:
        image_paths: List of image paths
        output_path: Output path
        spacing: Space between images
        align: Horizontal alignment ('left', 'center', 'right')

    Returns:
        Result dictionary
    """
    try:
        if not image_paths:
            raise ValueError("No images provided")

        images = [Image.open(p) for p in image_paths]
        widths, heights = zip(*(img.size for img in images))

        max_width = max(widths)
        total_height = sum(heights) + spacing * (len(images) - 1)

        merged = Image.new('RGB', (max_width, total_height), (255, 255, 255))

        y_offset = 0
        for img in images:
            if align == "left":
                x_offset = 0
            elif align == "center":
                x_offset = (max_width - img.width) // 2
            elif align == "right":
                x_offset = max_width - img.width
            else:
                x_offset = 0

            merged.paste(img, (x_offset, y_offset))
            y_offset += img.height + spacing

        merged.save(output_path, quality=tools.DEFAULT_QUALITY)

        for img in images:
            img.close()

        logger.info(f"Merged {len(images)} images vertically")
        return {
            'success': True,
            'output_path': output_path,
            'image_count': len(images),
            'final_size': f"{max_width}x{total_height}",
            'align': align
        }

    except Exception as e:
        logger.error(f"Vertical merge failed: {e}")
        return {'success': False, 'error': str(e)}
