#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Core Node data-root constants (single source of truth, stdlib-only).

The per-installation runtime data root (historically ``~/.core_node`` on
Windows, ``/var/_core_node`` on Linux) is unified under the WWW base with a
NO-DOT directory name so both OSes of a dual-boot machine share one tree:

    Windows:                  D:\www\core_node
    Linux, NTFS root at /www: /www/www/core_node   (== D:\www\core_node)
    Linux, native /www:       /www/core_node

Layout below the root (no dot-prefixed names anywhere):

    core_node/
        ├── config/             # Configuration files
        ├── data/               # Persistent data
        ├── logs/               # Log files
        ├── cache/              # Application cache (NOT the model cache)
        ├── ui_state/           # UI state cache (window positions, etc.)
        └── global_var/         # Cross-language var center (one file per key)

Out of scope ON PURPOSE (pyservice stability):
  * The shared MODEL cache keeps its own roots (Windows D:\www\cache, Linux
    cross-OS /www/www/cache, Linux-native /var/_core_node/cache) -- see
    system_paths.get_shared_download_cache_dir().
  * The POSIX scratch temp stays on a native fs (Linux /var/_core_node/_tmp,
    Windows D:\.tmp) so unix sockets / flock keep working.

Mirrors: scripts/shells/linux/common/runtime_environment.sh
(CORE_NODE_DATA_DIR), scripts/shells/win/win_common/GlobalVars.ps1
($Global:USER_DIR / $Global:GLOBAL_VAR_DIR), and laravel
App\Providers\PathMapper::getCoreNodeDataDir().

