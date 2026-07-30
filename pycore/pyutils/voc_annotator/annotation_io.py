"""Annotation export helpers."""

from pathlib import Path
from typing import Any, Dict, Iterable, Sequence


def export_yolo_segment_txt(
    output_path: str,
    image_size: tuple[int, int],
    shapes: Iterable[Dict[str, Any]],
    classes: Sequence[str],
) -> int:
    """Export LabelMe-style polygon shapes to Ultralytics segment rows."""
    width, height = image_size
    if width <= 0 or height <= 0:
        return 0
    class_indexes = {name: index for index, name in enumerate(classes)}
    lines = []
    for shape in shapes:
        label = str(shape.get("label") or "")
        class_id = class_indexes.get(label)
        points = shape.get("points")
        if class_id is None or not isinstance(points, list) or len(points) < 3:
            continue
        coordinates = []
        for point in points:
            if not isinstance(point, (list, tuple)) or len(point) < 2:
                coordinates = []
                break
            x = min(max(float(point[0]) / width, 0.0), 1.0)
            y = min(max(float(point[1]) / height, 0.0), 1.0)
            coordinates.extend((x, y))
        if len(coordinates) < 6:
            continue
        lines.append(f"{class_id} " + " ".join(f"{value:.6f}" for value in coordinates))
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    return len(lines)


__all__ = ["export_yolo_segment_txt"]
