# -*- coding: utf-8 -*-
"""Shared pycore constants, paths, and global variable storage."""

import ctypes
import json
import os
import platform
import shutil
import string
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.core_node_dirs import (
    get_core_node_data_dir,
    get_global_var_dir,
    global_var_read_names,
    global_var_write_name,
    iter_global_var_dirs,
)
from pycore.pyfoundations.machine_id import get_machine_id
from pycore.pyfoundations.network_constants import (
    HTTP_API_PREFIX,
    HTTP_BIND_HOST,
    HTTP_DEFAULT_TIMEOUT_SECONDS,
    HTTP_EVENTS_PATH,
    HTTP_INFO_PATH,
    HTTP_JSON_CONTENT_TYPE,
    HTTP_LOOPBACK_HOST,
    HTTP_PROTOCOL_VERSION,
    HTTP_ROUTES_PATH,
    HTTP_STATUS_PATH,
    PYCORE_HTTP_PORT,
    QWEN3TTS_HTTP_PORT,
    QWEN3TTS_HTTP_TIMEOUT_SECONDS,
)
from pycore.pyfoundations.system_info import (
    DISK_INFO,
    MEMORY_INFO,
    SCREEN_RESOLUTION,
    SYSTEM_SUMMARY,
)


SYSTEM_NAME = platform.system()
SYSTEM_VERSION = platform.version()
IS_WINDOWS = SYSTEM_NAME == "Windows"
IS_LINUX = SYSTEM_NAME == "Linux"
IS_MAC = SYSTEM_NAME == "Darwin"
PLATFORM_NAME = platform.platform()

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PYCORE_ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
ROOT_DIR = PYCORE_ROOT_DIR
PROJECT_ROOT = ROOT_DIR

USER_HOME_DIR = str(Path.home())
USER_PROFILE = USER_HOME_DIR

if IS_WINDOWS:
    SEVEN_ZIP_PATHS = [
        os.path.join(PYCORE_ROOT_DIR, "pycore", "base", "library", "win32", "7za.exe"),
        r"D:\applications\7-Zip\7z.exe",
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ]
    TMP_DIR = Path(r"D:\.tmp")
    APPLICATIONS_DIR = r"D:\applications"
    LANG_COMPILER_DIR = r"D:\lang_compiler"
else:
    SEVEN_ZIP_PATHS = [
        os.path.join(PYCORE_ROOT_DIR, "pycore", "base", "library", "linux", "7z"),
        "/usr/bin/7z",
        "/usr/local/bin/7z",
        "/usr/bin/7za",
        "/usr/local/bin/7za",
    ]
    TMP_DIR = Path("/var/_core_node/_tmp")
    APPLICATIONS_DIR = "/opt/applications"
    LANG_COMPILER_DIR = "/opt/lang_compiler"

TMP_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_TEMP_DIR = str(TMP_DIR)
os.environ["CORE_NODE_TMP_DIR"] = DEFAULT_TEMP_DIR
os.environ["TEMP"] = DEFAULT_TEMP_DIR
os.environ["TMP"] = DEFAULT_TEMP_DIR
os.environ["TMPDIR"] = DEFAULT_TEMP_DIR
tempfile.tempdir = DEFAULT_TEMP_DIR

BACKUP_DIR_NAME = "CoreNodeBackup"
LOCAL_CORE_NODE_DIR = str(get_core_node_data_dir())
CACHE_DIR = os.path.join(LOCAL_CORE_NODE_DIR, "cache")
INSTALLER_SCRIPTS_DIR = os.path.join(LOCAL_CORE_NODE_DIR, "installer_scripts")


def _default_global_var_dir() -> Path:
    """Canonical cross-language var center (one plain-text file per key).

    Single source of truth: pycore.pyfoundations.core_node_dirs
    (= <core_node_data_dir>/global_var), mirroring gvar_system_common.sh
    GLOBAL_VAR_DIR (= $CORE_NODE_DATA_DIR/global_var) on Linux and
    GlobalVars.ps1 $Global:GLOBAL_VAR_DIR on Windows:
        Windows: D:\\www\\core_node\\global_var
        Linux:   /www/www/core_node/global_var  (NTFS dual-boot)
                 /www/core_node/global_var      (native)
    """
    return get_global_var_dir()


GLOBAL_VAR_DIR = str(_default_global_var_dir())

