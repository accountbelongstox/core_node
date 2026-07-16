# -*- coding: utf-8 -*-
"""On-disk CoreBook bundle storage (<cache>/pycore/corebooks/<source_key>/)."""

import json
import os
import shutil
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.system_paths import get_local_data_dir

_COREBOOK_SUBDIR = "corebooks"
_BUNDLE_NAME = "corebook.json"
_AUDIO_SUBDIR = "audio"


def bundle_root(source_key: str) -> str:
    """Absolute directory for one CoreBook bundle."""
    d = os.path.join(str(get_local_data_dir()), _COREBOOK_SUBDIR, source_key)
    os.makedirs(d, exist_ok=True)
    return d


def bundle_path(source_key: str) -> str:
    return os.path.join(bundle_root(source_key), _BUNDLE_NAME)


def audio_root(source_key: str) -> str:
    d = os.path.join(bundle_root(source_key), _AUDIO_SUBDIR)
    os.makedirs(d, exist_ok=True)
    return d


def list_source_keys() -> List[str]:
    """All saved CoreBook source_key folder names (newest mtime first)."""
    root = os.path.join(str(get_local_data_dir()), _COREBOOK_SUBDIR)
    if not os.path.isdir(root):
        return []
    out: List[str] = []
    for name in os.listdir(root):
        bp = os.path.join(root, name, _BUNDLE_NAME)
        if os.path.isfile(bp):
            try:
                out.append((name, os.path.getmtime(bp)))
            except OSError:
                out.append((name, 0.0))
    out.sort(key=lambda x: x[1], reverse=True)
    return [k for k, _ in out]


def load_bundle(source_key: str) -> Optional[Dict[str, Any]]:
    path = bundle_path(source_key)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def save_bundle(source_key: str, bundle: Dict[str, Any]) -> None:
    bundle["updated_at"] = time.time()
    path = bundle_path(source_key)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def delete_bundle(source_key: str) -> bool:
    root = os.path.join(str(get_local_data_dir()), _COREBOOK_SUBDIR, source_key)
    if not os.path.isdir(root):
        return False
    shutil.rmtree(root, ignore_errors=True)
    return True


def relative_audio_path(source_key: str, lang: str, grain: str, seq: int) -> str:
    """Bundle-relative audio file path (posix-style for JSON storage)."""
    return f"{_AUDIO_SUBDIR}/{lang}/{grain}_{seq}.mp3"


def absolute_audio_path(source_key: str, rel: str) -> str:
    return os.path.join(bundle_root(source_key), rel.replace("/", os.sep))
