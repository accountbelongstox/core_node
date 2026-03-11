#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game window region cropping: crop game window image by fixed region rules
(e.g. middle 30% width, upper half) for OCR or detection.
"""

from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()


def crop_game_window_middle30_upper_half(img: Optional[Image.Image]) -> Optional[Image.Image]:
    """
    Crop to middle 30% width and upper half of game window image.

    Args:
        img: Game window PIL Image (or None)

    Returns:
        Cropped PIL Image, or None if input is None or crop is invalid
    """
    if img is None:
        return None
    try:
        w, h = img.size
        if w <= 0 or h <= 0:
            return None
        left = int(0.35 * w)
        right = int(0.65 * w)
        upper = 0
        lower = int(0.5 * h)
        if left >= right or upper >= lower:
            return None
        return img.crop((left, upper, right, lower))
    except Exception:
        return None
