#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screen Capture Engine

Reusable mss-based capture primitives shared by the window screenshot facade:
- grab_fullscreen_pil: full primary-monitor capture (mss) -> PIL RGB Image
- capture_screen_region: native rect grab (mss sct.grab with monitor dict) -> PIL Image
- scale_image_to_720p: LANCZOS downscale to 1280x720 (aspect-preserving) + offset scaling
- get_primary_monitor_size: lightweight primary monitor (width, height) without pixel grab

One-directional dependency: imports only pyfoundations/third_party + ColorPrint.
NEVER imports back into screenshot.py (avoids circular import within the window package).
"""

import hashlib
import time
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_mss

mss = get_third_package_mss()
Image = get_third_package_PIL_Image()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


TERMINAL_CAPTURE_MAX_WIDTH = 640
TERMINAL_CAPTURE_MAX_HEIGHT = 360
TERMINAL_CAPTURE_PNG_COMPRESSION = 1


def grab_fullscreen_pil():
    """
    Capture the primary monitor full screen via mss and return a PIL RGB Image.

    Returns:
        PIL.Image.Image of the full primary monitor, or None on failure.
    """
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            screenshot_mss = sct.grab(monitor)
            return Image.frombytes("RGB", screenshot_mss.size, screenshot_mss.rgb)
    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] grab_fullscreen_pil: {e}", "1min", "red")
        return None


def capture_screen_region(
    left: int,
    top: int,
    width: int,
    height: int
) -> Optional["Image.Image"]:
    """
    Native screen region capture: grab only the given screen rect (no fullscreen then crop).
    Uses mss sct.grab(monitor) with monitor = {left, top, width, height}.

    Args:
        left: Screen X of region top-left
        top: Screen Y of region top-left
        width: Region width in pixels
        height: Region height in pixels

    Returns:
        PIL Image of the region or None if failed
    """
    try:
        if width <= 0 or height <= 0:
            ColorPrint.print_min_interval("[ScreenRegion] Invalid width/height", "1min", "red")
            return None
        with mss.mss() as sct:
            monitor = {
                "left": left,
                "top": top,
                "width": width,
                "height": height,
            }
            screenshot = sct.grab(monitor)
            img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
        ColorPrint.print_min_interval(f"[ScreenRegion] Native grab: ({left},{top}) {width}x{height}", "1min", "gray")
        return img
    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] capture_screen_region: {e}", "1min", "red")
        return None


def capture_screen_regions_png(
    regions: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    captures: Dict[str, Dict[str, Any]] = {}
    captured_at = int(time.time() * 1000)
    try:
        with mss.mss() as screen_capture:
            for region in regions:
                region_id = str(region.get("id") or "")
                left = int(region.get("left") or 0)
                top = int(region.get("top") or 0)
                width = int(region.get("width") or 0)
                height = int(region.get("height") or 0)
                if not region_id or width <= 0 or height <= 0:
                    continue
                try:
                    screenshot = screen_capture.grab({
                        "left": left,
                        "top": top,
                        "width": width,
                        "height": height,
                    })
                    image = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
                    scale = min(
                        1.0,
                        TERMINAL_CAPTURE_MAX_WIDTH / width,
                        TERMINAL_CAPTURE_MAX_HEIGHT / height,
                    )
                    if scale < 1.0:
                        image = image.resize(
                            (
                                max(1, int(width * scale)),
                                max(1, int(height * scale)),
                            ),
                            Image.Resampling.BILINEAR,
                        )
                    output = BytesIO()
                    image.save(
                        output,
                        format="PNG",
                        compress_level=TERMINAL_CAPTURE_PNG_COMPRESSION,
                    )
                    png_bytes = output.getvalue()
                    captures[region_id] = {
                        "mime": "image/png",
                        "body": png_bytes,
                        "digest": hashlib.sha256(png_bytes).hexdigest(),
                        "width": image.width,
                        "height": image.height,
                        "captured_at": captured_at,
                    }
                except Exception as error:
                    ColorPrint.print_min_interval(
                        f"[TerminalCapture] Failed to capture {region_id}: {error}",
                        "1min",
                        "yellow",
                    )
    except Exception as error:
        ColorPrint.print_min_interval(
            f"[TerminalCapture] Native capture unavailable: {error}",
            "1min",
            "yellow",
        )
    return captures


def get_primary_monitor_size() -> Optional[Tuple[int, int]]:
    """
    Return (width, height) of the primary monitor without capturing pixels.

    Returns:
        Tuple of (width, height) or None on failure.
    """
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            return (monitor["width"], monitor["height"])
    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] get_primary_monitor_size: {e}", "1min", "red")
        return None


def scale_image_to_720p(
    image: "Image.Image",
    origin_left: int,
    origin_top: int
) -> Optional[Tuple["Image.Image", Tuple[int, int], Tuple[int, int], Tuple[float, float]]]:
    """
    Scale a PIL image to 720p (1280x720) maintaining aspect ratio (LANCZOS).

    The scale factor is derived from the image dimensions; the supplied screen
    origin (origin_left, origin_top) is scaled by the same factor so callers can
    translate window offsets into the scaled coordinate space.

    Args:
        image: Source PIL image (typically a cropped window region)
        origin_left: Screen X of the image's top-left (for offset scaling)
        origin_top: Screen Y of the image's top-left (for offset scaling)

    Returns:
        (scaled_image, scaled_offset, scaled_size, scale_ratio) or None on failure:
        - scaled_offset: (offset_x, offset_y) in scaled space
        - scaled_size: (new_width, new_height)
        - scale_ratio: (scale, scale)
    """
    try:
        window_width, window_height = image.size
        target_width = 1280
        target_height = 720

        scale_x = target_width / window_width
        scale_y = target_height / window_height
        scale = min(scale_x, scale_y)  # Maintain aspect ratio

        new_width = int(window_width * scale)
        new_height = int(window_height * scale)

        scaled_image = image.resize(
            (new_width, new_height),
            Image.Resampling.LANCZOS
        )

        scaled_offset_x = int(origin_left * scale)
        scaled_offset_y = int(origin_top * scale)

        return (scaled_image, (scaled_offset_x, scaled_offset_y), (new_width, new_height), (scale, scale))
    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] scale_image_to_720p: {e}", "1min", "red")
        return None
