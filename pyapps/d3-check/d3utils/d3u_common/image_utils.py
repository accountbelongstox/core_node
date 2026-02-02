#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Processing Utilities
Shared image format conversion and processing functions
"""

import sys
from pathlib import Path
from typing import Optional, Union

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
Image = get_third_package_PIL_Image()

# Add project paths
from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint


def normalize_image_to_bgr(image_input: Union[str, Path, Image.Image, np.ndarray]) -> np.ndarray:
    """
    Normalize input to BGR numpy array

    Args:
        image_input: Image as file path (str/Path), PIL Image, or numpy array

    Returns:
        BGR numpy array (OpenCV format)

    Raises:
        ValueError: If image input type is unsupported or loading fails
    """
    try:
        if isinstance(image_input, (str, Path)):
            # Load from file path
            image = cv2.imread(str(image_input))
            if image is None:
                raise ValueError(f"Could not load image from path: {image_input}")
            return image

        elif isinstance(image_input, Image.Image):
            # Convert PIL Image to BGR numpy array
            image_array = np.array(image_input)
            if len(image_array.shape) == 3:
                # Convert RGB to BGR
                return cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            else:
                return image_array

        elif isinstance(image_input, np.ndarray):
            # Already numpy array - assume BGR format
            return image_input

        else:
            raise ValueError(f"Unsupported image input type: {type(image_input)}")

    except Exception as e:
        ColorPrint.red(f"[ImageUtils] Error normalizing image to BGR: {e}")
        raise


def normalize_image_to_rgb_pil(image_input: Union[str, Path, Image.Image, np.ndarray]) -> Image.Image:
    """
    Normalize input to RGB PIL Image

    Args:
        image_input: Image as file path (str/Path), PIL Image, or numpy array (BGR)

    Returns:
        RGB PIL Image

    Raises:
        ValueError: If image input type is unsupported or conversion fails
    """
    try:
        if isinstance(image_input, (str, Path)):
            # Load from file path and convert to RGB
            image = Image.open(str(image_input))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            return image

        elif isinstance(image_input, Image.Image):
            # Already PIL Image - ensure RGB mode
            if image_input.mode != 'RGB':
                return image_input.convert('RGB')
            return image_input

        elif isinstance(image_input, np.ndarray):
            # Convert numpy array (assume BGR) to RGB PIL Image
            if len(image_input.shape) == 3:
                # BGR to RGB
                rgb_array = cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB)
                return Image.fromarray(rgb_array)
            else:
                # Grayscale
                return Image.fromarray(image_input)

        else:
            raise ValueError(f"Unsupported image input type: {type(image_input)}")

    except Exception as e:
        ColorPrint.red(f"[ImageUtils] Error normalizing image to RGB PIL: {e}")
        raise


def ensure_rgb_mode(image: Image.Image) -> Image.Image:
    """
    Ensure PIL Image is in RGB mode

    Args:
        image: PIL Image

    Returns:
        RGB PIL Image
    """
    if image.mode != 'RGB':
        return image.convert('RGB')
    return image


def convert_pil_to_bgr(image: Image.Image) -> Optional[np.ndarray]:
    """
    Convert PIL Image to BGR numpy array. Handles RGB and RGBA (uses first 3 channels).

    Args:
        image: PIL Image (RGB or RGBA)

    Returns:
        BGR numpy array, or None if image is None or invalid
    """
    if image is None:
        return None
    image_array = np.array(image)
    if len(image_array.shape) != 3 or image_array.shape[2] < 3:
        return None
    rgb = image_array[:, :, :3]
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def convert_bgr_to_pil(image_bgr: np.ndarray) -> Image.Image:
    """
    Convert BGR numpy array to PIL Image

    Args:
        image_bgr: BGR numpy array

    Returns:
        RGB PIL Image
    """
    if len(image_bgr.shape) == 3:
        rgb_array = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb_array)
    else:
        return Image.fromarray(image_bgr)
