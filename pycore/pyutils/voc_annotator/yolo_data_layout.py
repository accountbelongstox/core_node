# -*- coding: utf-8 -*-
"""
YOLO unified directory layout (single root YOLO_DATA_ROOT).
Layout: {YOLO_DATA_ROOT}/{client_type}/{project_name}/{segment_id}/
Segment contains: record/, frames/, images/, labels/, data.yaml.
Also provides paths for _generated, _datasets, _models, _sources.
"""

import os
from typing import List, Optional, Tuple

from pycore.pyutils.common import ultralytics_comm

# Re-export layout constants for callers
IMAGES_SUBDIR = ultralytics_comm.IMAGES_SUBDIR
LABELS_SUBDIR = ultralytics_comm.LABELS_SUBDIR
DATA_YAML_NAME = ultralytics_comm.DATA_YAML_NAME

# Segment subdirs (unified design)
RECORD_SUBDIR = "record"
FRAMES_SUBDIR = "frames"

# Top-level partitions under YOLO_DATA_ROOT
GENERATED_DIR_NAME = "_generated"
DATASETS_DIR_NAME = "_datasets"
MODELS_DIR_NAME = "_models"
SOURCES_DIR_NAME = "_sources"

# Default root for all YOLO data (env or default)
YOLO_DATA_ROOT = os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")


def _get_root() -> str:
    return os.path.abspath(YOLO_DATA_ROOT)


def _safe_dirname(s: str) -> str:
    """Replace path separators and reserved chars for a single dir name."""
    s = (s or "").strip()
    for c in ("/", "\\", ":", "*", "?", '"', "<", ">", "|"):
        s = s.replace(c, "_")
    return s or "unnamed"


def _parse_project_name(project_name: str) -> Tuple[str, str]:
    """
    Parse project_name into (client_type, project_name).
    Supports: "d3_game" -> (d3_game, default); "d3_game/my_proj" -> (d3_game, my_proj).
    """
    raw = (project_name or "").replace("\\", "/").strip("/")
    parts = [p for p in raw.split("/") if p]
    if len(parts) >= 2:
        return _safe_dirname(parts[0]), _safe_dirname(parts[1])
    if len(parts) == 1:
        return _safe_dirname(parts[0]), "default"
    return "default", "default"


def get_yolo_data_root() -> str:
    """Return absolute YOLO_DATA_ROOT (for path parsing)."""
    return _get_root()


def parse_project_path_to_client_project(project_path: str) -> Tuple[str, str]:
    """
    If project_path is under YOLO_DATA_ROOT with form .../client_type/project_name,
    return (client_type, project_name). Otherwise return ("", "").
    """
    if not project_path or not project_path.strip():
        return "", ""
    root = _get_root()
    path_n = os.path.normpath(os.path.abspath(project_path.strip().rstrip(os.sep)))
    root_n = os.path.normpath(root)
    if not path_n.startswith(root_n):
        return "", ""
    rel = path_n[len(root_n) :].lstrip(os.sep)
    parts = [p for p in rel.split(os.sep) if p]
    if len(parts) >= 2:
        return parts[0], parts[1]
    if len(parts) == 1:
        return parts[0], "default"
    return "", ""


def get_yolo_project_path(client_type: str, project_name: str) -> str:
    """Return project path: {YOLO_DATA_ROOT}/{client_type}/{project_name}/."""
    if not client_type or not project_name:
        return ""
    root = _get_root()
    return os.path.join(root, _safe_dirname(client_type), _safe_dirname(project_name))


def get_yolo_segment_path(client_type: str, project_name: str, segment_id: str) -> str:
    """Return segment path: {YOLO_DATA_ROOT}/{client_type}/{project_name}/{segment_id}/."""
    proj = get_yolo_project_path(client_type, project_name)
    if not proj or not segment_id:
        return ""
    return os.path.join(proj, _safe_dirname(segment_id))


def get_yolo_data_dir(project_name: str, segment_id: str) -> str:
    """
    Return segment path (backward compatible).
    project_name can be:
      - "client_type" -> path = root/client_type/default/segment_id
      - "client_type/project_name" -> path = root/client_type/project_name/segment_id
    """
    if not project_name or not segment_id:
        return ""
    client_type, pname = _parse_project_name(project_name)
    return get_yolo_segment_path(client_type, pname, segment_id)


