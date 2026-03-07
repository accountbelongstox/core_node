# -*- coding: utf-8 -*-
"""
Icon utilities: on Windows, optionally convert an image (e.g. PNG) to .ico when no .ico exists.
Used for window/taskbar icons (Tk iconbitmap prefers .ico on Windows).
"""

import sys
from pathlib import Path
from typing import Optional

_ICO_SIZES = (16, 32, 48, 256)


def get_icon_path_for_windows(image_path: Path | str) -> Path:
    """
    On Windows: if the given path is not .ico, ensure a .ico exists (same stem);
    convert from the image when missing and return the .ico path.
    On non-Windows: return the path as-is.
    """
    path = Path(image_path).resolve()
    if not path.exists():
        return path
    if sys.platform != "win32":
        return path
    if path.suffix.lower() == ".ico":
        return path
    ico_path = path.with_suffix(".ico")
    if ico_path.exists():
        return ico_path
    _convert_to_ico(path, ico_path)
    return ico_path if ico_path.exists() else path


def _convert_to_ico(image_path: Path, ico_path: Path) -> None:
    """Convert image to multi-size .ico using PIL when available."""
    try:
        from PIL import Image
    except ImportError:
        return
    try:
        img = Image.open(image_path).convert("RGBA")
    except Exception:
        return
    try:
        resampling = getattr(Image, "Resampling", Image).LANCZOS
    except AttributeError:
        resampling = Image.LANCZOS
    images = [img.resize((s, s), resampling) for s in _ICO_SIZES]
    try:
        images[0].save(ico_path, format="ICO", append_images=images[1:])
    except Exception:
        pass
