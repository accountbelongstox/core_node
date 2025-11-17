#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Utilities

Utility functions for image loading, merging, saving, and comparison.
Supports both local file paths and remote URLs.
"""

import os
from io import BytesIO
from typing import List, Dict, Any, Union
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_requests
)


class ImageUtils:
    """
    Image utility class

    Provides static methods for image operations.
    All methods follow pycore guidelines: no try-except, use ColorPrint.
    """

    @staticmethod
    def load_image(source: str):
        """
        Load image from local path or URL

        Args:
            source: Image source (local file path or URL)

        Returns:
            PIL.Image object, or None if failed

        Examples:
            # Load from local path
            img = ImageUtils.load_image('/path/to/image.png')

            # Load from URL
            img = ImageUtils.load_image('https://example.com/image.jpg')
        """
        Image = get_third_package_PIL_Image()

        if not source:
            ColorPrint.red('[ImageUtils] Image source is required')
            return None

        # Check if URL or local path
        is_url = source.startswith('http://') or source.startswith('https://')

        if is_url:
            # Load from URL
            ColorPrint.blue(f'[ImageUtils] Loading image from URL: {source}')

            requests = get_third_package_requests()
            response = requests.get(source, timeout=30)

            if response.status_code != 200:
                ColorPrint.red(f'[ImageUtils] Failed to download image: HTTP {response.status_code}')
                return None

            img = Image.open(BytesIO(response.content))
            ColorPrint.green(f'[ImageUtils] Image loaded from URL: {source}')
            return img
        else:
            # Load from local path
            if not os.path.exists(source):
                ColorPrint.red(f'[ImageUtils] Image file not found: {source}')
                return None

            ColorPrint.blue(f'[ImageUtils] Loading image from file: {source}')
            img = Image.open(source)
            ColorPrint.green(f'[ImageUtils] Image loaded from file: {source}')
            return img

    @staticmethod
    def load_image_from_bytes(img_bytes: bytes):
        """
        Load image from bytes

        Args:
            img_bytes: Image bytes

        Returns:
            PIL.Image object, or None if failed
        """
        Image = get_third_package_PIL_Image()

        if not img_bytes:
            ColorPrint.red('[ImageUtils] Image bytes are required')
            return None

        ColorPrint.blue('[ImageUtils] Loading image from bytes')
        img = Image.open(BytesIO(img_bytes))
        ColorPrint.green('[ImageUtils] Image loaded from bytes')
        return img

    @staticmethod
    def merge_images_horizontal(images: List, spacing: int = 0):
        """
        Merge images horizontally

        Args:
            images: List of PIL.Image objects
            spacing: Space between images in pixels (default: 0)

        Returns:
            Merged PIL.Image object, or None if failed

        Example:
            img1 = ImageUtils.load_image('image1.png')
            img2 = ImageUtils.load_image('image2.png')
            merged = ImageUtils.merge_images_horizontal([img1, img2], spacing=10)
        """
        Image = get_third_package_PIL_Image()

        if not images:
            ColorPrint.red('[ImageUtils] No images provided for merging')
            return None

        if len(images) == 1:
            ColorPrint.yellow('[ImageUtils] Only one image provided, returning as is')
            return images[0]

        # Remove None images
        valid_images = [img for img in images if img is not None]
        if not valid_images:
            ColorPrint.red('[ImageUtils] All images are None')
            return None

        ColorPrint.blue(f'[ImageUtils] Merging {len(valid_images)} images horizontally with spacing={spacing}')

        # Calculate total width and max height
        total_width = sum(img.width for img in valid_images) + spacing * (len(valid_images) - 1)
        max_height = max(img.height for img in valid_images)

        ColorPrint.blue(f'[ImageUtils] Merged image size: {total_width}x{max_height}')

        # Create new image
        merged = Image.new('RGB', (total_width, max_height), color='white')

        # Paste images
        x_offset = 0
        for i, img in enumerate(valid_images):
            # Center vertically
            y_offset = (max_height - img.height) // 2
            merged.paste(img, (x_offset, y_offset))
            ColorPrint.blue(f'[ImageUtils] Pasted image {i+1} at ({x_offset}, {y_offset})')
            x_offset += img.width + spacing

        ColorPrint.green(f'[ImageUtils] Successfully merged {len(valid_images)} images horizontally')
        return merged

    @staticmethod
    def merge_images_vertical(images: List, spacing: int = 0):
        """
        Merge images vertically

        Args:
            images: List of PIL.Image objects
            spacing: Space between images in pixels (default: 0)

        Returns:
            Merged PIL.Image object, or None if failed
        """
        Image = get_third_package_PIL_Image()

        if not images:
            ColorPrint.red('[ImageUtils] No images provided for merging')
            return None

        if len(images) == 1:
            ColorPrint.yellow('[ImageUtils] Only one image provided, returning as is')
            return images[0]

        # Remove None images
        valid_images = [img for img in images if img is not None]
        if not valid_images:
            ColorPrint.red('[ImageUtils] All images are None')
            return None

        ColorPrint.blue(f'[ImageUtils] Merging {len(valid_images)} images vertically with spacing={spacing}')

        # Calculate max width and total height
        max_width = max(img.width for img in valid_images)
        total_height = sum(img.height for img in valid_images) + spacing * (len(valid_images) - 1)

        ColorPrint.blue(f'[ImageUtils] Merged image size: {max_width}x{total_height}')

        # Create new image
        merged = Image.new('RGB', (max_width, total_height), color='white')

        # Paste images
        y_offset = 0
        for i, img in enumerate(valid_images):
            # Center horizontally
            x_offset = (max_width - img.width) // 2
            merged.paste(img, (x_offset, y_offset))
            ColorPrint.blue(f'[ImageUtils] Pasted image {i+1} at ({x_offset}, {y_offset})')
            y_offset += img.height + spacing

        ColorPrint.green(f'[ImageUtils] Successfully merged {len(valid_images)} images vertically')
        return merged

    @staticmethod
    def merge_images_grid(images: List, cols: int = 2, spacing: int = 0):
        """
        Merge images in grid layout

        Args:
            images: List of PIL.Image objects
            cols: Number of columns (default: 2)
            spacing: Space between images in pixels (default: 0)

        Returns:
            Merged PIL.Image object, or None if failed

        Example:
            images = [img1, img2, img3, img4]
            merged = ImageUtils.merge_images_grid(images, cols=2, spacing=5)
            # Result:
            # [img1] [img2]
            # [img3] [img4]
        """
        Image = get_third_package_PIL_Image()

        if not images:
            ColorPrint.red('[ImageUtils] No images provided for merging')
            return None

        if len(images) == 1:
            ColorPrint.yellow('[ImageUtils] Only one image provided, returning as is')
            return images[0]

        if cols < 1:
            ColorPrint.red('[ImageUtils] Number of columns must be >= 1')
            return None

        # Remove None images
        valid_images = [img for img in images if img is not None]
        if not valid_images:
            ColorPrint.red('[ImageUtils] All images are None')
            return None

        ColorPrint.blue(f'[ImageUtils] Merging {len(valid_images)} images in grid ({cols} cols) with spacing={spacing}')

        # Calculate rows
        rows = (len(valid_images) + cols - 1) // cols
        ColorPrint.blue(f'[ImageUtils] Grid layout: {rows} rows x {cols} cols')

        # Find max width and height for each cell
        max_cell_width = max(img.width for img in valid_images)
        max_cell_height = max(img.height for img in valid_images)

        # Calculate total size
        total_width = max_cell_width * cols + spacing * (cols - 1)
        total_height = max_cell_height * rows + spacing * (rows - 1)

        ColorPrint.blue(f'[ImageUtils] Merged image size: {total_width}x{total_height}')

        # Create new image
        merged = Image.new('RGB', (total_width, total_height), color='white')

        # Paste images
        for i, img in enumerate(valid_images):
            row = i // cols
            col = i % cols

            x_offset = col * (max_cell_width + spacing) + (max_cell_width - img.width) // 2
            y_offset = row * (max_cell_height + spacing) + (max_cell_height - img.height) // 2

            merged.paste(img, (x_offset, y_offset))
            ColorPrint.blue(f'[ImageUtils] Pasted image {i+1} at grid[{row},{col}] ({x_offset}, {y_offset})')

        ColorPrint.green(f'[ImageUtils] Successfully merged {len(valid_images)} images in grid')
        return merged

    @staticmethod
    def save_image(image, path: str, format: str = 'PNG', quality: int = 95):
        """
        Save image to file

        Args:
            image: PIL.Image object
            path: Save path
            format: Image format (PNG, JPEG, WebP, etc., default: PNG)
            quality: Quality for JPEG/WebP (1-100, default: 95)

        Returns:
            True if successful, False otherwise
        """
        if not image:
            ColorPrint.red('[ImageUtils] Image is None')
            return False

        if not path:
            ColorPrint.red('[ImageUtils] Save path is required')
            return False

        # Create directory if not exists
        directory = os.path.dirname(path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            ColorPrint.blue(f'[ImageUtils] Created directory: {directory}')

        ColorPrint.blue(f'[ImageUtils] Saving image to: {path} (format={format}, quality={quality})')

        # Save image
        if format.upper() in ['JPEG', 'JPG']:
            # Convert RGBA to RGB for JPEG
            if image.mode == 'RGBA':
                rgb_image = image.convert('RGB')
                rgb_image.save(path, format=format, quality=quality)
            else:
                image.save(path, format=format, quality=quality)
        else:
            image.save(path, format=format)

        ColorPrint.green(f'[ImageUtils] Image saved successfully: {path}')
        return True

    @staticmethod
    def compare_images(img1, img2) -> Dict[str, Any]:
        """
        Compare two images

        Args:
            img1: First PIL.Image object
            img2: Second PIL.Image object

        Returns:
            Comparison result dictionary:
            {
                'identical': bool,           # Whether images are identical
                'size_match': bool,          # Whether sizes match
                'size1': tuple,              # (width, height) of image1
                'size2': tuple,              # (width, height) of image2
                'mode1': str,                # Mode of image1
                'mode2': str,                # Mode of image2
                'similarity': float,         # Similarity score (0-1), None if sizes don't match
                'diff_pixels': int,          # Number of different pixels, None if sizes don't match
                'error': str                 # Error message if comparison failed
            }
        """
        if not img1 or not img2:
            ColorPrint.red('[ImageUtils] Both images are required for comparison')
            return {
                'identical': False,
                'size_match': False,
                'size1': None,
                'size2': None,
                'mode1': None,
                'mode2': None,
                'similarity': None,
                'diff_pixels': None,
                'error': 'One or both images are None'
            }

        ColorPrint.blue('[ImageUtils] Comparing images')

        size1 = img1.size
        size2 = img2.size
        mode1 = img1.mode
        mode2 = img2.mode

        size_match = size1 == size2

        if not size_match:
            ColorPrint.yellow(f'[ImageUtils] Image sizes do not match: {size1} vs {size2}')
            return {
                'identical': False,
                'size_match': False,
                'size1': size1,
                'size2': size2,
                'mode1': mode1,
                'mode2': mode2,
                'similarity': None,
                'diff_pixels': None,
                'error': f'Image sizes do not match: {size1} vs {size2}'
            }

        # Convert to same mode if different
        if mode1 != mode2:
            ColorPrint.blue(f'[ImageUtils] Converting images to RGB mode (img1={mode1}, img2={mode2})')
            img1_rgb = img1.convert('RGB')
            img2_rgb = img2.convert('RGB')
        else:
            img1_rgb = img1
            img2_rgb = img2

        # Compare pixels
        diff_pixels = 0
        total_pixels = size1[0] * size1[1]

        pixels1 = list(img1_rgb.getdata())
        pixels2 = list(img2_rgb.getdata())

        for p1, p2 in zip(pixels1, pixels2):
            if p1 != p2:
                diff_pixels += 1

        identical = diff_pixels == 0
        similarity = 1.0 - (diff_pixels / total_pixels) if total_pixels > 0 else 1.0

        ColorPrint.blue(f'[ImageUtils] Comparison result: diff_pixels={diff_pixels}, similarity={similarity:.4f}')

        if identical:
            ColorPrint.green('[ImageUtils] Images are identical')
        else:
            ColorPrint.yellow(f'[ImageUtils] Images differ by {diff_pixels} pixels ({similarity*100:.2f}% similar)')

        return {
            'identical': identical,
            'size_match': True,
            'size1': size1,
            'size2': size2,
            'mode1': mode1,
            'mode2': mode2,
            'similarity': similarity,
            'diff_pixels': diff_pixels,
            'error': None
        }


__all__ = ['ImageUtils']
