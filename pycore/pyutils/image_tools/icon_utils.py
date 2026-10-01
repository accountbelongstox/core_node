# -*- coding: utf-8 -*-
"""
Icon utilities: on Windows, optionally convert an image (e.g. PNG) to .ico when no .ico exists.
Used for window/taskbar icons (Tk iconbitmap prefers .ico on Windows).
"""

import sys
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image


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
    """Convert image to multi-size .ico using PIL."""
    Image = get_third_package_PIL_Image()
    try:
        img = Image.open(image_path).convert("RGBA")
        images = [img.resize((s, s), Image.Resampling.LANCZOS) for s in _ICO_SIZES]
        images[0].save(ico_path, format="ICO", append_images=images[1:])
    except OSError as exc:
        ColorPrint.yellow(f"[icon_utils] ICO conversion failed source={image_path} target={ico_path}: {exc}")