def get_yolo_data_dir_3(client_type: str, project_name: str, segment_id: str) -> str:
    """Explicit 3-arg API: segment path = root/client_type/project_name/segment_id."""
    return get_yolo_segment_path(client_type, project_name, segment_id)


def get_yolo_images_dir(project_name: str, segment_id: str) -> str:
    """Path to images subdir: {segment_dir}/images/ (backward compat: project_name as above)."""
    base = get_yolo_data_dir(project_name, segment_id)
    return os.path.join(base, IMAGES_SUBDIR) if base else ""


def get_yolo_labels_dir(project_name: str, segment_id: str) -> str:
    """Path to labels subdir: {segment_dir}/labels/ (backward compat)."""
    base = get_yolo_data_dir(project_name, segment_id)
    return os.path.join(base, LABELS_SUBDIR) if base else ""


def get_yolo_record_dir(client_type: str, project_name: str, segment_id: str) -> str:
    """Path to record subdir: {segment_dir}/record/ (raw recording output)."""
    base = get_yolo_segment_path(client_type, project_name, segment_id)
    return os.path.join(base, RECORD_SUBDIR) if base else ""


def get_yolo_frames_dir(client_type: str, project_name: str, segment_id: str) -> str:
    """Path to frames subdir: {segment_dir}/frames/ (exported frames for labeling)."""
    base = get_yolo_segment_path(client_type, project_name, segment_id)
    return os.path.join(base, FRAMES_SUBDIR) if base else ""


def write_data_yaml(
    segment_dir: str,
    classes: List[str],
    train_subdir: str = IMAGES_SUBDIR,
    val_subdir: Optional[str] = None,
) -> str:
    """
    Write data.yaml into segment_dir (Ultralytics dataset config).
    path = segment_dir; train/val = subdirs relative to path; names = {0: class0, 1: class1, ...}.
    If val_subdir is None, val is set to train_subdir (same split). Returns path to data.yaml.
    """
    return ultralytics_comm.write_data_yaml(
        segment_dir, classes, train_subdir=train_subdir, val_subdir=val_subdir
    )


def ensure_yolo_segment_dirs(project_name: str, segment_id: str) -> str:
    """
    Create {segment_dir}/images and {segment_dir}/labels; return segment dir path.
    project_name: "client_type" or "client_type/project_name".
    """
    base = get_yolo_data_dir(project_name, segment_id)
    if not base:
        return ""
    os.makedirs(os.path.join(base, IMAGES_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(base, LABELS_SUBDIR), exist_ok=True)
    return base


def ensure_yolo_segment_dirs_3(client_type: str, project_name: str, segment_id: str) -> str:
    """Create segment dir and images/labels; return segment path. Optionally create record/ and frames/."""
    base = get_yolo_segment_path(client_type, project_name, segment_id)
    if not base:
        return ""
    os.makedirs(base, exist_ok=True)
    os.makedirs(os.path.join(base, RECORD_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(base, FRAMES_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(base, IMAGES_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(base, LABELS_SUBDIR), exist_ok=True)
    return base


# ---------- _generated / _datasets / _models / _sources ----------

def get_yolo_generated_root() -> str:
    """Return {YOLO_DATA_ROOT}/_generated/."""
    return os.path.join(_get_root(), GENERATED_DIR_NAME)


def get_yolo_generated_dataset_path(client_type: str, dataset_folder_name: str) -> str:
    """Return path for a generated dataset, e.g. _generated/{client_type}/yolo_dataset_YYYYMMDD_HHMMSS."""
    root = get_yolo_generated_root()
    return os.path.join(root, _safe_dirname(client_type), _safe_dirname(dataset_folder_name))


def get_yolo_datasets_root() -> str:
    """Return {YOLO_DATA_ROOT}/_datasets/."""
    return os.path.join(_get_root(), DATASETS_DIR_NAME)


def get_yolo_models_root() -> str:
    """Return {YOLO_DATA_ROOT}/_models/."""
    return os.path.join(_get_root(), MODELS_DIR_NAME)


def get_yolo_sources_root() -> str:
    """Return {YOLO_DATA_ROOT}/_sources/."""
    return os.path.join(_get_root(), SOURCES_DIR_NAME)
