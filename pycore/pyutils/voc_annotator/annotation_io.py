# -*- coding: utf-8 -*-
"""
Unified annotation IO: JSON shapes (rectangle, polygon, ellipse, circle) and VOC XML export.
Per DESIGN.md §14: one JSON per image; VOC XML for rectangle-only detection pipeline.
Bridge: load_entries_for_ultralytics() builds entries for pycore.ultralytics.annotation_to_yolo_dataset.
"""

import json
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from . import voc_io

SHAPE_TYPE_RECTANGLE = "rectangle"
SHAPE_TYPE_POLYGON = "polygon"
SHAPE_TYPE_ELLIPSE = "ellipse"
SHAPE_TYPE_CIRCLE = "circle"


def _json_path_for_image(image_path: str, save_dir: str) -> str:
    base = os.path.splitext(os.path.basename(image_path))[0]
    return os.path.join(save_dir, base + ".json")


def _ensure_points(shape: Dict) -> List[List[float]]:
    pts = shape.get("points")
    if isinstance(pts, list) and len(pts) >= 1:
        return [[float(p[0]), float(p[1])] for p in pts if isinstance(p, (list, tuple)) and len(p) >= 2]
    return []


def shape_to_bbox(shape: Dict) -> Optional[Tuple[int, int, int, int]]:
    """Return (xmin, ymin, xmax, ymax) for VOC/display; None if not a rectangle or invalid."""
    if shape.get("shape_type") != SHAPE_TYPE_RECTANGLE:
        pts = _ensure_points(shape)
        if len(pts) >= 2:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            return (int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys)))
        return None
    pts = _ensure_points(shape)
    if len(pts) >= 2:
        x1, y1 = pts[0][0], pts[0][1]
        x2, y2 = pts[1][0], pts[1][1]
        return (int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2)))
    return None


def shapes_to_boxes(shapes: List[Dict]) -> List[Tuple[str, int, int, int, int, int]]:
    """Convert shapes to list of (class_name, xmin, ymin, xmax, ymax, difficult) for VOC."""
    out = []
    for s in shapes:
        bbox = shape_to_bbox(s)
        if bbox is None:
            continue
        xmin, ymin, xmax, ymax = bbox
        label = (s.get("label") or "").strip()
        difficult = int(s.get("difficult", 0))
        out.append((label, xmin, ymin, xmax, ymax, difficult))
    return out


def boxes_to_shapes(boxes: List[Tuple[str, int, int, int, int, int]]) -> List[Dict]:
    """Convert VOC-style boxes to rectangle shapes."""
    return [
        {
            "shape_type": SHAPE_TYPE_RECTANGLE,
            "label": name,
            "points": [[xmin, ymin], [xmax, ymax]],
            "difficult": difficult,
        }
        for (name, xmin, ymin, xmax, ymax, difficult) in boxes
    ]


