#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build YOLO dataset from annotated images (detection + segmentation).
Output conforms to Ultralytics YOLO format:
- Dir layout: images/train, images/val, labels/train, labels/val; path + train/val point to image dirs.
- data.yaml: path, train, val, nc, names (dict 0..nc-1); len(names)==nc.
- Labels: one .txt per image that has objects.
  Segmentation format (per Ultralytics instance segmentation): one line per object,
  "class_id x1 y1 x2 y2 ..." normalized 0-1, at least 3 (x,y) points per polygon.
  rect -> 4 corners; circle -> 32 points; polygon/freehand -> vertices.
- No .txt for images with zero objects (per Ultralytics docs).
"""

from pathlib import Path
import random
import shutil
import math
from typing import List, Dict, Tuple, Any, Optional

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

PIL_Image = get_third_package_PIL_Image()


def _annotation_to_segment_line(ann: Dict, img_w: int, img_h: int) -> Optional[str]:
    """Convert one annotation to YOLO segmentation line: class_id x1 y1 x2 y2 ... (normalized 0-1)."""
    if img_w <= 0 or img_h <= 0:
        return None
    cid = ann.get("class_id", 0)
    kind = ann.get("type", "rect")
    points: List[Tuple[float, float]] = []
    if kind == "rect":
        x = float(ann.get("x", 0))
        y = float(ann.get("y", 0))
        w = float(ann.get("width", 0))
        h = float(ann.get("height", 0))
        points = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    elif kind == "circle":
        cx = float(ann.get("x", 0))
        cy = float(ann.get("y", 0))
        r = float(ann.get("radius", 0))
        n = 32
        for i in range(n):
            t = 2 * math.pi * i / n
            points.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    elif kind == "polygon":
        verts = ann.get("vertices") or []
        for v in verts:
            if len(v) >= 2:
                points.append((float(v[0]), float(v[1])))
    else:
        return None
    if len(points) < 3:
        return None
    normalized = []
    for px, py in points:
        nx = max(0.0, min(1.0, px / img_w))
        ny = max(0.0, min(1.0, py / img_h))
        normalized.extend([nx, ny])
    return f"{cid} " + " ".join(f"{v:.6f}" for v in normalized)


def _annotation_to_bbox(ann: Dict, img_w: int, img_h: int) -> Tuple[float, float, float, float]:
    """Convert one annotation to normalized YOLO bbox (cx, cy, nw, nh)."""
    kind = ann.get("type", "rect")
    if kind == "rect":
        x = ann.get("x", 0)
        y = ann.get("y", 0)
        w = ann.get("width", 0)
        h = ann.get("height", 0)
    elif kind == "polygon":
        verts = ann.get("vertices") or []
        if not verts:
            return 0.5, 0.5, 0.01, 0.01
        xs = [v[0] for v in verts]
        ys = [v[1] for v in verts]
        x = min(xs)
        y = min(ys)
        w = max(xs) - x
        h = max(ys) - y
    else:
        cx = ann.get("x", 0)
        cy = ann.get("y", 0)
        r = ann.get("radius", 0)
        x = cx - r
        y = cy - r
        w = 2 * r
        h = 2 * r
    if img_w <= 0 or img_h <= 0:
        return 0.5, 0.5, 0.01, 0.01
    center_x = (x + w / 2) / img_w
    center_y = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    center_x = max(0, min(1, center_x))
    center_y = max(0, min(1, center_y))
    nw = max(1e-6, min(1, nw))
    nh = max(1e-6, min(1, nh))
    return center_x, center_y, nw, nh


def generate_yolo_dataset(
    entries: List[Dict[str, Any]],
    class_names: List[str],
    output_dir: Path,
    train_ratio: float = 0.8,
    seed: int = 42,
    image_format: str = "png",
) -> Dict[str, Any]:
    """
    Generate YOLO segmentation dataset from annotated entries.

    Each entry must have:
      - "image_path": Path to image file, or
      - "image": PIL.Image (saved to output_dir)
      - "annotations": List[Dict] with "class_id", "type" ("rect"|"circle"|"polygon"),
        rect: x,y,width,height; circle: x,y,radius; polygon: vertices [[x,y],...]

    Label format: one line per object, "class_id x1 y1 x2 y2 ..." normalized 0-1 (Ultralytics segmentation).

    Creates:
      output_dir/images/train, output_dir/images/val
      output_dir/labels/train, output_dir/labels/val
      output_dir/data.yaml

    Returns dict with output_dir, data_yaml_path, train_count, val_count, class_counts_train, class_counts_val.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    train_img_dir = output_dir / "images" / "train"
    val_img_dir = output_dir / "images" / "val"
    train_lbl_dir = output_dir / "labels" / "train"
    val_lbl_dir = output_dir / "labels" / "val"
    for d in (train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir):
        d.mkdir(parents=True, exist_ok=True)

    resolved: List[Tuple[Path, List[Dict], int, int]] = []
    staging = output_dir / "_staging"
    staging.mkdir(parents=True, exist_ok=True)
    try:
        for i, item in enumerate(entries):
            anns = item.get("annotations") or []
            image_path = item.get("image_path")
            pil_image = item.get("image")
            if image_path is not None:
                image_path = Path(image_path)
                if not image_path.exists():
                    continue
            elif pil_image is not None:
                image_path = staging / f"img_{i:05d}.{image_format}"
                pil_image.save(str(image_path))
            else:
                continue
            try:
                img = PIL_Image.open(str(image_path))
                img_w, img_h = img.size
            except Exception:
                continue
            resolved.append((image_path, anns, img_w, img_h))

        if not resolved:
            return {
                "output_dir": str(output_dir),
                "data_yaml_path": str(output_dir / "data.yaml"),
                "train_count": 0,
                "val_count": 0,
                "class_counts_train": {},
                "class_counts_val": {},
                "error": "No valid entries",
            }

        rng = random.Random(seed)
        indices = list(range(len(resolved)))
        rng.shuffle(indices)
        n_train = max(1, int(len(resolved) * train_ratio))
        n_val = len(resolved) - n_train
        if n_val == 0 and len(resolved) > 1:
            n_val = 1
            n_train = len(resolved) - 1
        train_indices = set(indices[:n_train])
        val_indices = set(indices[n_train:])

        class_counts_train: Dict[int, int] = {}
        class_counts_val: Dict[int, int] = {}

        for idx, (img_path, anns, img_w, img_h) in enumerate(resolved):
            is_train = idx in train_indices
            if is_train:
                img_out = train_img_dir / f"img_{idx:05d}.{image_format}"
                lbl_dir = train_lbl_dir
                counts = class_counts_train
            else:
                img_out = val_img_dir / f"img_{idx:05d}.{image_format}"
                lbl_dir = val_lbl_dir
                counts = class_counts_val
            if img_path.resolve() != img_out.resolve():
                shutil.copy2(str(img_path), str(img_out))
            lines = []
            for a in anns:
                cid = a.get("class_id", 0)
                if cid < 0 or cid >= len(class_names):
                    continue
                line = _annotation_to_segment_line(a, img_w, img_h)
                if line:
                    lines.append(line)
                    counts[cid] = counts.get(cid, 0) + 1
            # Ultralytics: one .txt per image; no .txt required when image has no objects
            if lines:
                lbl_path = lbl_dir / f"img_{idx:05d}.txt"
                lbl_path.write_text("\n".join(lines), encoding="utf-8")

        nc = len(class_names)
        # path: use forward slashes for portability; train/val relative to path (images dirs)
        # names: dict 0..nc-1 for compatibility with Ultralytics check_det_dataset
        path_str = Path(output_dir).resolve().as_posix()
        names_dict = dict(enumerate(class_names))
        data_yaml = (
            f"path: {path_str}\n"
            f"train: images/train\n"
            f"val: images/val\n"
            f"nc: {nc}\n"
            f"names: {names_dict}\n"
        )
        (output_dir / "data.yaml").write_text(data_yaml, encoding="utf-8")

        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)

        return {
            "output_dir": str(output_dir),
            "data_yaml_path": str(output_dir / "data.yaml"),
            "train_count": len(train_indices),
            "val_count": len(val_indices),
            "class_counts_train": class_counts_train,
            "class_counts_val": class_counts_val,
        }
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)


def build_train_command(data_yaml_path: str, model: str = "yolov8n.pt", epochs: int = 50, imgsz: int = 640, batch: int = 16, device: str = "cpu") -> str:
    """Build one-line YOLO train command (ultralytics CLI style)."""
    return (
        f'python -m ultralytics train model={model} data="{data_yaml_path}" '
        f"epochs={epochs} imgsz={imgsz} batch={batch} device={device}"
    )
