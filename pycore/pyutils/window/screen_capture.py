#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screen Capture Engine

Reusable mss-based capture primitives shared by the window screenshot facade:
- grab_fullscreen_pil: full primary-monitor capture (mss) -> PIL RGB Image
- capture_screen_region: native rect grab (mss sct.grab with monitor dict) -> PIL Image
- scale_image_to_720p: LANCZOS downscale to 1280x720 (aspect-preserving) + offset scaling
- get_primary_monitor_size: lightweight primary monitor (width, height) without pixel grab

One-directional dependency: imports only third-party access and shared utilities.
NEVER imports back into screenshot.py (avoids circular import within the window package).
"""

import hashlib
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_mss
from pycore.pyutils.common.activity_log import ActivityLog
from pycore.pyutils.common.relay_contract import relay_contract

# mss signals grab failures with ScreenShotError (OSError for display access).

TERMINAL_CAPTURE_MAX_WIDTH = relay_contract.limit(
    "terminal_screenshot_max_width"
)
TERMINAL_CAPTURE_MAX_HEIGHT = relay_contract.limit(
    "terminal_screenshot_max_height"
)
TERMINAL_CAPTURE_QUALITY = relay_contract.limit("terminal_screenshot_quality")
TERMINAL_CAPTURE_WEBP_METHOD = 4
TERMINAL_SIGNATURE_WIDTH = relay_contract.limit(
    "terminal_screenshot_signature_width"
)
TERMINAL_SIGNATURE_HEIGHT = relay_contract.limit(
    "terminal_screenshot_signature_height"
)
TERMINAL_SIGNATURE_LEVEL_STEP = 256 // relay_contract.limit(
    "terminal_screenshot_signature_levels"
)
DESKTOP_VIEW_MAX_WIDTH = relay_contract.limit("desktop_view_max_width")
DESKTOP_VIEW_MAX_HEIGHT = relay_contract.limit("desktop_view_max_height")
DESKTOP_VIEW_JPEG_QUALITY = relay_contract.limit("desktop_view_jpeg_quality")
screen_capture_activity_log = ActivityLog("ScreenCapture")


def grab_fullscreen_pil():
    """
    Capture the primary monitor full screen via mss and return a PIL RGB Image.

    Returns:
        PIL.Image.Image of the full primary monitor, or None on failure.
    """
    mss = get_third_package_mss()
    Image = get_third_package_PIL_Image()
    MSS_ERRORS = (mss.ScreenShotError, OSError) if mss is not None else (OSError,)
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            screenshot_mss = sct.grab(monitor)
            return Image.frombytes("RGB", screenshot_mss.size, screenshot_mss.rgb)
    except MSS_ERRORS as e:
        screen_capture_activity_log.error(
            "fullscreen.capture.failed",
            error_type=type(e).__name__,
            error=e,
        )
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
    mss = get_third_package_mss()
    Image = get_third_package_PIL_Image()
    MSS_ERRORS = (mss.ScreenShotError, OSError) if mss is not None else (OSError,)
    if width <= 0 or height <= 0:
        screen_capture_activity_log.error(
            "region.capture.rejected",
            width=width,
            height=height,
        )
        return None
    try:
        with mss.mss() as sct:
            monitor = {
                "left": left,
                "top": top,
                "width": width,
                "height": height,
            }
            screenshot = sct.grab(monitor)
            img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
        screen_capture_activity_log.success(
            "region.capture.completed",
            left=left,
            top=top,
            width=width,
            height=height,
        )
        return img
    except MSS_ERRORS as e:
        screen_capture_activity_log.error(
            "region.capture.failed",
            left=left,
            top=top,
            width=width,
            height=height,
            error_type=type(e).__name__,
            error=e,
        )
        return None


def grab_screen_regions(
    regions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Grab screen rectangles with mss; returns {region_id: PIL RGB image}."""
    mss = get_third_package_mss()
    Image = get_third_package_PIL_Image()
    MSS_ERRORS = (mss.ScreenShotError, OSError) if mss is not None else (OSError,)
    images: Dict[str, Any] = {}
    try:
        with mss.mss() as screen_capture:
            for region in regions:
                region_id = str(region.get("id") or "")
                width = int(region.get("width") or 0)
                height = int(region.get("height") or 0)
                if not region_id or width <= 0 or height <= 0:
                    continue
                screenshot = screen_capture.grab({
                    "left": int(region.get("left") or 0),
                    "top": int(region.get("top") or 0),
                    "width": width,
                    "height": height,
                })
                images[region_id] = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
    except MSS_ERRORS as error:
        screen_capture_activity_log.warning(
            "terminal_capture.unavailable",
            error_type=type(error).__name__,
            error=error,
        )
    return images


