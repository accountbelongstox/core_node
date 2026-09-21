#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
from pathlib import Path

from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir


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
    """Unified runtime data root (see pycore.pyfoundations.core_node_dirs)."""
    return get_core_node_data_dir()


def get_app_config_dir() -> Path:
    return _ensure_dir(get_core_node_data_dir() / "config")


__all__ = ["get_app_config_dir", "get_system_cache_dir"]
