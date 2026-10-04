# -*- coding: utf-8 -*-
"""Shared pycore constants, paths, and global variable storage."""

import json
import os
import platform
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.core_node_dirs import (
    get_core_node_data_dir,
    get_global_var_dir,
    get_windows_program_dir,
    global_var_read_names,
    global_var_write_name,
    iter_global_var_dirs,
)
from pycore.pyfoundations.data_owner import adopt_path, ensure_owned_dir
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


SYSTEM_NAME = platform.system()
SYSTEM_VERSION = platform.version()
IS_WINDOWS = SYSTEM_NAME == "Windows"
IS_LINUX = SYSTEM_NAME == "Linux"
IS_MAC = SYSTEM_NAME == "Darwin"

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))

TMP_FALLBACK_DIR_NAME = "core_node_tmp"


def _usable_tmp_dir(preferred: Path) -> Path:
    """The preferred shared temp root, or a per-system fallback when it cannot
    be created (a Windows host without D:, a first non-root Linux run)."""
    try:
        preferred.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        fallback = Path(tempfile.gettempdir()) / TMP_FALLBACK_DIR_NAME
        ColorPrint.yellow(f"[pygvar] temp root {preferred} unavailable ({exc}); using {fallback}")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback
    return preferred


if IS_WINDOWS:
    APPLICATIONS_DIR = str(get_windows_program_dir('app_root'))
    SEVEN_ZIP_PATHS = [
        os.path.join(PROJECT_ROOT, "pycore", "base", "library", "win32", "7za.exe"),
        os.path.join(APPLICATIONS_DIR, "7-Zip", "7z.exe"),
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ]
    TMP_DIR = Path(r"D:\.tmp")
else:
    SEVEN_ZIP_PATHS = [
        os.path.join(PROJECT_ROOT, "pycore", "base", "library", "linux", "7z"),
        "/usr/bin/7z",
        "/usr/local/bin/7z",
        "/usr/bin/7za",
        "/usr/local/bin/7za",
    ]
    TMP_DIR = Path("/var/_core_node/_tmp")
    APPLICATIONS_DIR = "/opt/applications"

TMP_DIR = _usable_tmp_dir(TMP_DIR)
os.environ["CORE_NODE_TMP_DIR"] = str(TMP_DIR)
os.environ["TEMP"] = str(TMP_DIR)
os.environ["TMP"] = str(TMP_DIR)
os.environ["TMPDIR"] = str(TMP_DIR)
tempfile.tempdir = str(TMP_DIR)
os.environ["PYCORE_PROJECT_ROOT"] = PROJECT_ROOT

BACKUP_DIR_NAME = "CoreNodeBackup"
CACHE_DIR = ensure_owned_dir(get_core_node_data_dir() / "cache")

# Cross-language var center (one plain-text file per key); single source of
# truth is core_node_dirs (= <core_node_data_dir>/global_var), mirroring
# gvar_system_common.sh GLOBAL_VAR_DIR and GlobalVars.ps1 $Global:GLOBAL_VAR_DIR.
GLOBAL_VAR_DIR = ensure_owned_dir(get_global_var_dir())

