"""Canonical filesystem layout for recorded and generated YOLO data."""

import os
from pathlib import Path
from typing import Iterable, Optional, Tuple


IMAGES_SUBDIR = "images"
LABELS_SUBDIR = "labels"
RECORD_SUBDIR = "record"
FRAMES_SUBDIR = "frames"
DATA_YAML_NAME = "data.yaml"
YOLO_DATA_ROOT = os.path.abspath(os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data"))


def get_yolo_data_root() -> str:
    return YOLO_DATA_ROOT


def get_yolo_project_path(client_type: str, project_name: str) -> str:
    return str(_root_join(client_type, project_name))


def get_yolo_segment_path(client_type: str, project_name: str, segment_id: str) -> str:
    return str(_root_join(client_type, project_name, segment_id))


def get_yolo_record_dir(client_type: str, project_name: str, segment_id: str) -> str:
    return str(_root_join(client_type, project_name, segment_id, RECORD_SUBDIR))


def ensure_yolo_segment_dirs_3(client_type: str, project_name: str, segment_id: str) -> str:
    segment_path = _root_join(client_type, project_name, segment_id)
    for subdirectory in (RECORD_SUBDIR, FRAMES_SUBDIR, IMAGES_SUBDIR, LABELS_SUBDIR):
        (segment_path / subdirectory).mkdir(parents=True, exist_ok=True)
    return str(segment_path)


def parse_project_path_to_client_project(project_path: str) -> Tuple[Optional[str], Optional[str]]:
    root = Path(YOLO_DATA_ROOT).resolve()
    try:
        relative_parts = Path(project_path).resolve().relative_to(root).parts
    except (OSError, ValueError):
        return None, None
    if len(relative_parts) < 2:
        return None, None
    return relative_parts[0], relative_parts[1]


def get_yolo_data_dir(project_name: str, segment_id: str) -> str:
    return str(_root_join(project_name, segment_id))


def ensure_yolo_segment_dirs(project_name: str, segment_id: str) -> str:
    segment_path = _root_join(project_name, segment_id)
    (segment_path / IMAGES_SUBDIR).mkdir(parents=True, exist_ok=True)
    (segment_path / LABELS_SUBDIR).mkdir(parents=True, exist_ok=True)
    return str(segment_path)


def get_yolo_generated_root(client_type: Optional[str] = None) -> str:
    root = _root_join("_generated")
    return str(root / _safe_component(client_type)) if client_type else str(root)


def get_yolo_generated_dataset_path(client_type: str, dataset_name: str) -> str:
    return str(_root_join("_generated", client_type, dataset_name))


def write_data_yaml(dataset_dir: str, classes: Iterable[str]) -> str:
    root = Path(dataset_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    class_names = [str(name) for name in classes]
    lines = [
        f"path: {root.as_posix()}",
        f"train: {IMAGES_SUBDIR}",
        f"val: {IMAGES_SUBDIR}",
        f"nc: {len(class_names)}",
        "names:",
    ]
    lines.extend(f"  {index}: '{name.replace(chr(39), chr(39) * 2)}'" for index, name in enumerate(class_names))
    output_path = root / DATA_YAML_NAME
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)


def _root_join(*parts: str) -> Path:
    path = Path(YOLO_DATA_ROOT)
    for part in parts:
        path /= _safe_component(part)
    return path.resolve()


def _safe_component(value: str) -> str:
    component = str(value or "").strip()
    if not component or component in {".", ".."} or Path(component).name != component:
        raise ValueError(f"Invalid YOLO path component: {value!r}")
    return component


__all__ = [
    "DATA_YAML_NAME",
    "FRAMES_SUBDIR",
    "IMAGES_SUBDIR",
    "LABELS_SUBDIR",
    "RECORD_SUBDIR",
    "YOLO_DATA_ROOT",
    "ensure_yolo_segment_dirs",
    "ensure_yolo_segment_dirs_3",
    "get_yolo_data_dir",
    "get_yolo_data_root",
    "get_yolo_generated_dataset_path",
    "get_yolo_generated_root",
    "get_yolo_project_path",
    "get_yolo_record_dir",
    "get_yolo_segment_path",
    "parse_project_path_to_client_project",
    "write_data_yaml",
]