def encode_capture_image(image: "Image.Image", captured_at: int) -> Dict[str, Any]:
    """Downscale to the terminal preview limits and encode as a digest-addressed lossy image."""
    Image = get_third_package_PIL_Image()
    width, height = image.size
    scale = min(
        1.0,
        TERMINAL_CAPTURE_MAX_WIDTH / max(1, width),
        TERMINAL_CAPTURE_MAX_HEIGHT / max(1, height),
    )
    if scale < 1.0:
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.BILINEAR,
        )
    Image.init()
    if "WEBP" in Image.SAVE:
        image_format, mime = "WEBP", "image/webp"
        options = {"quality": TERMINAL_CAPTURE_QUALITY, "method": TERMINAL_CAPTURE_WEBP_METHOD}
    else:
        image_format, mime = "JPEG", "image/jpeg"
        options = {"quality": TERMINAL_CAPTURE_QUALITY}
    output = BytesIO()
    image.convert("RGB").save(output, format=image_format, **options)
    encoded = output.getvalue()
    return {
        "mime": mime,
        "body": encoded,
        "digest": hashlib.sha256(encoded).hexdigest(),
        "width": image.width,
        "height": image.height,
        "captured_at": captured_at,
    }


def frame_signature(image: "Image.Image") -> bytes:
    """Quantized grayscale thumbnail used to detect a visible change before encoding."""
    Image = get_third_package_PIL_Image()
    thumbnail = image.resize(
        (TERMINAL_SIGNATURE_WIDTH, TERMINAL_SIGNATURE_HEIGHT),
        Image.Resampling.BOX,
    ).convert("L")
    return bytes(value // TERMINAL_SIGNATURE_LEVEL_STEP for value in thumbnail.tobytes())


def frame_signature_distance(first: bytes, second: bytes) -> float:
    """Mean absolute level difference between two signatures, in thousandths of a level."""
    total = sum(abs(left - right) for left, right in zip(first, second))
    return 1000.0 * total / max(1, len(first))


def get_primary_monitor_rect() -> Optional[Dict[str, int]]:
    """Return the primary monitor rectangle {x, y, width, height} in desktop pixels, or None."""
    mss = get_third_package_mss()
    MSS_ERRORS = (mss.ScreenShotError, OSError) if mss is not None else (OSError,)
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            return {
                "x": int(monitor["left"]),
                "y": int(monitor["top"]),
                "width": int(monitor["width"]),
                "height": int(monitor["height"]),
            }
    except MSS_ERRORS as e:
        screen_capture_activity_log.error(
            "primary_monitor_rect.read.failed",
            error_type=type(e).__name__,
            error=e,
        )
        return None


def encode_desktop_jpeg(image: "Image.Image") -> bytes:
    """Downscale a desktop capture to the desktop-view limits and encode it as JPEG."""
    Image = get_third_package_PIL_Image()
    width, height = image.size
    scale = min(
        1.0,
        DESKTOP_VIEW_MAX_WIDTH / max(1, width),
        DESKTOP_VIEW_MAX_HEIGHT / max(1, height),
    )
    if scale < 1.0:
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.BILINEAR,
        )
    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=DESKTOP_VIEW_JPEG_QUALITY)
    return buffer.getvalue()


def get_primary_monitor_size() -> Optional[Tuple[int, int]]:
    """
    Return (width, height) of the primary monitor without capturing pixels.

    Returns:
        Tuple of (width, height) or None on failure.
    """
    mss = get_third_package_mss()
    MSS_ERRORS = (mss.ScreenShotError, OSError) if mss is not None else (OSError,)
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            return (monitor["width"], monitor["height"])
    except MSS_ERRORS as e:
        screen_capture_activity_log.error(
            "primary_monitor.read.failed",
            error_type=type(e).__name__,
            error=e,
        )
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
    Image = get_third_package_PIL_Image()
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
