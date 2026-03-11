# -*- coding: utf-8 -*-
"""
Project-level annotator config: project_name, classes (item names), and class_colors.
Saved at config_path (passed by d3-check); shared across segments.
"""

import json
import os
from typing import Dict, List, Optional


CONFIG_KEY_PROJECT_NAME = "project_name"
CONFIG_KEY_CLASSES = "classes"
CONFIG_KEY_CLASS_COLORS = "class_colors"


def load_project_config(config_path: Optional[str]) -> dict:
    """Load JSON config; return dict with project_name, classes (list), class_colors (dict). Missing keys use defaults."""
    out = {CONFIG_KEY_PROJECT_NAME: "", CONFIG_KEY_CLASSES: [], CONFIG_KEY_CLASS_COLORS: {}}
    if not config_path or not os.path.isfile(config_path):
        return out
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data.get(CONFIG_KEY_PROJECT_NAME), str):
            out[CONFIG_KEY_PROJECT_NAME] = data[CONFIG_KEY_PROJECT_NAME]
        if isinstance(data.get(CONFIG_KEY_CLASSES), list):
            out[CONFIG_KEY_CLASSES] = [str(c) for c in data[CONFIG_KEY_CLASSES] if c]
        if isinstance(data.get(CONFIG_KEY_CLASS_COLORS), dict):
            out[CONFIG_KEY_CLASS_COLORS] = {str(k): list(v) for k, v in data[CONFIG_KEY_CLASS_COLORS].items() if isinstance(v, (list, tuple)) and len(v) >= 3}
    except (OSError, json.JSONDecodeError):
        pass
    return out


def save_project_config(
    config_path: Optional[str],
    project_name: str,
    classes: List[str],
    class_colors: Optional[Dict[str, List[int]]] = None,
) -> bool:
    """Write project_name, classes, and optional class_colors to config_path. Return True on success."""
    if not config_path or not config_path.strip():
        return False
    data = {CONFIG_KEY_PROJECT_NAME: project_name or "", CONFIG_KEY_CLASSES: list(classes)}
    if class_colors is not None:
        data[CONFIG_KEY_CLASS_COLORS] = {k: list(v) for k, v in class_colors.items() if isinstance(v, (list, tuple)) and len(v) >= 3}
    try:
        parent = os.path.dirname(config_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return True
    except OSError:
        return False


def get_classes_from_config(config_path: Optional[str]) -> List[str]:
    """Convenience: return classes list from config."""
    return load_project_config(config_path).get(CONFIG_KEY_CLASSES, [])
