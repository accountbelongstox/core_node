# -*- coding: utf-8 -*-
"""Launcher app resolution primitives: path cache, Windows dir search, Linux candidate chain."""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.core_node_dirs import read_global_var
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_system_cache_dir, map_web_path
from pycore.pyutils.launcher.app_catalog import (
    LINUX_APP_DEFINITIONS,
    LINUX_ELEVATION_TOKENS,
    LINUX_FIXED_BIN_DIRS,
)

APP_CACHE_SUBDIR = 'launch_multiple'
APP_CACHE_FILE = 'app_cache.json'
SEARCH_MAX_DEPTH = 5
SHEBANG_PROBE_BYTES = 8192


class AppPathCache:
    """Resolved application paths persisted in app_cache.json (loaded on first use)."""

    def __init__(self):
        self._store: Optional[AtomicJsonStore] = None
        self._data: Optional[Dict[str, str]] = None

    def _entries(self) -> Dict[str, str]:
        if self._data is None:
            self._store = AtomicJsonStore(get_system_cache_dir() / APP_CACHE_SUBDIR / APP_CACHE_FILE, dict)
            try:
                self._data = self._store.read()
            except (OSError, ValueError) as exc:
                ColorPrint.yellow(f"[AppPathCache] read {self._store.path} failed: {exc}")
                self._data = {}
        return self._data

    def get(self, key: str) -> Optional[str]:
        return self._entries().get(key)

    def existing(self, key: str, require_file: bool = False) -> Optional[str]:
        """Cached path for *key* when it still exists on disk."""
        value = self.get(key)
        if not value:
            return None
        path = Path(value)
        present = path.is_file() if require_file else path.exists()
        return str(path) if present else None

    def put(self, key: str, value: str) -> bool:
        entries = self._entries()
        if entries.get(key) == value:
            return True
        entries[key] = value
        return self.save()

    def update(self, values: Dict[str, str]) -> bool:
        self._entries().update(values)
        return self.save()

    def save(self) -> bool:
        entries = self._entries()
        try:
            self._store.write(entries)
        except (OSError, TypeError) as exc:
            ColorPrint.red(f"[AppPathCache] write {self._store.path} failed: {exc}")
            return False
        return True

    def dumps(self) -> str:
        return json.dumps(self._entries(), indent=2, ensure_ascii=False)


app_path_cache = AppPathCache()


def current_username() -> str:
    return os.getenv('USERNAME') or os.getenv('USER') or ''


def expand_user_path(path: str) -> str:
    """Expand the ``{username}`` placeholder of catalog search paths."""
    return path.format(username=current_username())


def search_recursive(search_path: Path, exe_name: str, max_depth: int = SEARCH_MAX_DEPTH) -> Optional[Path]:
    """Depth-limited search for *exe_name* under *search_path*."""
    if max_depth <= 0:
        return None
    exe_path = search_path / exe_name
    if exe_path.exists():
        return exe_path
    try:
        children = [item for item in search_path.iterdir() if item.is_dir()]
    except OSError:
        return None
    for child in children:
        result = search_recursive(child, exe_name, max_depth - 1)
        if result:
            return result
    return None


def linux_binary_usable(path: Path) -> bool:
    """False for self-elevating wrapper scripts when running non-root."""
    if os.geteuid() == 0:
        return True
    try:
        with open(path, 'rb') as fh:
            head = fh.read(SHEBANG_PROBE_BYTES)
    except OSError:
        return False
    if not head.startswith(b'#!'):
        return True
    text = head.decode('utf-8', errors='ignore')
    return not any(token in text for token in LINUX_ELEVATION_TOKENS)


def linux_candidates(app_name: str) -> List[Path]:
    """Ordered candidate paths for *app_name* (central constants first)."""
    spec = LINUX_APP_DEFINITIONS.get(app_name) or {}
    binaries = spec.get('binaries', [])
    candidates = []

    for key in spec.get('gvar_keys', []):
        value = read_global_var(key)
        if value:
            candidates.append(Path(value))

    for dir_key in spec.get('gvar_dir_keys', []):
        dir_value = read_global_var(dir_key)
        if dir_value:
            for binary in binaries:
                candidates.append(Path(dir_value) / binary)

    app_subdir = spec.get('app_subdir')
    subdir_candidates = []
    if app_subdir:
        apps_dir = map_web_path('compile_dir') / 'applications' / app_subdir
        subdir_binary = spec.get('subdir_binary')
        if subdir_binary:
            subdir_candidates.append(apps_dir / subdir_binary)
        for binary in binaries:
            subdir_candidates.append(apps_dir / binary)
            subdir_candidates.append(apps_dir / 'bin' / binary)

    # binary_priority: the binaries list is a preference order (the first
    # installed editor wins wherever it lives), else directories come first.
    if spec.get('binary_priority'):
        fixed_candidates = [Path(fixed_dir) / binary
                            for binary in binaries
                            for fixed_dir in LINUX_FIXED_BIN_DIRS]
    else:
        fixed_candidates = [Path(fixed_dir) / binary
                            for fixed_dir in LINUX_FIXED_BIN_DIRS
                            for binary in binaries]

    local_bin = Path.home() / '.local' / 'bin'
    local_candidates = [local_bin / binary for binary in binaries]

    # Apps whose PATH wrapper handles root-specific concerns (Electron
    # --no-sandbox, IME env) must resolve that wrapper first when running
    # as root; the raw install-tree binary would abort as root.
    if spec.get('root_prefer_wrapper') and os.geteuid() == 0:
        candidates.extend(fixed_candidates)
        candidates.extend(local_candidates)
        candidates.extend(subdir_candidates)
    else:
        candidates.extend(subdir_candidates)
        candidates.extend(fixed_candidates)
        candidates.extend(local_candidates)

    return candidates


def _is_executable_file(path: Path) -> bool:
    try:
        return path.is_file() and os.access(path, os.X_OK)
    except OSError:
        return False


def find_linux_app(app_name: str) -> Optional[str]:
    """Resolve an app's Linux binary: central constants, fixed dirs, PATH."""
    spec = LINUX_APP_DEFINITIONS.get(app_name)
    if not spec:
        return None

    for candidate in linux_candidates(app_name):
        if _is_executable_file(candidate) and linux_binary_usable(candidate):
            return str(candidate)

    for binary in spec.get('binaries', []):
        resolved = shutil.which(binary)
        if resolved and linux_binary_usable(Path(resolved)):
            return resolved

    return None
