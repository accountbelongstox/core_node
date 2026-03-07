# -*- coding: utf-8 -*-
"""
D3-check: generate YOLO dataset from UI-collected screenshot_history.
Output: YOLO_DATA_ROOT/_generated/{client_type}/yolo_dataset_YYYYMMDD_HHMMSS (or output_dir if given).
"""

from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from pycore.pyutils.ultralytics.annotation_to_yolo_dataset import (
    generate_yolo_dataset,
    build_train_command,
)
from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.common import YOLO_DATASET_BASE_DIR

try:
    from pycore.pyutils.voc_annotator.yolo_data_layout import get_yolo_generated_dataset_path
except ImportError:
    get_yolo_generated_dataset_path = None


def generate_dataset_from_screenshot_history(
    screenshot_history: List[Dict[str, Any]],
    class_names: List[str],
    train_ratio: float = 0.8,
    output_dir: Optional[Path] = None,
    client_type: str = "d3_game",
) -> Dict[str, Any]:
    """
    Build YOLO dataset from screenshot_history. If output_dir is given, use it;
    otherwise create under YOLO_DATA_ROOT/_generated/{client_type}/yolo_dataset_YYYYMMDD_HHMMSS.

    screenshot_history: list of {
        "image": PIL.Image,
        "annotations": [ {"class_id": int, "type": "rect"|"circle", "x", "y", "width"?, "height"?, "radius"? }, ... ]
    }
    class_names: list of class name strings (index = class_id).

    Returns dict from generate_yolo_dataset plus "train_command" and "dataset_dir".
    """
    if not class_names:
        ColorPrint.red("[YOLO_DATASET] No class names")
        return {"error": "No class names", "train_command": ""}
    if not screenshot_history:
        ColorPrint.red("[YOLO_DATASET] No screenshots")
        return {"error": "No screenshots", "train_command": ""}

    if output_dir is not None:
        dataset_dir = Path(output_dir)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        folder_name = f"yolo_dataset_{timestamp}"
        if get_yolo_generated_dataset_path:
            dataset_dir = Path(get_yolo_generated_dataset_path(client_type or "d3_game", folder_name))
        else:
            dataset_dir = YOLO_DATASET_BASE_DIR / folder_name
    dataset_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for item in screenshot_history:
        image = item.get("image")
        annotations = item.get("annotations") or []
        entries.append({"image": image, "annotations": annotations})

    result = generate_yolo_dataset(
        entries=entries,
        class_names=class_names,
        output_dir=dataset_dir,
        train_ratio=train_ratio,
    )
    if result.get("error"):
        result["train_command"] = ""
        result["dataset_dir"] = str(dataset_dir)
        return result

    data_yaml_path = result["data_yaml_path"]
    result["train_command"] = build_train_command(
        data_yaml_path,
        model="yolov8n.pt",
        epochs=50,
        imgsz=640,
        batch=16,
        device="cpu",
    )
    result["dataset_dir"] = str(dataset_dir)
    ColorPrint.green(f"[YOLO_DATASET] Generated: {dataset_dir}")
    ColorPrint.green(f"[YOLO_DATASET] Train: {result['train_count']}, Val: {result['val_count']}")
    return result
