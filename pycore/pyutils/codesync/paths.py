# -*- coding: utf-8 -*-
"""Code Sync filesystem locations."""

from pathlib import Path

from pycore.pyfoundations.data_owner import ensure_owned_dir
from pycore.pyfoundations.system_paths import get_core_node_root, get_shared_download_cache_dir

CODESYNC_PACKAGE_DIR = Path(__file__).resolve().parent
PEERS_FILE_NAME = "code_sync_peers.json"
# Committed baseline peer list: the shipped default, read-only at runtime.
PEERS_BASELINE_FILE = CODESYNC_PACKAGE_DIR / PEERS_FILE_NAME


def codesync_cache_dir() -> Path:
    """Code Sync runtime cache, isolated from the Pycore application cache."""
    return ensure_owned_dir(get_shared_download_cache_dir() / "codesync")


def peers_override_file() -> Path:
    """Per-machine peer list (gitignored cache); the only file runtime edits write."""
    return codesync_cache_dir() / PEERS_FILE_NAME


def sync_root() -> Path:
    """Repository root that a DEV distributes and a CLIENT writes under."""
    return get_core_node_root()


__all__ = [
    "CODESYNC_PACKAGE_DIR",
    "PEERS_BASELINE_FILE",
    "PEERS_FILE_NAME",
    "codesync_cache_dir",
    "peers_override_file",
    "sync_root",
]
