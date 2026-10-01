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

This module is imported by pygvar, so it imports only the stdlib-only
foundations (service_contract, desktop_session, data_owner) to avoid import cycles.
Path names come from config/service_contract.json#paths.
"""

import os
import sys
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.data_owner import ensure_owned_dir, mount_source
from pycore.pyfoundations.desktop_session import LINUX_DISTRO, LinuxDistro
from pycore.pyfoundations.service_contract import path_value as _contract_path
from pycore.pyfoundations.service_contract import path_values as _contract_paths
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

CORE_NODE_DATA_DIR_NAME = _contract_path('core_node_data_dir_name')
GLOBAL_VAR_DIR_NAME = _contract_path('global_var_dir_name')
WINDOWS_DATA_DRIVE_ROOT = _contract_path('windows_data_drive_root')
WINDOWS_WWW_DIR_NAME = _contract_path('www_dir_name')
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
LEGACY_LINUX_DATA_DIR = _contract_path('legacy_linux_data_dir')
LINUX_WWW_ROOT = _contract_path('linux_www_root')
LINUX_NTFS_NESTED_WWW_ROOT = _contract_path('linux_ntfs_nested_www_root')
HOME_DATA_DIR_FALLBACK = _contract_path('home_data_dir_fallback')
LEGACY_LINUX_USERS_DIR = LEGACY_LINUX_DATA_DIR + '/' + LEGACY_WINDOWS_USERS_DIR_NAME
UNIFIED_MANAGER_DIR_NAME = 'unified_manager'
UNIFIED_MANAGER_LAUNCHER_DIR_NAME = 'temp_scripts'
LEGACY_LINUX_GLOBAL_VAR_DIR = LEGACY_LINUX_DATA_DIR + '/' + GLOBAL_VAR_DIR_NAME
OS_VAR_TAG_UNKNOWN = 'UNKNOWN'


# fstype values an NTFS volume reports under /proc/mounts: the ntfs3 kernel
# driver, the legacy ntfs driver, and ntfs-3g (FUSE, which reports fuseblk).
# Bind-mounts of an NTFS root (e.g. 3_setting_base.sh binding the Windows D:\
# root at /www) report the SOURCE filesystem type, so they are covered too.
NTFS_FSTYPES = frozenset(_contract_paths('ntfs_fs_types'))


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
    if sys.platform == 'win32' or not os.path.isdir(LINUX_NTFS_NESTED_WWW_ROOT):
        return False
    www = mount_source(LINUX_WWW_ROOT)
    root = mount_source('/')
    return bool(
        www and root
        and www[1] != root[1]
        and www[2] in NTFS_FSTYPES
    )


def get_linux_www_base() -> str:
    """Linux WWW base honoring the dual-boot extra level (/www/www vs /www)."""
    return LINUX_NTFS_NESTED_WWW_ROOT if www_data_root_mounted() else LINUX_WWW_ROOT


def get_www_base() -> str:
    """This host's WWW base: Windows D:\\www, Linux /www/www (NTFS dual-boot)
    or /www (native)."""
    return WINDOWS_WWW_BASE if sys.platform == 'win32' else get_linux_www_base()


def resolve_portable_path(path: str) -> str:
    r"""Map a stored absolute path from ANY host layout onto this host.

    The runtime data root is one NTFS tree shared by both OSes of a dual-boot
    machine (Windows D:\www == Linux /www/www; native Linux keeps /www), so a
    path persisted by one OS (an outbox row, a ledger entry) must still open on
    the other. A path that exists as written is returned untouched; a path
    under a known WWW base that does not exist here is re-rooted under this
    host's base. Any other path is returned as given.
    """
    raw = str(path or '')
    if not raw or os.path.exists(raw):
        return raw
    normalized = raw.replace('\\', '/')
    lowered = normalized.lower()
    for prefix in (WINDOWS_WWW_BASE.replace('\\', '/'), LINUX_NTFS_NESTED_WWW_ROOT, LINUX_WWW_ROOT):
        base = prefix.rstrip('/').lower()
        if lowered == base or lowered.startswith(base + '/'):
            return str(Path(get_www_base()) / normalized[len(base):].lstrip('/'))
    return raw


def portable_path(path: str) -> str:
    """The host-independent form of a path under this host's WWW base: relative,
    forward slashes (``core_node/cache/word_audio/hello@kokoro.mp3``); the
    inverse of resolve_portable_path when joined with any host's base. A path
    outside the base is returned in forward-slash absolute form."""
    raw = str(path or '')
    if not raw:
        return raw
    normalized = raw.replace('\\', '/')
    base = get_www_base().replace('\\', '/').rstrip('/')
    if normalized.lower().startswith(base.lower() + '/'):
        return normalized[len(base) + 1:]
    return normalized


def _home_data_dir() -> Path:
    return Path(HOME_DATA_DIR_FALLBACK).expanduser()


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
        return ensure_owned_dir(Path(env_base))
    if sys.platform == 'win32':
        return ensure_owned_dir(Path(WINDOWS_CORE_NODE_DATA_DIR))
    for candidate in (Path(get_linux_www_base()) / CORE_NODE_DATA_DIR_NAME,
                      Path(LEGACY_LINUX_DATA_DIR)):
        try:
            ensure_owned_dir(candidate)
        except OSError as exc:
            ColorPrint.gray(f"[CoreNodeDirs] data dir candidate {candidate} unavailable: {exc}")
        if candidate.is_dir() and os.access(candidate, os.W_OK):
            return candidate
    return ensure_owned_dir(_home_data_dir())


def get_global_var_dir() -> Path:
    r"""Cross-language var center: <core_node_data_dir>/global_var.

    Falls back to the per-user ~/core_node/global_var only when the shared dir
    cannot be created or written.
    """
    base = get_core_node_data_dir()
    shared = base / GLOBAL_VAR_DIR_NAME
    try:
        ensure_owned_dir(shared)
    except OSError as exc:
        ColorPrint.gray(f"[CoreNodeDirs] shared var center {shared} unavailable: {exc}")
    else:
        if os.access(shared, os.W_OK):
            return shared
    return ensure_owned_dir(_home_data_dir() / GLOBAL_VAR_DIR_NAME)


def get_unified_manager_launcher_dir() -> Path:
    """Unified manager launcher/wrapper scripts:
    <core_node_data_dir>/unified_manager/temp_scripts."""
    return ensure_owned_dir(get_core_node_data_dir() / UNIFIED_MANAGER_DIR_NAME / UNIFIED_MANAGER_LAUNCHER_DIR_NAME)


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

def _linux_os_var_tag(distro: LinuxDistro) -> str:
    if not distro.detected:
        return OS_VAR_TAG_UNKNOWN
    return '{}_{}'.format(distro.distro_id.upper(), distro.version_major or '0')


def _os_var_tag() -> str:
    r"""OS tag for per-OS var-center keys: DEBIAN_13, UBUNTU_26, WIN10, WIN11.

    A dual-boot machine SHARES the var center between Windows and Linux; keys
    whose value differs per OS are stored as <TAG>_<KEY> so the two OSes never
    overwrite each other. Linux format mirrors dd_helper/system_functions.sh
    CURRENT_SYSTEM (ID_MAJOR); Windows derives WIN10/WIN11 from the build
    number (>= 22000 is Windows 11). SYNC: runtime_environment.sh OS_VAR_TAG /
    PathMapper.php::osVarTag / CommonFunc.ps1 Get-OsVarTag.
    """
    if sys.platform == 'win32':
        build = sys.getwindowsversion().build  # type: ignore[attr-defined]
        return 'WIN11' if build >= 22000 else 'WIN10'
    return _linux_os_var_tag(LINUX_DISTRO)


OS_VAR_TAG = _os_var_tag()


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
    return '{}_{}'.format(OS_VAR_TAG, normalized)


def global_var_read_names(key: str) -> List[str]:
    """Candidate on-disk names for reading, first match wins: the OS-tagged
    name, then the bare name (pre-tagging values and unmigrated machines)."""
    normalized = _normalize_gvar_key(key)
    if normalized in _SHARED_GVAR_KEYS:
        return [normalized]
    return ['{}_{}'.format(OS_VAR_TAG, normalized), normalized]


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
            except OSError as exc:
                ColorPrint.yellow(f"[CoreNodeDirs] read global var {candidate} failed: {exc}")
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
    'LINUX_WWW_ROOT',
    'LINUX_NTFS_NESTED_WWW_ROOT',
    'HOME_DATA_DIR_FALLBACK',
    'OS_VAR_TAG_UNKNOWN',
    'NTFS_FSTYPES',
    'www_data_root_mounted',
    'get_linux_www_base',
    'get_core_node_data_dir',
    'get_global_var_dir',
    'get_unified_manager_launcher_dir',
    'UNIFIED_MANAGER_DIR_NAME',
    'UNIFIED_MANAGER_LAUNCHER_DIR_NAME',
    'iter_global_var_dirs',
    'OS_VAR_TAG',
    'global_var_write_name',
    'global_var_read_names',
    'read_global_var',
]
