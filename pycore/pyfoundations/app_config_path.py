#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path

from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir
from pycore.pyfoundations.data_owner import ensure_owned_dir


def get_system_cache_dir() -> Path:
    """Unified runtime data root (see pycore.pyfoundations.core_node_dirs)."""
    return get_core_node_data_dir()


def get_app_config_dir() -> Path:
    return ensure_owned_dir(get_core_node_data_dir() / "config")


__all__ = ["get_app_config_dir", "get_system_cache_dir"]