def load_annotations(
    image_path: str,
    save_dir: str,
    image_size: Optional[Tuple[int, int]] = None,
) -> List[Dict]:
    """
    Load shapes for one image: prefer JSON; fallback to VOC XML (rectangles only).
    Returns list of shape dicts (shape_type, label, points, difficult).
    """
    json_path = _json_path_for_image(image_path, save_dir)
    if os.path.isfile(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            shapes = data.get("shapes")
            if isinstance(shapes, list):
                return list(shapes)
        except (OSError, json.JSONDecodeError):
            pass
    xml_path = _xml_path_for_image(image_path, save_dir)
    boxes = voc_io.read_boxes_from_voc(xml_path)
    return boxes_to_shapes(boxes)


def save_annotations(
    image_path: str,
    save_dir: str,
    image_size: Tuple[int, int],
    shapes: List[Dict],
    write_voc: bool = True,
) -> None:
    """
    Save shapes to JSON; if write_voc, also write VOC XML from rectangle shapes (GameAISDK).
    """
    base = os.path.splitext(os.path.basename(image_path))[0]
    json_path = os.path.join(save_dir, base + ".json")
    data = {
        "imagePath": os.path.basename(image_path),
        "imageSize": list(image_size),
        "shapes": shapes,
    }
    os.makedirs(save_dir or ".", exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    if write_voc:
        boxes = shapes_to_boxes(shapes)
        xml_path = os.path.join(save_dir, base + ".xml")
        voc_io.write_voc_xml(xml_path, image_path, image_size, boxes)


def _xml_path_for_image(image_path: str, save_dir: str) -> str:
    base = os.path.splitext(os.path.basename(image_path))[0]
    return os.path.join(save_dir, base + ".xml")


# ---------------------------------------------------------------------------
# YOLO export (Ultralytics official format)
# Detect: one .txt per image, each row "class_id x_center y_center width height" normalized [0,1].
# Segment: one .txt per image, each row "class_id x1 y1 x2 y2 ..." normalized [0,1], min 3 points.
# ---------------------------------------------------------------------------


def _shape_to_normalized_polygon(
    shape: Dict,
    width: int,
    height: int,
) -> Optional[List[Tuple[float, float]]]:
    """Return list of (x_norm, y_norm) in [0,1] for YOLO segment; None if invalid or too few points."""
    if width <= 0 or height <= 0:
        return None
    pts = _ensure_points(shape)
    st = shape.get("shape_type", SHAPE_TYPE_RECTANGLE)
    if st == SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
        x1, y1 = pts[0][0], pts[0][1]
        x2, y2 = pts[1][0], pts[1][1]
        xmin, xmax = min(x1, x2), max(x1, x2)
        ymin, ymax = min(y1, y2), max(y1, y2)
        return [
            (xmin / width, ymin / height),
            (xmax / width, ymin / height),
            (xmax / width, ymax / height),
            (xmin / width, ymax / height),
        ]
    if st == SHAPE_TYPE_POLYGON and len(pts) >= 3:
        return [(p[0] / width, p[1] / height) for p in pts]
    if st in (SHAPE_TYPE_ELLIPSE, SHAPE_TYPE_CIRCLE) and len(pts) >= 2:
        cx, cy = pts[0][0], pts[0][1]
        rx = abs(pts[1][0] - cx) if len(pts) > 1 else 0
        ry = abs(pts[1][1] - cy) if len(pts) > 1 else rx
        if rx <= 0 and ry <= 0:
            return None
        if rx <= 0:
            rx = ry
        if ry <= 0:
            ry = rx
        n = max(12, int(2 * math.pi * max(rx, ry) / 10))
        out = []
        for i in range(n):
            t = 2 * math.pi * i / n
            out.append(((cx + rx * math.cos(t)) / width, (cy + ry * math.sin(t)) / height))
        return out
    return None


def export_yolo_segment_txt(
    txt_path: str,
    image_size: Tuple[int, int],
    shapes: List[Dict],
    classes: List[str],
) -> int:
    """
    Write one YOLO segment .txt file (Ultralytics format).
    Each row: class_id x1 y1 x2 y2 ... (normalized [0,1], min 3 points).
    Skips shapes with label not in classes or difficult==1. Returns count of lines written.
    """
    w, h = image_size
    if w <= 0 or h <= 0:
        return 0
    lines = []
    for s in shapes:
        if int(s.get("difficult", 0)) == 1:
            continue
        label = (s.get("label") or "").strip()
        if label not in classes:
            continue
        cls_id = classes.index(label)
        poly = _shape_to_normalized_polygon(s, w, h)
        if poly is None or len(poly) < 3:
            continue
        parts = [str(cls_id)] + ["%.6f" % c for p in poly for c in p]
        lines.append(" ".join(parts))
    if not lines:
        return 0
    os.makedirs(os.path.dirname(txt_path) or ".", exist_ok=True)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(lines)


def export_yolo_detection_txt(
    txt_path: str,
    image_size: Tuple[int, int],
    shapes: List[Dict],
    classes: List[str],
) -> int:
    """
    Write one YOLO detection .txt file (Ultralytics/GameAISDK format).
    Each row: class_id x_center y_center width height (normalized [0,1]).
    Skips shapes with label not in classes or difficult==1. Returns count of lines written.
    """
    w, h = image_size
    if w <= 0 or h <= 0:
        return 0
    boxes = shapes_to_boxes(shapes)
    if not classes:
        return 0
    lines = []
    dw, dh = 1.0 / w, 1.0 / h
    for (label, xmin, ymin, xmax, ymax, difficult) in boxes:
        if difficult == 1 or label not in classes:
            continue
        cls_id = classes.index(label)
        x_center = (xmin + xmax) / 2.0
        y_center = (ymin + ymax) / 2.0
        bw = xmax - xmin
        bh = ymax - ymin
        lines.append("%d %.6f %.6f %.6f %.6f" % (cls_id, x_center * dw, y_center * dh, bw * dw, bh * dh))
    if not lines:
        return 0
    os.makedirs(os.path.dirname(txt_path) or ".", exist_ok=True)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(lines)