CPU_COUNT = os.cpu_count() or 4
MAX_CONCURRENT_ZIP_TASKS = max(2, min(CPU_COUNT // 2, 6))

MCP_BACKEND_SINGLETON_PORT_START = 58000
MCP_BACKEND_SINGLETON_PORT_RANGE = 100
MCP_BACKEND_RPC_PORT = 58100
MCP_PROXY_SINGLETON_PORT_START = 58200
MCP_PROXY_SINGLETON_PORT_RANGE = 100
GENERAL_SINGLETON_PORT_START = 54000
GENERAL_SINGLETON_PORT_RANGE = 100

SUPPORTED_ARCHIVE_FORMATS = [".7z", ".zip", ".tar", ".gz", ".bz2", ".xz"]
DEFAULT_ARCHIVE_FORMAT = ".7z"
DEFAULT_COMPRESSION_LEVEL = 5
BACKUP_METADATA_FILENAME = "backup_metadata.json"
BACKUP_INDEX_FILENAME = "backup_index.json"

PYTOOLS_TMP_DIR = TMP_DIR / "pytools"
PYTOOLS_TMP_DIR.mkdir(parents=True, exist_ok=True)


def get_seven_zip_executable() -> Optional[str]:
    for path in SEVEN_ZIP_PATHS:
        if os.path.exists(path):
            return path
    if IS_WINDOWS:
        return shutil.which("7z") or shutil.which("7za")
    return None


SEVEN_ZIP_EXECUTABLE = get_seven_zip_executable()


class GlobalVarManager:
    """Provide cross-platform access to shared global variable files."""

    def __init__(
        self,
        base_dir: Optional[Path] = None,
        namespace: Optional[str] = None,
    ) -> None:
        self._base_dir = ensure_owned_dir(Path(base_dir) if base_dir else self._discover_base_dir())
        self._namespace = self._sanitize(namespace) if namespace else None

    def _discover_base_dir(self) -> Path:
        # The canonical var center (resolved with shared-dir fallback in
        # GLOBAL_VAR_DIR) is the single source of truth on every platform,
        # matching gvar_system_common.sh GLOBAL_VAR_DIR.
        return self._ensure_directory(GLOBAL_VAR_DIR)

    @staticmethod
    def _ensure_directory(path: Path) -> Path:
        return ensure_owned_dir(path)

    @staticmethod
    def _sanitize(key: Optional[str]) -> str:
        if not key:
            raise ValueError("Key must not be empty")
        sanitized = "".join(
            character
            for character in str(key).upper()
            if character.isalnum() or character == "_"
        )
        if not sanitized:
            raise ValueError("Key contains no valid characters")
        return sanitized

    def _namespaced_key(self, key: str) -> str:
        sanitized = self._sanitize(key)
        if self._namespace:
            sanitized = f"{self._namespace}_{sanitized}"
        return sanitized

    def _resolve_key(self, key: str) -> Path:
        # Canonical on-disk name (shared keys stay bare, all others get the
        # per-OS <TAG>_ prefix -- see core_node_dirs.global_var_write_name).
        return self._base_dir / global_var_write_name(self._namespaced_key(key))

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def file_path(self, key: str) -> Path:
        return self._resolve_key(key)

    def set(self, key: str, value: Any) -> Path:
        path = self._resolve_key(key)
        if path.is_dir():
            raise IsADirectoryError(path)
        textual = "" if value is None else str(value)
        path.write_text(textual, encoding="utf-8")
        return adopt_path(path)

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        # Read candidates: OS-tagged name first, then the bare name
        # (pre-tagging values and unmigrated machines); the default base
        # additionally falls back to the legacy dirs (see
        # core_node_dirs.iter_global_var_dirs) so persisted secrets survive
        # both the tagging and the relocation.
        names = global_var_read_names(self._namespaced_key(key))
        for name in names:
            path = self._base_dir / name
            if path.is_file():
                return path.read_text(encoding="utf-8")
        if self._base_dir == GLOBAL_VAR_DIR:
            for legacy_dir in iter_global_var_dirs()[1:]:
                for name in names:
                    legacy_path = legacy_dir / name
                    if legacy_path.is_file():
                        return legacy_path.read_text(encoding="utf-8")
        return default

    def clear(self, key: str) -> None:
        namespaced = self._namespaced_key(key)
        names = {global_var_write_name(namespaced)}
        names.update(global_var_read_names(namespaced))
        for name in names:
            path = self._base_dir / name
            if path.is_file():
                path.unlink()

    def set_json(self, key: str, data: Dict[str, Any]) -> Path:
        return self.set(key, json.dumps(data, ensure_ascii=False))

    def get_json(
        self,
        key: str,
        default: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        raw = self.get(key)
        if not raw:
            return default
        raw_stripped = raw.strip()
        if not raw_stripped:
            return default
        if not (raw_stripped.startswith("{") or raw_stripped.startswith("[")):
            return default
        return json.loads(raw)


__all__ = [
    "APPLICATIONS_DIR",
    "BACKUP_DIR_NAME",
    "BACKUP_INDEX_FILENAME",
    "BACKUP_METADATA_FILENAME",
    "CACHE_DIR",
    "CPU_COUNT",
    "DEFAULT_ARCHIVE_FORMAT",
    "DEFAULT_COMPRESSION_LEVEL",
    "GENERAL_SINGLETON_PORT_RANGE",
    "GENERAL_SINGLETON_PORT_START",
    "GLOBAL_VAR_DIR",
    "GlobalVarManager",
    "IS_LINUX",
    "IS_MAC",
    "IS_WINDOWS",
    "MAX_CONCURRENT_ZIP_TASKS",
    "MCP_BACKEND_RPC_PORT",
    "MCP_BACKEND_SINGLETON_PORT_RANGE",
    "MCP_BACKEND_SINGLETON_PORT_START",
    "MCP_PROXY_SINGLETON_PORT_RANGE",
    "MCP_PROXY_SINGLETON_PORT_START",
    "PROJECT_ROOT",
    "PYTOOLS_TMP_DIR",
    "SEVEN_ZIP_EXECUTABLE",
    "SUPPORTED_ARCHIVE_FORMATS",
    "SYSTEM_NAME",
    "SYSTEM_VERSION",
    "TMP_DIR",
    "get_seven_zip_executable",
]
