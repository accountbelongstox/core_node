#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net blue button detector by color #0074E0.
Use any #0074E0 pixel as top-left, try to build 200x20 box; validate left, top, right edges only.
First successful build is the button.
"""

from pathlib import Path
from typing import Optional, Tuple, Union, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_numpy
from pycore.pyfoundations.third_party import get_third_package_PIL_Image

np = get_third_package_numpy()
Image = get_third_package_PIL_Image()

try:
    from pycore.pyfoundations.color_print import ColorPrint
except ImportError:
    ColorPrint = None

from providor.constants.common import (
    BATTLE_NET_BUTTON_HEX,
    BATTLE_NET_BUTTON_RGB,
    DEFAULT_BRIGHTNESS_TOL,
    DEFAULT_BUTTON_W,
    DEFAULT_BUTTON_H,
)


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _rgb_bounds(rgb: Tuple[int, int, int], brightness_tol: float = 0.02) -> Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int]]:
    """Per-channel bounds: value * (1-tol) to value * (1+tol), clamp [0,255]. For 0 use [0, ceil(255*tol)]."""
    out = []
    for c in rgb:
        if c == 0:
            hi = min(255, int(255 * brightness_tol) + 1)
            out.append((0, hi))
        else:
            lo = max(0, int(c * (1 - brightness_tol)))
            hi = min(255, int(c * (1 + brightness_tol)) + 1)
            out.append((lo, hi))
    return (out[0], out[1], out[2])


def _image_to_rgb(img_input: Union[str, Path, Image.Image, np.ndarray]) -> np.ndarray:
    """Return (H, W, 3) RGB uint8."""
    if isinstance(img_input, (str, Path)):
        img = Image.open(str(img_input))
        return np.array(img.convert("RGB"))
    if isinstance(img_input, Image.Image):
        return np.array(img_input.convert("RGB"))
    if isinstance(img_input, np.ndarray):
        if img_input.ndim == 2:
            return np.stack([img_input] * 3, axis=-1)
        if img_input.shape[2] == 4:
            return np.array(Image.fromarray(img_input).convert("RGB"))
        return img_input
    raise TypeError("image must be path, PIL Image, or numpy array")


def _check_left_top_right(mask: np.ndarray, x: int, y: int, w: int, h: int) -> bool:
    """Check left, top, right edges (not bottom) all match. Box [x, x+w), [y, y+h)."""
    H, W = mask.shape
    if x + w > W or y + h > H:
        return False
    if not np.all(mask[y : y + h, x]):
        return False
    if not np.all(mask[y, x : x + w]):
        return False
    if not np.all(mask[y : y + h, x + w - 1]):
        return False
    return True


def find_battlenet_blue_button(
    image: Union[str, Path, Image.Image, np.ndarray],
    color_hex: str = BATTLE_NET_BUTTON_HEX,
    brightness_tol: float = DEFAULT_BRIGHTNESS_TOL,
    button_w: int = DEFAULT_BUTTON_W,
    button_h: int = DEFAULT_BUTTON_H,
    log_prefix: str = "[BattlenetButton]",
) -> Optional[Dict[str, Any]]:
    """
    Use any #0074E0 pixel as top-left; try to build box (button_w x button_h).
    Validate left, top, right edges only (not bottom). First success is the button.
    """
    rgb = _image_to_rgb(image)
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        return None
    H, W = rgb.shape[0], rgb.shape[1]
    if isinstance(color_hex, str) and color_hex.startswith("#"):
        r, g, b = _hex_to_rgb(color_hex)
    else:
        r, g, b = BATTLE_NET_BUTTON_RGB
    (r_lo, r_hi), (g_lo, g_hi), (b_lo, b_hi) = _rgb_bounds((r, g, b), brightness_tol)
    mask = (
        (rgb[:, :, 0] >= r_lo) & (rgb[:, :, 0] <= r_hi) &
        (rgb[:, :, 1] >= g_lo) & (rgb[:, :, 1] <= g_hi) &
        (rgb[:, :, 2] >= b_lo) & (rgb[:, :, 2] <= b_hi)
    )
    for y in range(H):
        for x in range(W):
            if not mask[y, x]:
                continue
            if _check_left_top_right(mask, x, y, button_w, button_h):
                min_x, min_y = x, y
                max_x = x + button_w - 1
                max_y = y + button_h - 1
                cx = (min_x + max_x) / 2
                cy = (min_y + max_y) / 2
                return {
                    "bbox": (min_x, min_y, max_x, max_y),
                    "center": (cx, cy),
                    "width": button_w,
                    "height": button_h,
                }
    return None