CPU_COUNT = os.cpu_count() or 4
MAX_CONCURRENT_ZIP_TASKS = max(2, min(CPU_COUNT // 2, 6))
DEFAULT_ZIP_THREADS = MAX_CONCURRENT_ZIP_TASKS

MACHINE_ID = get_machine_id()
SYSTEM_SCREEN_RESOLUTION = SCREEN_RESOLUTION
SYSTEM_MEMORY_INFO = MEMORY_INFO
SYSTEM_DISK_INFO = DISK_INFO
SYSTEM_INFO_SUMMARY = SYSTEM_SUMMARY

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
WIN10_IDENTIFIER = "10.0"
WIN11_IDENTIFIER = "10.0.22000"

_SYSTEM_KEY = SYSTEM_NAME.lower()
_HOME_PATH = Path(USER_HOME_DIR)
GLOBAL_VARS_DIR = Path(GLOBAL_VAR_DIR)
PYTOOLS_TMP_DIR = TMP_DIR / "pytools"
GLOBAL_VARS_DIR.mkdir(parents=True, exist_ok=True)
PYTOOLS_TMP_DIR.mkdir(parents=True, exist_ok=True)


def get_windows_version() -> Optional[str]:
    if not IS_WINDOWS:
        return None
    version = platform.version()
    if version.startswith(WIN11_IDENTIFIER):
        return "Windows11"
    if version.startswith(WIN10_IDENTIFIER):
        return "Windows10"
    return "WindowsOther"


def get_seven_zip_executable() -> Optional[str]:
    for path in SEVEN_ZIP_PATHS:
        if os.path.exists(path):
            return path
    if IS_WINDOWS:
        return shutil.which("7z") or shutil.which("7za")
    return None


def ensure_directory(dir_path: str) -> str:
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def get_available_drives() -> list[str]:
    if not IS_WINDOWS:
        return []
    drives = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drives.append(f"{letter}:")
        bitmask >>= 1
    return drives


SEVEN_ZIP_EXECUTABLE = get_seven_zip_executable()


class GlobalVarManager:
    """Provide cross-platform access to shared global variable files."""

    def __init__(
        self,
        base_dir: Optional[Path] = None,
        namespace: Optional[str] = None,
    ) -> None:
        self._base_dir = Path(base_dir) if base_dir else self._discover_base_dir()
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._namespace = self._sanitize(namespace) if namespace else None

    def _discover_base_dir(self) -> Path:
        # The canonical var center (resolved with shared-dir fallback in
        # GLOBAL_VARS_DIR) is the single source of truth on every platform,
        # matching gvar_system_common.sh GLOBAL_VAR_DIR.
        return self._ensure_directory(GLOBAL_VARS_DIR)

    @staticmethod
    def _ensure_directory(path: Path) -> Path:
        path.mkdir(parents=True, exist_ok=True)
        return path

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
        textual = "" if value is None else str(value)
        path.write_text(textual, encoding="utf-8")
        return path

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        # Read candidates: OS-tagged name first, then the bare name
        # (pre-tagging values and unmigrated machines); the default base
        # additionally falls back to the legacy dirs (see
        # core_node_dirs.iter_global_var_dirs) so persisted secrets survive
        # both the tagging and the relocation.
        names = global_var_read_names(self._namespaced_key(key))
        for name in names:
            path = self._base_dir / name
            if path.exists():
                return path.read_text(encoding="utf-8")
        if self._base_dir == GLOBAL_VARS_DIR:
            for legacy_dir in iter_global_var_dirs()[1:]:
                for name in names:
                    legacy_path = legacy_dir / name
                    if legacy_path.exists():
                        return legacy_path.read_text(encoding="utf-8")
        return default

    def clear(self, key: str) -> None:
        namespaced = self._namespaced_key(key)
        names = {global_var_write_name(namespaced)}
        names.update(global_var_read_names(namespaced))
        for name in names:
            path = self._base_dir / name
            if path.exists():
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
    "CURRENT_DIR",
    "DEFAULT_ARCHIVE_FORMAT",
    "DEFAULT_COMPRESSION_LEVEL",
    "DEFAULT_TEMP_DIR",
    "DEFAULT_ZIP_THREADS",
    "GENERAL_SINGLETON_PORT_RANGE",
    "GENERAL_SINGLETON_PORT_START",
    "GLOBAL_VAR_DIR",
    "GLOBAL_VARS_DIR",
    "GlobalVarManager",
    "HTTP_BIND_HOST",
    "HTTP_DEFAULT_TIMEOUT_SECONDS",
    "HTTP_JSON_CONTENT_TYPE",
    "HTTP_LOOPBACK_HOST",
    "INSTALLER_SCRIPTS_DIR",
    "IS_LINUX",
    "IS_MAC",
    "IS_WINDOWS",
    "LANG_COMPILER_DIR",
    "LOCAL_CORE_NODE_DIR",
    "MACHINE_ID",
    "MAX_CONCURRENT_ZIP_TASKS",
    "MCP_BACKEND_RPC_PORT",
    "MCP_BACKEND_SINGLETON_PORT_RANGE",
    "MCP_BACKEND_SINGLETON_PORT_START",
    "MCP_PROXY_SINGLETON_PORT_RANGE",
    "MCP_PROXY_SINGLETON_PORT_START",
    "PLATFORM_NAME",
    "PROJECT_ROOT",
    "PYCORE_HTTP_PORT",
    "PYCORE_ROOT_DIR",
    "PYTOOLS_TMP_DIR",
    "QWEN3TTS_HTTP_PORT",
    "QWEN3TTS_HTTP_TIMEOUT_SECONDS",
    "ROOT_DIR",
    "HTTP_API_PREFIX",
    "HTTP_EVENTS_PATH",
    "HTTP_INFO_PATH",
    "HTTP_PROTOCOL_VERSION",
    "HTTP_ROUTES_PATH",
    "HTTP_STATUS_PATH",
    "SEVEN_ZIP_EXECUTABLE",
    "SEVEN_ZIP_PATHS",
    "SUPPORTED_ARCHIVE_FORMATS",
    "SYSTEM_DISK_INFO",
    "SYSTEM_INFO_SUMMARY",
    "SYSTEM_MEMORY_INFO",
    "SYSTEM_NAME",
    "SYSTEM_SCREEN_RESOLUTION",
    "SYSTEM_VERSION",
    "TMP_DIR",
    "USER_HOME_DIR",
    "USER_PROFILE",
    "WIN10_IDENTIFIER",
    "WIN11_IDENTIFIER",
    "ensure_directory",
    "get_available_drives",
    "get_machine_id",
    "get_seven_zip_executable",
    "get_windows_version",
]
