#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Black Screen Detector
Detects if a region is completely black (used for map switching detection)
"""

import sys
from pathlib import Path
from typing import Union, Tuple

from pycore.pyfoundations.third_party import PIL, numpy
from PIL import Image
import numpy as np

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint


class BlackScreenDetector:
    """
    Detects if an image region is completely black (±10% brightness tolerance)

    Used to detect map switching state in D4 where the map name region
    goes completely black during transitions.
    """

    # Black color threshold (±10% tolerance)
    # Pure black is (0, 0, 0), with 10% tolerance: 0-25 for each channel
    BLACK_THRESHOLD = 25  # 255 * 0.1 ≈ 25

    # Percentage of pixels that must be black to consider the region "black"
    BLACK_PIXEL_PERCENTAGE = 0.95  # 95% of pixels must be black

    @staticmethod
    def is_black_screen(
        image: Union[Image.Image, np.ndarray],
        threshold: int = BLACK_THRESHOLD,
        black_percentage: float = BLACK_PIXEL_PERCENTAGE
    ) -> bool:
        """
        Check if an image is completely black (±10% tolerance)

        Args:
            image: PIL Image or numpy array (RGB or BGR)
            threshold: Maximum brightness value to consider as black (0-255)
                      Default: 25 (10% of 255)
            black_percentage: Minimum percentage of pixels that must be black
                             Default: 0.95 (95%)

        Returns:
            True if image is black screen, False otherwise
        """
        try:
            # Convert to numpy array if PIL Image
            if isinstance(image, Image.Image):
                img_array = np.array(image)
            else:
                img_array = image

            # Ensure we have a valid image
            if img_array is None or img_array.size == 0:
                ColorPrint.yellow("[BlackScreenDetector] Invalid image provided")
                return False

            # Handle grayscale images (2D array)
            if len(img_array.shape) == 2:
                # Grayscale: check if all pixels are below threshold
                black_mask = img_array <= threshold
            # Handle color images (3D array)
            elif len(img_array.shape) == 3:
                # RGB/BGR: check if ALL channels are below threshold
                # A pixel is black if R <= threshold AND G <= threshold AND B <= threshold
                black_mask = np.all(img_array <= threshold, axis=2)
            else:
                ColorPrint.yellow(f"[BlackScreenDetector] Unexpected image shape: {img_array.shape}")
                return False

            # Calculate percentage of black pixels
            total_pixels = black_mask.size
            black_pixels = np.sum(black_mask)
            black_ratio = black_pixels / total_pixels

            # Check if enough pixels are black
            is_black = black_ratio >= black_percentage

            # Debug output
            if is_black:
                ColorPrint.blue(f"[BlackScreenDetector] Black screen detected: {black_ratio*100:.1f}% black pixels")

            return is_black

        except Exception as e:
            ColorPrint.red(f"[BlackScreenDetector] Error detecting black screen: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def get_brightness_stats(image: Union[Image.Image, np.ndarray]) -> dict:
        """
        Get brightness statistics of an image (for debugging)

        Args:
            image: PIL Image or numpy array

        Returns:
            Dictionary with brightness statistics:
            {
                'mean': average brightness,
                'min': minimum brightness,
                'max': maximum brightness,
                'std': standard deviation
            }
        """
        try:
            # Convert to numpy array if PIL Image
            if isinstance(image, Image.Image):
                img_array = np.array(image)
            else:
                img_array = image

            # Calculate brightness (average of all channels)
            if len(img_array.shape) == 3:
                brightness = np.mean(img_array, axis=2)
            else:
                brightness = img_array

            return {
                'mean': float(np.mean(brightness)),
                'min': float(np.min(brightness)),
                'max': float(np.max(brightness)),
                'std': float(np.std(brightness))
            }

        except Exception as e:
            ColorPrint.red(f"[BlackScreenDetector] Error getting brightness stats: {e}")
            return {}


# Convenience function for easy import
def is_black_screen(
    image: Union[Image.Image, np.ndarray],
    threshold: int = BlackScreenDetector.BLACK_THRESHOLD
) -> bool:
    """
    Check if an image is completely black

    Args:
        image: PIL Image or numpy array
        threshold: Black threshold (0-255), default 25 (10% tolerance)

    Returns:
        True if black screen detected, False otherwise
    """
    return BlackScreenDetector.is_black_screen(image, threshold=threshold)


if __name__ == "__main__":
    # Test with sample images
    print("Black Screen Detector Test")
    print("=" * 50)

    # Test 1: Pure black image
    black_img = Image.new('RGB', (100, 100), color=(0, 0, 0))
    result = is_black_screen(black_img)
    print(f"Pure black (0,0,0): {result} (expected: True)")

    # Test 2: Near black image (within 10% tolerance)
    near_black_img = Image.new('RGB', (100, 100), color=(20, 20, 20))
    result = is_black_screen(near_black_img)
    print(f"Near black (20,20,20): {result} (expected: True)")

    # Test 3: Dark gray (outside tolerance)
    dark_gray_img = Image.new('RGB', (100, 100), color=(50, 50, 50))
    result = is_black_screen(dark_gray_img)
    print(f"Dark gray (50,50,50): {result} (expected: False)")

    # Test 4: White image
    white_img = Image.new('RGB', (100, 100), color=(255, 255, 255))
    result = is_black_screen(white_img)
    print(f"White (255,255,255): {result} (expected: False)")

    # Test 5: Mixed image (90% black, 10% white)
    mixed_img = Image.new('RGB', (100, 100), color=(0, 0, 0))
    # Add some white pixels (10%)
    pixels = mixed_img.load()
    for i in range(10):
        for j in range(10):
            pixels[i, j] = (255, 255, 255)
    result = is_black_screen(mixed_img)
    print(f"90% black, 10% white: {result} (expected: False, only 90% < 95%)")

    print("=" * 50)
