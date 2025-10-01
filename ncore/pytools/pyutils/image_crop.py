#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Crop Utility
Provides image cropping and region extraction functionality
"""

import sys
import numpy as np
from typing import Tuple, Union, Optional
from pathlib import Path
from PIL import Image as PILImage

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing cv2
from pytools import check_and_install_dependencies
check_and_install_dependencies()

import cv2


class ImageCrop:
    """
    Utility class for cropping images

    Supports:
    - Crop by absolute coordinates
    - Crop by percentage
    - Crop around center point
    - Save cropped regions
    """

    @staticmethod
    def load_image(image_path: Union[str, Path]) -> np.ndarray:
        """
        Load image from file path (handles Chinese characters)

        Args:
            image_path: Path to image file

        Returns:
            Image as numpy array (BGR format)
        """
        image_path = str(image_path)

        # Use PIL to handle Chinese characters in path
        try:
            pil_image = PILImage.open(image_path)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            image_array = np.array(pil_image)
            # Convert RGB to BGR for OpenCV
            return cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Failed to load image: {image_path}. Error: {e}")

    @staticmethod
    def crop_region(
        image: np.ndarray,
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int]
    ) -> np.ndarray:
        """
        Crop rectangular region from image

        Args:
            image: Source image (BGR format)
            top_left: Top-left corner (x, y)
            bottom_right: Bottom-right corner (x, y)

        Returns:
            Cropped image region
        """
        x1, y1 = top_left
        x2, y2 = bottom_right

        # Ensure coordinates are within image bounds
        height, width = image.shape[:2]
        x1 = max(0, min(x1, width))
        x2 = max(0, min(x2, width))
        y1 = max(0, min(y1, height))
        y2 = max(0, min(y2, height))

        # Crop using numpy slicing (y first, then x)
        return image[y1:y2, x1:x2]

    @staticmethod
    def crop_around_center(
        image: np.ndarray,
        center_x: int,
        center_y: int,
        width_percentage: float = 0.25,
        direction: str = "left"
    ) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
        """
        Crop region around center point

        Args:
            image: Source image (BGR format)
            center_x: Center X coordinate
            center_y: Center Y coordinate
            width_percentage: Width of crop region as percentage of image width (e.g., 0.25 = 25%)
            direction: Direction to crop ("left", "right", "up", "down", "center")

        Returns:
            Tuple of (cropped_image, (x1, y1, x2, y2))
        """
        height, width = image.shape[:2]

        # Calculate crop width
        crop_width = int(width * width_percentage)

        # Calculate crop region based on direction
        if direction == "left":
            # Crop to the left of center
            x1 = max(0, center_x - crop_width)
            x2 = center_x
            y1 = 0
            y2 = height
        elif direction == "right":
            # Crop to the right of center
            x1 = center_x
            x2 = min(width, center_x + crop_width)
            y1 = 0
            y2 = height
        elif direction == "up":
            # Crop upward from center
            x1 = 0
            x2 = width
            y1 = max(0, center_y - crop_width)
            y2 = center_y
        elif direction == "down":
            # Crop downward from center
            x1 = 0
            x2 = width
            y1 = center_y
            y2 = min(height, center_y + crop_width)
        else:  # "center"
            # Crop centered around point
            half_width = crop_width // 2
            x1 = max(0, center_x - half_width)
            x2 = min(width, center_x + half_width)
            y1 = max(0, center_y - half_width)
            y2 = min(height, center_y + half_width)

        cropped = image[y1:y2, x1:x2]
        return cropped, (x1, y1, x2, y2)

    @staticmethod
    def save_image(image: np.ndarray, output_path: Union[str, Path]) -> None:
        """
        Save image to file (handles Chinese characters)

        Args:
            image: Image to save (BGR format)
            output_path: Output file path
        """
        output_path = str(output_path)

        # Convert BGR to RGB for PIL
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = PILImage.fromarray(image_rgb)
        pil_image.save(output_path)


# Example usage
if __name__ == "__main__":
    from pyfoundations.color_print import ColorPrint

    # Example: Load and crop image
    try:
        # Load image
        image_path = "test_image.png"
        image = ImageCrop.load_image(image_path)
        ColorPrint.green(f"Loaded image: {image.shape}")

        # Crop region
        cropped = ImageCrop.crop_region(image, (100, 100), (300, 300))
        ColorPrint.green(f"Cropped region: {cropped.shape}")

        # Crop around center (25% width to the left)
        center_x, center_y = 500, 500
        cropped_center, coords = ImageCrop.crop_around_center(
            image, center_x, center_y, width_percentage=0.25, direction="left"
        )
        ColorPrint.green(f"Cropped around center: {cropped_center.shape}, coords: {coords}")

    except Exception as e:
        ColorPrint.red(f"Error: {e}")
