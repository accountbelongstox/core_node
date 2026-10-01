# -*- coding: utf-8 -*-
"""PIL-backed image file I/O (Unicode-safe paths) with OpenCV BGR/BGRA conversion."""

from pathlib import Path
from typing import Any, Union

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image

cv2 = get_third_package_cv2()
np = get_third_package_numpy()
PILImage = get_third_package_PIL_Image()

ImagePath = Union[str, Path]


def load_rgb_pil(image_path: ImagePath) -> Any:
    """PIL RGB image; ValueError when the file cannot be read."""
    try:
        pil_image = PILImage.open(str(image_path))
        return pil_image if pil_image.mode == "RGB" else pil_image.convert("RGB")
    except OSError as exc:
        raise ValueError(f"Failed to load image: {image_path}. Error: {exc}") from exc


def load_bgr(image_path: ImagePath, keep_alpha: bool = False) -> Any:
    """OpenCV array (BGR, or BGRA when keep_alpha and the file has alpha); ValueError on read failure."""
    try:
        pil_image = PILImage.open(str(image_path))
        if keep_alpha and pil_image.mode in ("RGBA", "LA"):
            return cv2.cvtColor(np.array(pil_image.convert("RGBA")), cv2.COLOR_RGBA2BGRA)
        rgb = pil_image if pil_image.mode == "RGB" else pil_image.convert("RGB")
        return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
    except OSError as exc:
        raise ValueError(f"Failed to load image: {image_path}. Error: {exc}") from exc


def save_bgr(image: Any, output_path: ImagePath) -> None:
    """Write an OpenCV BGR array; ValueError when the file cannot be written."""
    try:
        PILImage.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)).save(str(output_path))
    except OSError as exc:
        raise ValueError(f"Failed to save image: {output_path}. Error: {exc}") from exc
