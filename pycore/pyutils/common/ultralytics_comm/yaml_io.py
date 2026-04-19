# -*- coding: utf-8 -*-
"""data.yaml build and write (Ultralytics dataset config)."""

import os
from typing import List, Optional

from .layout import IMAGES_SUBDIR, DATA_YAML_NAME


def build_data_yaml_content(
    path_str: str,
    train_subdir: str,
    val_subdir: str,
    classes: List[str],
    comment: str = "YOLO dataset config (Ultralytics).",
) -> str:
    path_str = path_str.replace("\\", "/")
    nc = len(classes)
    lines = [
        "# " + comment,
        "path: " + path_str,
        "train: " + train_subdir,
        "val: " + val_subdir,
        "nc: %d" % nc,
        "names:",
    ]
    for i, name in enumerate(classes):
        lines.append("  %d: %s" % (i, name))
    return "\n".join(lines) + "\n"


def write_data_yaml(
    segment_dir: str,
    classes: List[str],
    train_subdir: Optional[str] = None,
    val_subdir: Optional[str] = None,
) -> str:
    if train_subdir is None:
        train_subdir = IMAGES_SUBDIR
    val = val_subdir if val_subdir else train_subdir
    path_abs = os.path.abspath(segment_dir)
    content = build_data_yaml_content(path_abs, train_subdir, val, classes)
    yaml_path = os.path.join(segment_dir, DATA_YAML_NAME)
    os.makedirs(segment_dir, exist_ok=True)
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(content)
    return yaml_path
