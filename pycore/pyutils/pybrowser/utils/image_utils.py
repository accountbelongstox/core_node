"""Image loading, saving, and composition helpers."""

from io import BytesIO
from pathlib import Path
from typing import Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_requests


class ImageUtils:
    @staticmethod
    def load_image(source: str) -> Optional[Any]:
        image_module = get_third_package_PIL_Image()
        requests = get_third_package_requests()
        try:
            if source.startswith(("http://", "https://")):
                response = requests.get(source, timeout=30)
                response.raise_for_status()
                image = image_module.open(BytesIO(response.content))
            else:
                image = image_module.open(source)
            image.load()
        except (OSError, requests.exceptions.RequestException) as e:
            ColorPrint.yellow(f"[ImageUtils] Failed to load image: source={source} error={e}")
            return None
        return image

    @staticmethod
    def save_image(image: Any, path: str, format: Optional[str] = None) -> bool:
        output_path = Path(path)
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path, format=format)
        except (OSError, ValueError) as e:
            ColorPrint.yellow(f"[ImageUtils] Failed to save image: path={output_path} error={e}")
            return False
        return True

    @staticmethod
    def merge_images_horizontal(images: List[Any], spacing: int = 0) -> Optional[Any]:
        return ImageUtils._merge(images, columns=len(images), spacing=spacing)

    @staticmethod
    def merge_images_vertical(images: List[Any], spacing: int = 0) -> Optional[Any]:
        return ImageUtils._merge(images, columns=1, spacing=spacing)

    @staticmethod
    def merge_images_grid(images: List[Any], cols: int = 2, spacing: int = 0) -> Optional[Any]:
        return ImageUtils._merge(images, columns=max(cols, 1), spacing=spacing)

    @staticmethod
    def _merge(images: List[Any], columns: int, spacing: int) -> Optional[Any]:
        if not images:
            return None
        image_module = get_third_package_PIL_Image()
        rows = (len(images) + columns - 1) // columns
        column_widths = [0] * columns
        row_heights = [0] * rows
        for index, image in enumerate(images):
            column = index % columns
            row = index // columns
            column_widths[column] = max(column_widths[column], image.width)
            row_heights[row] = max(row_heights[row], image.height)
        width = sum(column_widths) + spacing * max(columns - 1, 0)
        height = sum(row_heights) + spacing * max(rows - 1, 0)
        canvas = image_module.new("RGBA", (width, height), (255, 255, 255, 0))
        y = 0
        for row in range(rows):
            x = 0
            for column in range(columns):
                index = row * columns + column
                if index < len(images):
                    image = images[index]
                    canvas.paste(image, (x, y), image if image.mode == "RGBA" else None)
                x += column_widths[column] + spacing
            y += row_heights[row] + spacing
        return canvas


__all__ = ["ImageUtils"]