This module is imported by pygvar, so it must stay stdlib-only (no pycore
imports) to avoid import cycles.
"""

import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple

CORE_NODE_DATA_DIR_NAME = 'core_node'
GLOBAL_VAR_DIR_NAME = 'global_var'
WINDOWS_DATA_DRIVE_ROOT = 'D:/'
WINDOWS_WWW_DIR_NAME = 'www'
WINDOWS_WWW_BASE = str(Path(WINDOWS_DATA_DRIVE_ROOT) / WINDOWS_WWW_DIR_NAME)
WINDOWS_CORE_NODE_DATA_DIR = str(Path(WINDOWS_WWW_BASE) / CORE_NODE_DATA_DIR_NAME)
LEGACY_WINDOWS_PROGRAMING_DIR_NAME = 'programing'
LEGACY_WINDOWS_USERS_DIR_NAME = 'Users'
LEGACY_WINDOWS_PROGRAMING_USERS_DIR = str(
    Path(WINDOWS_DATA_DRIVE_ROOT)
    / LEGACY_WINDOWS_PROGRAMING_DIR_NAME
    / LEGACY_WINDOWS_USERS_DIR_NAME
)
WINDOWS_TMP_DIR_NAME = '.tmp'
WINDOWS_TMP_USERS_DIR = str(
    Path(WINDOWS_DATA_DRIVE_ROOT)
    / WINDOWS_TMP_DIR_NAME
    / LEGACY_WINDOWS_USERS_DIR_NAME
)
LEGACY_LINUX_DATA_DIR = '/var/_core_node'
LEGACY_LINUX_USERS_DIR = LEGACY_LINUX_DATA_DIR + '/' + LEGACY_WINDOWS_USERS_DIR_NAME
UNIFIED_MANAGER_DIR_NAME = 'unified_manager'
UNIFIED_MANAGER_LAUNCHER_DIR_NAME = 'temp_scripts'
LEGACY_LINUX_GLOBAL_VAR_DIR = LEGACY_LINUX_DATA_DIR + '/' + GLOBAL_VAR_DIR_NAME


# fstype values an NTFS volume reports under /proc/mounts: the ntfs3 kernel
# driver, the legacy ntfs driver, and ntfs-3g (FUSE, which reports fuseblk).
# Bind-mounts of an NTFS root (e.g. 3_setting_base.sh binding the Windows D:\
# root at /www) report the SOURCE filesystem type, so they are covered too.
NTFS_FSTYPES = frozenset({'ntfs', 'ntfs3', 'fuseblk', 'ntfs-3g'})


def _mount_source(target: str) -> Optional[Tuple[str, str, str]]:
    """Longest-matching (mountpoint, source, fstype) for target from /proc/mounts."""
    best: Optional[Tuple[str, str, str]] = None
    try:
        with open('/proc/mounts', 'r', encoding='utf-8', errors='replace') as handle:
            for line in handle:
                parts = line.split()
                if len(parts) < 3:
                    continue
                mount_point = parts[1].replace('\\040', ' ')
                if target == mount_point or target.startswith(mount_point.rstrip('/') + '/'):
                    if best is None or len(mount_point) > len(best[0]):
                        best = (mount_point, parts[0], parts[2])
    except OSError:
        return None
    return best


def www_data_root_mounted() -> bool:
    r"""True when /www is the ROOT of a mounted NTFS data disk (the Windows D:\
    root on a dual-boot machine, bound there by 3_setting_base.sh). Then the
    SAME logical tree gains ONE EXTRA LEVEL on Linux:
        Windows D:\www  ==  Linux /www/www      (NOT /www)
    On a Linux-only machine /www is a plain native dir (same device as /) or a
    native data-disk mount (ext4/xfs/...) and there is NO extra level -- the
    extra level exists ONLY for the NTFS dual-boot sharing, so the mount's
    fstype MUST be NTFS-family (ntfs/ntfs3/fuseblk/ntfs-3g); a distinct non-NTFS
    /www device never triggers it.
    SINGLE pycore definition: system_paths.py delegates here; the shell twin
    lives ONCE in runtime_environment.sh (CORE_NODE_WWW_BASE, read by
    gvar_common.sh::www_ntfs_root_mounted); Laravel mirrors it in
    PathMapper.php::wwwNtfsRootMounted.
    """
    if sys.platform == 'win32' or not os.path.isdir('/www/www'):
        return False
    www = _mount_source('/www')
    root = _mount_source('/')
    return bool(
        www and root
        and www[1] != root[1]
        and www[2] in NTFS_FSTYPES
    )


def get_linux_www_base() -> str:
    """Linux WWW base honoring the dual-boot extra level (/www/www vs /www)."""
    return '/www/www' if www_data_root_mounted() else '/www'


def _ensure_dir(path: Path) -> Path:
    """Create path; on Linux make it all-users-writable (1777, sticky) like the
    historical shared runtime base. Best-effort: chmod failures are ignored."""
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    if sys.platform != 'win32':
        try:
            os.chmod(path, 0o1777)
        except OSError:
            pass
    return path


def get_core_node_data_dir() -> Path:
    r"""Unified runtime data root (see module docstring).

    CORE_NODE_DATA_DIR, when already exported, wins on every platform (mirrors
    the shell contract). Linux falls back to the legacy /var/_core_node and
    then to the per-user ~/core_node only when the preferred shared dir cannot
    be created or written (e.g. non-root first run before the installer
    created /www).
    """
    env_base = os.environ.get('CORE_NODE_DATA_DIR', '').strip()
    if env_base:
        return _ensure_dir(Path(env_base))
    if sys.platform == 'win32':
        return _ensure_dir(Path(WINDOWS_CORE_NODE_DATA_DIR))
    for candidate in (Path(get_linux_www_base()) / CORE_NODE_DATA_DIR_NAME,
                      Path(LEGACY_LINUX_DATA_DIR)):
        try:
            _ensure_dir(candidate)
        except OSError:
            pass
        if candidate.is_dir() and os.access(candidate, os.W_OK):
            return candidate
    return _ensure_dir(Path.home() / CORE_NODE_DATA_DIR_NAME)


def get_global_var_dir() -> Path:
    r"""Cross-language var center: <core_node_data_dir>/global_var.

    Falls back to the per-user ~/core_node/global_var only when the shared dir
    cannot be created or written.
    """
    base = get_core_node_data_dir()
    shared = base / GLOBAL_VAR_DIR_NAME
    try:
        _ensure_dir(shared)
        if os.access(shared, os.W_OK):
            return shared
    except OSError:
        pass
    return _ensure_dir(Path.home() / CORE_NODE_DATA_DIR_NAME / GLOBAL_VAR_DIR_NAME)


def get_unified_manager_launcher_dir() -> Path:
    """Unified manager launcher/wrapper scripts:
    <core_node_data_dir>/unified_manager/temp_scripts."""
    return _ensure_dir(get_core_node_data_dir() / UNIFIED_MANAGER_DIR_NAME / UNIFIED_MANAGER_LAUNCHER_DIR_NAME)


def iter_global_var_dirs() -> List[Path]:
    r"""Read-fallback chain for the var center, canonical location first.

    Pre-migration installs keep var files in the legacy locations
    (Linux /var/_core_node/global_var, Windows
    D:\programing\Users\<USER>\.core_node\.global_vars, per-user
    ~/.core_node/.global_vars); readers must still find them so persisted
    secrets (POSTGRES_PASSWORD, WWW_PATH, ...) survive the relocation.
    """
    dirs: List[Path] = [get_global_var_dir()]
    if sys.platform == 'win32':
        username = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
        dirs.append(
            Path(LEGACY_WINDOWS_PROGRAMING_USERS_DIR)
            / username
            / '.core_node'
            / '.global_vars'
        )
        dirs.append(Path.home() / '.core_node' / '.global_vars')
    else:
        dirs.append(Path(LEGACY_LINUX_GLOBAL_VAR_DIR))
        dirs.append(Path.home() / '.core_node' / 'global_var')
        dirs.append(Path.home() / '.core_node' / '.global_vars')
    out: List[Path] = []
    seen = set()
    for entry in dirs:
        key = str(entry)
        if key in seen:
            continue
        seen.add(key)
        out.append(entry)
    return out


# Keys that stay SHARED (unprefixed) across the OSes of one machine: secrets
# and cross-OS contract/selector values. SYNC: runtime_environment.sh
# CORE_NODE_SHARED_GVAR_KEYS / PathMapper.php SHARED_GVAR_KEYS /
# CommonFunc.ps1 $script:SharedGlobalVarKeys.
_SHARED_GVAR_KEYS = frozenset({
    'POSTGRES_PASSWORD',
    'MERCURE_PUBLISHER_JWT',
    'MERCURE_SUBSCRIBER_JWT',
    'DNSPOD_API_TOKEN',
    'DNSPOD_EMAIL',
    'TAILSCALE_DOMAIN_1',
    'DOMAIN_API_REGION_PREFIX',
    'DOMAIN_UI_BINDING',
    'START_WEB_SERVER',
    'WEB_SERVER_PLANE',
    'PHP_RUNTIME_PLANE',
    'SELECTED_REGION',
    'GIT_PUSH_BRANCH',
    'GIT_UPDATE_TYPE',
})

_OS_VAR_TAG: Optional[str] = None


def get_os_var_tag() -> str:
    r"""OS tag for per-OS var-center keys: DEBIAN_13, UBUNTU_26, WIN10, WIN11.

    A dual-boot machine SHARES the var center between Windows and Linux; keys
    whose value differs per OS are stored as <TAG>_<KEY> so the two OSes never
    overwrite each other. Linux format mirrors dd_helper/system_functions.sh
    CURRENT_SYSTEM (ID_MAJOR); Windows derives WIN10/WIN11 from the build
    number (>= 22000 is Windows 11). SYNC: runtime_environment.sh OS_VAR_TAG /
    PathMapper.php::osVarTag / CommonFunc.ps1 Get-OsVarTag.
    """
    global _OS_VAR_TAG
    if _OS_VAR_TAG:
        return _OS_VAR_TAG
    tag = 'UNKNOWN'
    if sys.platform == 'win32':
        try:
            build = sys.getwindowsversion().build  # type: ignore[attr-defined]
            tag = 'WIN11' if build >= 22000 else 'WIN10'
        except (AttributeError, OSError):
            tag = 'WIN10'
    else:
        try:
            os_id = ''
            version = '0'
            with open('/etc/os-release', 'r', encoding='utf-8', errors='replace') as handle:
                for line in handle:
                    if line.startswith('ID='):
                        os_id = line.split('=', 1)[1].strip().strip('"').upper()
                    elif line.startswith('VERSION_ID='):
                        version = line.split('=', 1)[1].strip().strip('"').split('.')[0]
            if os_id:
                tag = '{}_{}'.format(os_id, version or '0')
        except OSError:
            pass
    _OS_VAR_TAG = tag
    return tag


def _normalize_gvar_key(key: str) -> str:
    """Uppercase, strip anything that is not [A-Z0-9_] (mirrors the shell
    key normalization in global_var_store.sh / gvar_write_key)."""
    return ''.join(ch for ch in key.upper() if ch.isalnum() or ch == '_')


def global_var_write_name(key: str) -> str:
    """Canonical on-disk var-center file name for key: shared keys stay bare,
    every other key is namespaced per OS (<TAG>_<KEY>)."""
    normalized = _normalize_gvar_key(key)
    if normalized in _SHARED_GVAR_KEYS:
        return normalized
    return '{}_{}'.format(get_os_var_tag(), normalized)


def global_var_read_names(key: str) -> List[str]:
    """Candidate on-disk names for reading, first match wins: the OS-tagged
    name, then the bare name (pre-tagging values and unmigrated machines)."""
    normalized = _normalize_gvar_key(key)
    if normalized in _SHARED_GVAR_KEYS:
        return [normalized]
    return ['{}_{}'.format(get_os_var_tag(), normalized), normalized]


def read_global_var(key: str) -> Optional[str]:
    """First line of the var-center file for key, searching names (OS-tagged
    first, then bare) across the dir fallback chain (canonical first, then
    legacy). None when absent everywhere."""
    for directory in iter_global_var_dirs():
        for name in global_var_read_names(key):
            candidate = directory / name
            try:
                if candidate.is_file():
                    with open(candidate, 'r', encoding='utf-8', errors='ignore') as handle:
                        return handle.readline().strip().strip('\r\n')
            except OSError:
                continue
    return None


__all__ = [
    'CORE_NODE_DATA_DIR_NAME',
    'GLOBAL_VAR_DIR_NAME',
    'WINDOWS_DATA_DRIVE_ROOT',
    'WINDOWS_WWW_DIR_NAME',
    'WINDOWS_WWW_BASE',
    'WINDOWS_CORE_NODE_DATA_DIR',
    'LEGACY_WINDOWS_PROGRAMING_DIR_NAME',
    'LEGACY_WINDOWS_USERS_DIR_NAME',
    'LEGACY_WINDOWS_PROGRAMING_USERS_DIR',
    'WINDOWS_TMP_DIR_NAME',
    'WINDOWS_TMP_USERS_DIR',
    'LEGACY_LINUX_DATA_DIR',
    'LEGACY_LINUX_USERS_DIR',
    'LEGACY_LINUX_GLOBAL_VAR_DIR',
    'NTFS_FSTYPES',
    'www_data_root_mounted',
    'get_linux_www_base',
    'get_core_node_data_dir',
    'get_global_var_dir',
    'get_unified_manager_launcher_dir',
    'UNIFIED_MANAGER_DIR_NAME',
    'UNIFIED_MANAGER_LAUNCHER_DIR_NAME',
    'iter_global_var_dirs',
    'get_os_var_tag',
    'global_var_write_name',
    'global_var_read_names',
    'read_global_var',
]
