"""YOLO dataset generation from in-memory annotated images."""

import random
import shlex
from pathlib import Path
from typing import Any, Dict, List, Sequence


def generate_yolo_dataset(
    entries: Sequence[Dict[str, Any]],
    class_names: Sequence[str],
    output_dir: Path,
    train_ratio: float = 0.8,
    seed: int = 42,
) -> Dict[str, Any]:
    """Write annotated PIL images and normalized YOLO labels."""
    dataset_dir = Path(output_dir)
    items = list(entries)
    if not items:
        return {"error": "No dataset entries"}
    if not class_names:
        return {"error": "No class names"}
    ratio = min(max(float(train_ratio), 0.0), 1.0)
    indexes = list(range(len(items)))
    random.Random(seed).shuffle(indexes)
    train_count = min(max(round(len(items) * ratio), 1), len(items))
    train_indexes = set(indexes[:train_count])

    for split in ("train", "val"):
        (dataset_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    saved_train = 0
    saved_val = 0
    for index, item in enumerate(items):
        image = item.get("image")
        if image is None or not hasattr(image, "size"):
            continue
        split = "train" if index in train_indexes else "val"
        stem = f"image_{index:06d}"
        image_path = dataset_dir / "images" / split / f"{stem}.png"
        label_path = dataset_dir / "labels" / split / f"{stem}.txt"
        image.save(image_path, format="PNG")
        label_lines = _build_label_lines(image.size, item.get("annotations") or [], len(class_names))
        label_path.write_text("\n".join(label_lines), encoding="utf-8")
        if split == "train":
            saved_train += 1
        else:
            saved_val += 1

    data_yaml_path = dataset_dir / "data.yaml"
    yaml_lines = [
        f"path: {dataset_dir.as_posix()}",
        "train: images/train",
        "val: images/val",
        f"nc: {len(class_names)}",
        "names:",
    ]
    yaml_lines.extend(f"  {index}: {_yaml_scalar(name)}" for index, name in enumerate(class_names))
    data_yaml_path.write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
    return {
        "error": None,
        "dataset_dir": str(dataset_dir),
        "data_yaml_path": str(data_yaml_path),
        "train_count": saved_train,
        "val_count": saved_val,
    }


def build_train_command(
    data_yaml_path: str,
    model: str = "yolov8n.pt",
    epochs: int = 50,
    imgsz: int = 640,
    batch: int = 16,
    device: str = "cpu",
) -> str:
    """Return an Ultralytics CLI command for a generated dataset."""
    values = {
        "data": str(data_yaml_path),
        "model": model,
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "device": device,
    }
    arguments = " ".join(f"{key}={shlex.quote(str(value))}" for key, value in values.items())
    return f"yolo detect train {arguments}"


def _build_label_lines(image_size: tuple[int, int], annotations: Sequence[Dict[str, Any]], class_count: int) -> List[str]:
    width, height = image_size
    lines = []
    if width <= 0 or height <= 0:
        return lines
    for annotation in annotations:
        class_id = int(annotation.get("class_id", -1))
        if class_id < 0 or class_id >= class_count:
            continue
        shape_type = annotation.get("type", "rect")
        x = float(annotation.get("x", 0))
        y = float(annotation.get("y", 0))
        if shape_type == "circle":
            radius = max(float(annotation.get("radius", 0)), 0.0)
            box_width = radius * 2.0
            box_height = radius * 2.0
            center_x = x
            center_y = y
        else:
            box_width = max(float(annotation.get("width", 0)), 0.0)
            box_height = max(float(annotation.get("height", 0)), 0.0)
            center_x = x + box_width / 2.0
            center_y = y + box_height / 2.0
        if box_width <= 0 or box_height <= 0:
            continue
        values = (
            center_x / width,
            center_y / height,
            box_width / width,
            box_height / height,
        )
        normalized = [min(max(value, 0.0), 1.0) for value in values]
        lines.append(f"{class_id} " + " ".join(f"{value:.6f}" for value in normalized))
    return lines


def _yaml_scalar(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


__all__ = ["build_train_command", "generate_yolo_dataset"]
