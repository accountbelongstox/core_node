# -*- coding: utf-8 -*-
"""
VOC Annotator config: zoom percentage and last-used paths.
Persisted to JSON under pycore user config dir; default zoom 100%.
"""

import json
import os
from typing import Any, Dict, Optional

CONFIG_FILENAME = "voc_annotator_config.json"
DEFAULT_ZOOM_PERCENT = 100
MIN_ZOOM_PERCENT = 25
MAX_ZOOM_PERCENT = 400
ZOOM_STEP_PERCENT = 25


def _config_dir() -> str:
    d = os.environ.get("CORE_NODE_CONFIG_DIR")
    if d and os.path.isdir(d):
        return d
    home = os.path.expanduser("~")
    for name in (".core_node", ".pycore"):
        p = os.path.join(home, name)
        if os.path.isdir(p):
            return p
        try:
            os.makedirs(p, exist_ok=True)
            return p
        except OSError:
            continue
    return home


def _config_path() -> str:
    return os.path.join(_config_dir(), CONFIG_FILENAME)


def load_config() -> Dict[str, Any]:
    path = _config_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def save_config(config: Dict[str, Any]) -> None:
    path = _config_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except OSError:
        pass


def get_zoom_percent() -> int:
    cfg = load_config()
    v = cfg.get("zoom_percent", DEFAULT_ZOOM_PERCENT)
    try:
        v = int(v)
        return max(MIN_ZOOM_PERCENT, min(MAX_ZOOM_PERCENT, v))
    except (TypeError, ValueError):
        return DEFAULT_ZOOM_PERCENT


def set_zoom_percent(percent: int) -> None:
    percent = max(MIN_ZOOM_PERCENT, min(MAX_ZOOM_PERCENT, percent))
    cfg = load_config()
    cfg["zoom_percent"] = percent
    save_config(cfg)


def get_last_images_dir() -> Optional[str]:
    cfg = load_config()
    p = cfg.get("last_images_dir")
    if p and isinstance(p, str) and os.path.isdir(p):
        return p
    return None


def set_last_images_dir(path: str) -> None:
    if not path or not os.path.isdir(path):
        return
    cfg = load_config()
    cfg["last_images_dir"] = os.path.abspath(path)
    save_config(cfg)


def get_last_save_dir() -> Optional[str]:
    cfg = load_config()
    p = cfg.get("last_save_dir")
    if p and isinstance(p, str) and os.path.isdir(p):
        return p
    return None


def set_last_save_dir(path: str) -> None:
    if not path or not os.path.isdir(path):
        return
    cfg = load_config()
    cfg["last_save_dir"] = os.path.abspath(path)
    save_config(cfg)
