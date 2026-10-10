# -*- coding: utf-8 -*-
"""Decoding and JPEG shrinking shared by terminal image uploads (compressed on receipt) and the history archive."""

from __future__ import annotations

import base64
import io
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageOps,
    get_third_package_rawpy,
)
from pycore.pyutils.common.relay_contract import relay_contract

UPLOAD_SHORT_SIDE = relay_contract.limit("terminal_image_compress_short_side")
UPLOAD_TARGET_BYTES = relay_contract.limit("terminal_image_compress_bytes")
UPLOAD_QUALITIES = (88, 80, 70, 60)
PREVIEW_SIDE = 640
PREVIEW_QUALITY = 70
MIN_SIDE = 64
SHRINK_FACTOR = 0.75
FLAT_BACKGROUND = (255, 255, 255)
JPEG_EXTENSION = "jpg"
JPEG_MIME = "image/jpeg"
DATA_URL_PREFIX = "data:image/jpeg;base64,"
# TIFF container: DNG and most camera raw files; decoded through LibRaw, plain TIFF through Pillow.
TIFF_SIGNATURES = (b"II*\x00", b"MM\x00*")
LABEL = "TerminalImageCompress"


def is_tiff_family(data: bytes) -> bool:
    return data[:4] in TIFF_SIGNATURES


def _decode_raw(data: bytes) -> Optional[Any]:
    """RGB image of a camera raw (DNG...); half-size demosaic whenever it still covers the target short side."""
    rawpy = get_third_package_rawpy()
    if rawpy is None:
        return None
    try:
        with rawpy.imread(io.BytesIO(data)) as raw:
            half = min(raw.sizes.width, raw.sizes.height) // 2 >= UPLOAD_SHORT_SIDE
            rgb = raw.postprocess(use_camera_wb=True, half_size=half, output_bps=8)
    except (rawpy.LibRawError, OSError, ValueError) as exc:
        ColorPrint.yellow(f"[{LABEL}] raw decode failed bytes={len(data)}: {exc}")
        return None
    return get_third_package_PIL_Image().fromarray(rgb)


def decode_image(data: bytes) -> Optional[Any]:
    """Upright decoded image, or None when neither LibRaw nor Pillow can read it."""
    image_module = get_third_package_PIL_Image()
    image = _decode_raw(data) if is_tiff_family(data) else None
    if image is None:
        try:
            image = image_module.open(io.BytesIO(data))
            image.load()
        except (OSError, ValueError, image_module.DecompressionBombError) as exc:
            ColorPrint.yellow(f"[{LABEL}] decode failed bytes={len(data)}: {exc}")
            return None
    return get_third_package_PIL_ImageOps().exif_transpose(image)


def flatten_rgb(image: Any) -> Any:
    """RGB copy; transparency lands on a white background."""
    image_module = get_third_package_PIL_Image()
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        flat = image_module.new("RGB", image.size, FLAT_BACKGROUND)
        flat.paste(image, mask=image.getchannel("A"))
        return flat
    return image.convert("RGB")


def scale_short_side(image: Any, short_side: int) -> Any:
    width, height = image.size
    shortest = min(width, height)
    if shortest <= short_side:
        return image
    size = (max(1, round(width * short_side / shortest)), max(1, round(height * short_side / shortest)))
    return image.resize(size, get_third_package_PIL_Image().Resampling.LANCZOS)


def encode_jpeg_within(image: Any, max_bytes: int, qualities: tuple, start_side: int) -> Optional[tuple]:
    """(JPEG bytes, frame) of an RGB image at most ``max_bytes``: lower quality first, then smaller sides."""
    image_module = get_third_package_PIL_Image()
    side = min(start_side, max(image.size))
    while side >= MIN_SIDE:
        frame = image.copy()
        frame.thumbnail((side, side), image_module.Resampling.LANCZOS)
        for quality in qualities:
            buffer = io.BytesIO()
            frame.save(buffer, format="JPEG", quality=quality, optimize=True)
            if buffer.tell() <= max_bytes:
                return buffer.getvalue(), frame
        side = int(side * SHRINK_FACTOR)
    return None


def preview_data_url(frame: Any) -> str:
    image = frame.copy()
    image.thumbnail((PREVIEW_SIDE, PREVIEW_SIDE), get_third_package_PIL_Image().Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=PREVIEW_QUALITY, optimize=True)
    return DATA_URL_PREFIX + base64.b64encode(buffer.getvalue()).decode("ascii")


def compress_upload(data: bytes, detected: Optional[tuple]) -> Optional[Dict[str, Any]]:
    """The image to store in place of the upload, or None when it cannot be decoded.

    Short side above the target is scaled down to it; any image still heavier than the target bytes is
    re-encoded as JPEG. A browser-readable image within both targets is kept as uploaded.
    """
    image = decode_image(data)
    if image is None:
        if detected is None or len(data) > UPLOAD_TARGET_BYTES:
            return None
        extension, mime = detected
        return {"data": data, "extension": extension, "mime": mime, "compressed": False, "original_bytes": len(data)}
    width, height = image.size
    kept = {
        "original_bytes": len(data),
        "original_width": width,
        "original_height": height,
    }
    if detected is not None and min(width, height) <= UPLOAD_SHORT_SIDE and len(data) <= UPLOAD_TARGET_BYTES:
        extension, mime = detected
        return {**kept, "data": data, "extension": extension, "mime": mime, "compressed": False, "width": width, "height": height}
    scaled = flatten_rgb(scale_short_side(image, UPLOAD_SHORT_SIDE))
    encoded = encode_jpeg_within(scaled, UPLOAD_TARGET_BYTES, UPLOAD_QUALITIES, max(scaled.size))
    if encoded is None:
        return None
    output, frame = encoded
    ColorPrint.cyan(
        f"[{LABEL}] compressed {width}x{height} {len(data)}B -> {frame.width}x{frame.height} {len(output)}B"
    )
    return {
        **kept,
        "data": output,
        "extension": JPEG_EXTENSION,
        "mime": JPEG_MIME,
        "compressed": True,
        "width": frame.width,
        "height": frame.height,
        "preview_url": preview_data_url(frame),
    }
