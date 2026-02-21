# -*- coding: utf-8 -*-
"""
补丁图 (patch images): project-level, multiple sources (like segments).
Default class = filename (stem); UI can edit class and merge. No annotation; used for generation only.
Stored at project root; VOC Annotator (File) manages patch data uniformly.
"""

import json
import os
from typing import List, Optional, Tuple, Dict, Any

PATCH_DATA_FILENAME = "patch_data.json"
KEY_SOURCES = "sources"
KEY_BASE_DIR = "base_dir"
KEY_ITEMS = "items"
KEY_FILE = "file"
KEY_CLASS = "class"

# Legacy single-source keys
KEY_BASE_DIR_LEGACY = "base_dir"
KEY_ITEMS_LEGACY = "items"
EXTERNAL_DATA_FILENAME = "external_data.json"

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp")


def _project_patch_data_path(config_path: Optional[str]) -> Optional[str]:
    """Path to patch_data.json in project dir. Project-level, shared by all segments."""
    if not config_path or not config_path.strip():
        return None
    base = os.path.dirname(os.path.abspath(config_path))
    if not base:
        base = "."
    return os.path.join(base, PATCH_DATA_FILENAME)


def load_patch_sources(config_path: Optional[str]) -> List[Dict[str, Any]]:
    """
    Load patch sources. Each source = {base_dir: str, items: [{file, class}, ...]}.
    base_dir empty means file is absolute path. Returns [] if no file or invalid.
    """
    path = _project_patch_data_path(config_path)
    if path and os.path.isfile(path):
        return _read_sources(path)
    legacy_path = None
    if config_path:
        base = os.path.dirname(os.path.abspath(config_path))
        legacy_path = os.path.join(base, EXTERNAL_DATA_FILENAME) if base else None
    if legacy_path and os.path.isfile(legacy_path):
        base_dir, items = _read_legacy_file(legacy_path)
        sources = [{KEY_BASE_DIR: base_dir or "", KEY_ITEMS: [{KEY_FILE: f, KEY_CLASS: c} for f, c in items]}] if items else []
        if path and sources:
            save_patch_sources(config_path, sources)
        return sources
    return []


def _read_sources(path: str) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    if KEY_SOURCES in data and isinstance(data[KEY_SOURCES], list):
        out = []
        for s in data[KEY_SOURCES]:
            if isinstance(s, dict) and KEY_ITEMS in s:
                base = s.get(KEY_BASE_DIR) or ""
                items = []
                for it in s.get(KEY_ITEMS) or []:
                    if isinstance(it, dict) and it.get(KEY_FILE) is not None and it.get(KEY_CLASS) is not None:
                        items.append({KEY_FILE: str(it[KEY_FILE]), KEY_CLASS: str(it[KEY_CLASS])})
                out.append({KEY_BASE_DIR: base, KEY_ITEMS: items})
        return out
    # Legacy single base_dir + items
    base = data.get(KEY_BASE_DIR_LEGACY) or ""
    items_raw = data.get(KEY_ITEMS_LEGACY) or []
    items = []
    for it in items_raw:
        if isinstance(it, dict) and it.get(KEY_FILE) and it.get(KEY_CLASS) is not None:
            items.append({KEY_FILE: str(it[KEY_FILE]), KEY_CLASS: str(it[KEY_CLASS])})
    if items or base:
        return [{KEY_BASE_DIR: base, KEY_ITEMS: items}]
    return []


def _read_legacy_file(path: str) -> Tuple[str, List[Tuple[str, str]]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        base = data.get(KEY_BASE_DIR) or ""
        items = []
        for it in data.get(KEY_ITEMS) or []:
            if isinstance(it, dict) and it.get(KEY_FILE) and it.get(KEY_CLASS) is not None:
                items.append((str(it[KEY_FILE]), str(it[KEY_CLASS])))
        return base, items
    except (OSError, json.JSONDecodeError):
        return "", []


def save_patch_sources(config_path: Optional[str], sources: List[Dict[str, Any]]) -> bool:
    """Save sources to project patch_data.json."""
    path = _project_patch_data_path(config_path)
    if not path:
        return False
    data = {KEY_SOURCES: sources}
    try:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return True
    except OSError:
        return False


def get_patch_items_flat(config_path: Optional[str]) -> List[Tuple[str, str]]:
    """
    Return flat list of (absolute_path, class_name) for all sources.
    Used by generation and by UI that shows a single list.
    """
    sources = load_patch_sources(config_path)
    out = []
    for s in sources:
        base = (s.get(KEY_BASE_DIR) or "").strip()
        for it in s.get(KEY_ITEMS) or []:
            f = it.get(KEY_FILE) or ""
            c = it.get(KEY_CLASS)
            if c is None:
                continue
            path = os.path.normpath(os.path.join(base, f)) if base else os.path.normpath(f)
            out.append((path, str(c)))
    return out


def add_patch_source(config_path: Optional[str], base_dir: str, items: List[Tuple[str, str]]) -> bool:
    """Append a new source. items = [(filename_or_path, class_name), ...]. Returns True on success."""
    sources = load_patch_sources(config_path)
    normalized = []
    for f, c in items:
        normalized.append({KEY_FILE: f, KEY_CLASS: c})
    sources.append({KEY_BASE_DIR: base_dir or "", KEY_ITEMS: normalized})
    return save_patch_sources(config_path, sources)


def load_patch_dir(directory: str) -> List[Tuple[str, str]]:
    """Scan directory for images; return list of (filename, class_name) with class_name = stem."""
    if not directory or not os.path.isdir(directory):
        return []
    out = []
    for f in sorted(os.listdir(directory)):
        if f.lower().endswith(IMAGE_EXTS):
            stem = os.path.splitext(f)[0].strip()
            class_name = stem if stem else f
            out.append((f, class_name))
    return out


# ---- Backward compatibility: single (base_dir, items) API ----

def load_patch_data(config_path: Optional[str]) -> Tuple[str, List[Tuple[str, str]]]:
    """
    Load patch data as flat (base_dir, items). For backward compat.
    If multiple sources: base_dir="" and items use absolute paths.
    Prefer load_patch_sources() and get_patch_items_flat() for new code.
    """
    flat = get_patch_items_flat(config_path)
    if not flat:
        return "", []
    sources = load_patch_sources(config_path)
    if len(sources) == 1 and sources[0].get(KEY_BASE_DIR):
        base = sources[0][KEY_BASE_DIR]
        rel_items = [(it[KEY_FILE], it[KEY_CLASS]) for it in sources[0].get(KEY_ITEMS) or []]
        return base, rel_items
    return "", flat


def save_patch_data(config_path: Optional[str], base_dir: str, items: List[Tuple[str, str]]) -> bool:
    """
    Save as single source. Overwrites existing sources with one source (base_dir, items).
    For backward compat. Prefer save_patch_sources() for multi-source.
    """
    src = {KEY_BASE_DIR: base_dir or "", KEY_ITEMS: [{KEY_FILE: f, KEY_CLASS: c} for f, c in items]}
    return save_patch_sources(config_path, [src])
