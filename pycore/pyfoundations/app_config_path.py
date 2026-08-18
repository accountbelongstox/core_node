#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
from pathlib import Path


def _ensure_dir(path: Path) -> Path:
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    if sys.platform != "win32":
        try:
            os.chmod(path, 0o1777)
        except OSError:
            pass
    return path


def get_system_cache_dir() -> Path:
    if sys.platform == "win32":
        username = os.environ.get("USERNAME", os.environ.get("USER", "default"))
        return _ensure_dir(Path("D:/programing/Users") / username / ".core_node")

    shared = Path("/var/_core_node")
    try:
        _ensure_dir(shared)
    except OSError:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared
    return _ensure_dir(Path.home() / ".core_node")


def get_app_config_dir() -> Path:
    return _ensure_dir(get_system_cache_dir() / "config")


__all__ = ["get_app_config_dir", "get_system_cache_dir"]
