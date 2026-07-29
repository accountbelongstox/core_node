#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
System Paths Module

Defines system-wide cache and data directories for core_node applications.
These paths are used for storing persistent data, cache, and configuration files.

Platform-specific paths:
    Windows: D:\programing\Users\{username}\.core_node
    Linux:   /var/_core_node

Directory Structure:
    .core_node/
        ├── cache/              # Application cache files
        ├── config/             # Configuration files
        ├── data/               # Persistent data
        ├── logs/               # Log files
        └── ui_state/           # UI state cache (window positions, etc.)
"""

import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple, List, Any, Dict

# Platform / disk / WSL detection helpers live in system_info now (consolidated
# from here to dedupe get_real_user / get_linux_disk_info). Imported under their
# former private names so internal call sites (_get_dev_compile_base,
# _get_base_data_directory, map_web_path) are unchanged. `_is_wsl` is also kept
# as a re-export for pg_sync_adapter's defensive
# `from pyfoundations.system_paths import _is_wsl` import.
from pycore.pyfoundations.system_info import (
    is_wsl as _is_wsl,
    get_linux_distro_info as _get_linux_distro_info,
    get_largest_mnt_drive as _get_largest_mounted_drive,
)
from pycore.pyfoundations.app_config_path import get_app_config_dir as _get_foundation_app_config_dir
from pycore.database.repositories.user_data_store import (
    UserDataStore,
    get_user_data_store,
    STORE_FILE_NAME,
)

def _get_dev_compile_base(secondary_base: 'Path', suffix: str) -> 'Path':
    """Development-tooling base directory (where <base>/_<name>_<ver> with node/py
    etc. is installed). Mirrors gvar_common.sh get_dev_compile_base() and PHP
    App\\Providers\\PathMapper::getDevCompileParts() so all three resolve identically.

    Selection (non-WSL):
      1. STICKY /opt: if /opt/_<suffix> already exists, keep using /opt regardless of
         current root free space (once /opt is chosen, never switch away).
      2. Else prefer /opt when root (/) has MORE THAN DEV_ROOT_MIN_FREE_GB free
         (default 50 GB).
      3. Else the largest secondary disk (secondary_base).
    WSL keeps its secondary-disk design.
    """
    if _is_wsl():
        return secondary_base
    if (Path('/opt') / f'_{suffix}').is_dir():
        return Path('/opt')
    try:
        min_gb = int(os.environ.get('DEV_ROOT_MIN_FREE_GB', '50'))
    except (TypeError, ValueError):
        min_gb = 50
    try:
        st = os.statvfs('/')
        if st.f_bavail * st.f_frsize > min_gb * (1024 ** 3):
            return Path('/opt')
    except OSError:
        pass
    return secondary_base


def _fs_is_posix_capable(path: Path) -> bool:
    """True when the filesystem backing *path* supports POSIX ownership/permissions,
    which the web DATA root REQUIRES: PostgreSQL needs a postgres-owned 0700 data dir
    and Laravel must chown/chmod its storage tree. NTFS/exFAT/FUSE/drvfs cannot, so
    they must never host web data -- otherwise Python diverges from gvar_common.sh
    (which forces /www) and the app reads where data was never written.

    Mirrors gvar_common.sh _fs_is_posix_capable(): walk up to the nearest existing
    ancestor, then resolve its fstype via the longest matching mountpoint in
    /proc/mounts (no third-party deps).
    """
    posix_fs = {'ext2', 'ext3', 'ext4', 'xfs', 'btrfs', 'zfs',
                'reiserfs', 'jfs', 'f2fs', 'overlay'}
    p = Path(path)
    while str(p) != p.anchor and not p.exists():
        p = p.parent
    try:
        target = os.path.realpath(str(p))
    except OSError:
        return False
    best_mp = ''
    best_fstype = ''
    try:
        with open('/proc/mounts', 'r', encoding='utf-8', errors='replace') as handle:
            for line in handle:
                parts = line.split()
                if len(parts) < 3:
                    continue
                mount_point, fstype = parts[1], parts[2]
                if (target == mount_point or target.startswith(mount_point.rstrip('/') + '/')) \
                        and len(mount_point) >= len(best_mp):
                    best_mp = mount_point
                    best_fstype = fstype
    except OSError:
        return False
    return best_fstype in posix_fs


def _ensure_dir(path: Path) -> Path:
    r"""Create ``path``; on Linux make it ALL-USERS-WRITABLE (mode 1777, sticky)
    so the shared ``/var/_core_node`` runtime tree is usable by ANY user.

    The sticky bit (like ``/tmp``) lets every user create files there while
    protecting others' files from deletion. ``chmod`` is a no-op on Windows
    (per-user ``~/.core_node``). Best-effort: a failed chmod (e.g. the dir is
    owned by another user and we're not root) is ignored — it was already
    created 1777 by whoever made it first.
    """
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    if sys.platform != 'win32':
        try:
            os.chmod(path, 0o1777)
        except OSError:
            pass
    return path


def get_system_cache_dir() -> Path:
    r"""
    Get platform-specific system cache directory

    Returns:
        Path: System cache directory path
            - Windows: D:\programing\Users\{username}\.core_node  (per-user)
            - Linux:   /var/_core_node                 (ONE shared, all-users-writable)

    On Linux this is a SINGLE shared directory so every user (and the service,
    whoever runs it) reads/writes the SAME runtime state. It is created 1777
    (sticky + world-writable) so any user can use it; only when it cannot be
    created AND is not writable do we fall back to the per-user ``~/.core_node``.
    """
    if sys.platform == 'win32':
        # Windows: D:\programing\Users\{username}\.core_node
        username = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
        cache_dir = Path('D:/programing/Users') / username / '.core_node'
        return _ensure_dir(cache_dir)

    # Linux/Unix: ONE shared, all-users-writable system dir.
    shared = Path('/var/_core_node')
    try:
        _ensure_dir(shared)
    except OSError:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared

    # Fallback: per-user home when the shared dir can't be created/written.
    return _ensure_dir(Path.home() / '.core_node')


def get_ui_state_cache_dir() -> Path:
    r"""
    Get UI state cache directory

    Used for storing window positions, sizes, and other UI state.

    Returns:
        Path: UI state cache directory (.core_node/ui_state/)
    """
    return _ensure_dir(get_system_cache_dir() / 'ui_state')


def get_app_cache_dir() -> Path:
    r"""
    Get application cache directory

    Returns:
        Path: Application cache directory (.core_node/cache/)
    """
    return _ensure_dir(get_system_cache_dir() / 'cache')


def get_app_config_dir() -> Path:
    r"""
    Get application configuration directory

    Returns:
        Path: Application config directory (.core_node/config/)
    """
    return _get_foundation_app_config_dir()


def get_app_data_dir() -> Path:
    r"""
    Get application persistent data directory

    Returns:
        Path: Application data directory (.core_node/data/)
    """
    return _ensure_dir(get_system_cache_dir() / 'data')


def get_app_logs_dir() -> Path:
    r"""
    Get application logs directory

    Returns:
        Path: Application logs directory (.core_node/logs/)
    """
    return _ensure_dir(get_system_cache_dir() / 'logs')


def get_shared_download_cache_dir() -> Path:
    r"""Shared download cache root (HF / pip / whisper / torch / TTS models).

    Windows: D:\www\cache  (replaces %USERPROFILE%\.cache)
    Linux:   /var/_core_node/cache  (CORE_NODE_CACHE_DIR)

    Respects CORE_NODE_CACHE_DIR when already exported.
    """
    env_val = os.environ.get('CORE_NODE_CACHE_DIR')
    if env_val:
        return _ensure_dir(Path(env_val))
    if sys.platform == 'win32':
        return _ensure_dir(map_web_path('cache'))
    shared = Path('/var/_core_node/cache')
    try:
        _ensure_dir(shared)
    except OSError:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared
    return _ensure_dir(Path.home() / '.core_node' / 'cache')


def get_edge_tts_voice_cache_dir(lang: str = "en") -> Path:
    r"""Edge-tts word-audio scratch/cache dir:
    ``<shared_cache>/voice_static/voice_words_static/edge-tts/<lang>``.

    Used by the word-audio edge-tts fallback + the TTS test popup so synth
    scratch files land on the shared ``D:\www\cache`` volume, NEVER the C:
    ``%TEMP%`` dir. ``lang`` is lower-cased and defaults to ``en``."""
    lang_code = (lang or "en").strip().lower() or "en"
    return _ensure_dir(
        get_shared_download_cache_dir() / 'voice_static' / 'voice_words_static' / 'edge-tts' / lang_code
    )


def get_xdg_cache_home() -> Path:
    r"""User-level XDG cache root (~/.cache on Linux, D:\www\cache on Windows).

    Subpaths are preserved when migrating from the per-user home cache, e.g.
    ``~/.cache/huggingface`` -> ``D:\www\cache\huggingface`` on Windows.
    """
    env_val = os.environ.get('XDG_CACHE_HOME')
    if env_val:
        return _ensure_dir(Path(env_val))
    if sys.platform == 'win32':
        return get_shared_download_cache_dir()
    core_cache = os.environ.get('CORE_NODE_CACHE_DIR')
    if core_cache:
        return _ensure_dir(Path(core_cache) / 'xdg')
    return _ensure_dir(Path.home() / '.cache')


def get_hf_home_dir() -> Path:
    """HuggingFace home (HF_HOME): shared cache / huggingface."""
    env_val = os.environ.get('HF_HOME')
    if env_val:
        return _ensure_dir(Path(env_val))
    return _ensure_dir(get_shared_download_cache_dir() / 'huggingface')


def get_hf_hub_cache_dir() -> Path:
    """HuggingFace Hub blob cache (HF_HUB_CACHE / HUGGINGFACE_HUB_CACHE)."""
    for key in ('HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE'):
        env_val = os.environ.get(key)
        if env_val:
            return _ensure_dir(Path(env_val))
    return _ensure_dir(get_hf_home_dir() / 'hub')


def apply_shared_cache_env() -> None:
    r"""Wire shared download-cache env vars idempotently.

    Mirrors scripts/shells/*/common/shared_cache_env.*: respects caller overrides,
    maps paths via :func:`get_shared_download_cache_dir` / :func:`get_xdg_cache_home`,
    and does NOT set deprecated ``TRANSFORMERS_CACHE``. When that legacy var duplicates
    the canonical hub path, it is removed so transformers uses ``HF_HOME`` instead.
    """
    shared = get_shared_download_cache_dir()
    hf_home = shared / 'huggingface'
    hf_hub = hf_home / 'hub'
    xdg_home = get_xdg_cache_home() if os.environ.get('XDG_CACHE_HOME') else (
        shared if sys.platform == 'win32' else shared / 'xdg'
    )

    defaults = (
        ('CORE_NODE_CACHE_DIR', str(shared)),
        ('HF_HOME', str(hf_home)),
        ('HF_HUB_CACHE', str(hf_hub)),
        ('HUGGINGFACE_HUB_CACHE', str(hf_hub)),
        ('TORCH_HOME', str(shared / 'torch')),
        ('PIP_CACHE_DIR', str(shared / 'pip')),
        ('WHISPER_CACHE_DIR', str(shared / 'whisper')),
        ('XDG_CACHE_HOME', str(xdg_home)),
    )
    for key, value in defaults:
        if not os.environ.get(key):
            os.environ[key] = value

    legacy = os.environ.get('TRANSFORMERS_CACHE')
    if legacy:
        try:
            if Path(legacy).resolve() == hf_hub.resolve():
                os.environ.pop('TRANSFORMERS_CACHE', None)
        except OSError:
            pass


def get_local_data_dir() -> Path:
    r"""
    Get the local data directory for pycore (models/staging/state).

    Lives under the shared download cache (Windows: D:\www\cache\pycore,
    Linux: /var/_core_node/cache/pycore) - NOT the repo's .data folder.
    Callers that historically appended a "pycore" segment must drop it.

    Returns:
        Path: Local data directory (<cache>/pycore/)
    """
    return _ensure_dir(get_shared_download_cache_dir() / 'pycore')


def get_app_temp_dir() -> Path:
    r"""
    Get application temporary data directory

    Canonical scratch space for transient processor output (extracted audio,
    rendered video, captured screenshots, parsed files, etc.). Lives under the
    shared cache pycore dir so it is never created loosely in the project tree.

    Returns:
        Path: Application temp directory (<cache>/pycore/temp/)
    """
    temp_dir = get_local_data_dir() / 'temp'

    if not temp_dir.exists():
        temp_dir.mkdir(parents=True, exist_ok=True)

    return temp_dir


def get_core_node_root() -> Path:
    """
    Get core_node root directory by locating from this file's position

    This file is at: pycore/pyfoundations/system_paths.py
    core_node root is 3 levels up

    Returns:
        Path: core_node root directory
    """
    return Path(__file__).resolve().parent.parent.parent


# Alias of get_core_node_root. The modularization smoke test imports
# `get_repo_root`; kept as a thin alias so the ~20 existing get_core_node_root
# callers are untouched while both names resolve to the same root.
get_repo_root = get_core_node_root


def get_lang_compiler_dir() -> Path:
    r"""Language/runtime install base (where pythonNNN, node-vX, etc. live).

    Mirrors GlobalVars.ps1 ``$Global:LANG_COMPILER_DIR = "D:\.dev_<sys>"`` (e.g.
    ``D:\.dev_win10``). Derived from the RUNNING interpreter (``sys.executable`` is
    authoritative), so it stays correct across win10/win11 and any relocation
    without hardcoding the suffix:
        ``D:\.dev_win10\python313\python.exe`` -> ``D:\.dev_win10``
    """
    return Path(sys.executable).resolve().parent.parent


# --------------------------------------------------------------------------- #
# Base-data-directory resolution, aligned with gvar_common.sh::get_base_data_directory
# and PHP PathMapper::getBaseDataDirectory. Primary source of truth: the base that
# the shell installer DETECTED and PERSISTED to /var/_core_node/global_var/BASE_DATA_DIR.
# If the shell has not provided a (valid) path, fall back to a full blkid/blockdev/
# findmnt disk detection re-implemented here so all three languages still converge.
# --------------------------------------------------------------------------- #
_BASE_DATA_DIR_FILE = '/var/_core_node/global_var/BASE_DATA_DIR'


def _run_cmd(args: List[str]) -> str:
    """Run a command; return stripped stdout, or '' on any failure (never raises)."""
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=8)
        return (res.stdout or '').strip()
    except Exception:
        return ''


def _is_real_distinct_mount(p: Path) -> bool:
    """True when p is a real mountpoint on a device different from root's device."""
    try:
        if not p.is_dir():
            return False
    except Exception:
        return False
    src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', str(p)])
    root_src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', '/'])
    return bool(src) and src != root_src


def _path_hosts_project(base: Path) -> bool:
    """True when base/programing/core_node is a real checkout (.git or package.json)."""
    proj = base / 'programing' / 'core_node'
    try:
        return proj.is_dir() and ((proj / '.git').exists() or (proj / 'package.json').is_file())
    except Exception:
        return False


def _read_persisted_base() -> Optional[Path]:
    """The base the shell installer detected + persisted (cross-language source of truth)."""
    try:
        with open(_BASE_DATA_DIR_FILE, 'r', encoding='utf-8', errors='ignore') as fh:
            val = fh.readline().strip().strip('\r\n')
    except Exception:
        return None
    if not val:
        return None
    p = Path(val)
    return p if (_is_real_distinct_mount(p) or _path_hosts_project(p)) else None


def _resolve_device_mount_path(device: str) -> str:
    """Live mount TARGET of a device; '' when not mounted or not writable (non-root)."""
    lines = _run_cmd(['findmnt', '-n', '-o', 'TARGET', '--source', device]).splitlines()
    tgt = lines[0] if lines else ''
    if tgt and (os.access(tgt, os.W_OK) or (hasattr(os, 'geteuid') and os.geteuid() == 0)):
        return tgt
    return ''


def _largest_device_of_type(want_ntfs: bool) -> Tuple[int, str]:
    """Mirror sh get_largest_{ntfs,data}_with_size: rank blkid devices by raw bytes."""
    best_size, best_dev = 0, ''
    blk = _run_cmd(['blkid'])
    if not blk:
        return best_size, best_dev
    data_types = ('ext2', 'ext3', 'ext4', 'xfs', 'btrfs')
    for line in blk.splitlines():
        dev = line.split(':', 1)[0]
        low = line.lower()
        if want_ntfs:
            if 'type="ntfs"' not in low:
                continue
        else:
            if not any(f'type="{t}"' in low for t in data_types):
                continue
            tgt = _run_cmd(['findmnt', '-n', '-o', 'TARGET', '--source', dev])
            if tgt in ('/', '/boot', '/boot/efi'):
                continue
        try:
            size_i = int(_run_cmd(['blockdev', '--getsize64', dev]) or '0')
        except Exception:
            size_i = 0
        if size_i > best_size:
            best_size, best_dev = size_i, dev
    return best_size, best_dev


def _detect_largest_disk_base() -> Optional[Path]:
    """Full blkid/blockdev/findmnt detection (used only when sh provided no base)."""
    n_size, n_dev = _largest_device_of_type(True)
    d_size, d_dev = _largest_device_of_type(False)
    if n_dev and d_dev:
        chosen = n_dev if n_size >= d_size else d_dev
    else:
        chosen = n_dev or d_dev
    if chosen:
        path = _resolve_device_mount_path(chosen)
        if path:
            return Path(path)
    return None


def _get_base_data_directory() -> Path:
    """CODE/data base, mirroring gvar_common.sh::get_base_data_directory.

    Priority: WSL -> run-anchor adopt (disk the checkout lives on) -> persisted base
    (the shell source of truth) -> full disk detection here -> largest mounted drive -> '/'.
    """
    if _is_wsl():
        return Path('/mnt/d')
    # The disk where THIS checkout physically lives wins (matches sh P1.5).
    run_base = get_core_node_root().parent.parent  # <base>/programing/core_node -> <base>
    if _path_hosts_project(run_base):
        return run_base
    persisted = _read_persisted_base()
    if persisted is not None:
        return persisted
    detected = _detect_largest_disk_base()
    if detected is not None:
        return detected
    largest = _get_largest_mounted_drive()
    if largest is not None:
        return largest
    return Path('/')


def map_web_path(path_key: str, sub_path: Optional[str] = None) -> Path:
    """
    Map web path based on environment

    SYNC WARNING: This function MUST be kept in sync with:
    - Shell version: scripts/shells/linux/common/gvar_common.sh::map_web_path()
    - PHP version: poly_apps/laravel_main/app/Providers/PathMapper.php::mapWebPath()
    - All mappings must produce identical results across Python, Shell and PHP.
    - The web DATA base is coerced to /www on a non-POSIX fs (_fs_is_posix_capable);
      the CODE base (core_node) may stay on an NTFS/large data disk.

    Windows mappings:
    - applications -> d:\\applications
    - programing -> d:\\programing
    - www -> d:\\www
    - wwwroot -> d:\\www\\wwwroot
    - pycore_db -> d:\\www\\wwwroot\\pycore_db
    - laravel_db -> d:\\www\\wwwroot\\laravel_db
    - compile_dir -> d:\\_win11 or d:\\_win10

    Linux mappings (context-aware):
    - WSL: Uses /mnt/d (or largest mounted drive)
    - Desktop: Uses largest /mnt/* drive if available, else /www
    - Server: Uses /www
    - pycore_db -> /www/wwwroot/pycore_db
    - laravel_db -> /www/wwwroot/laravel_db
    - compile_dir -> /mnt/d/_ubuntu24 (or _{distro}{version})

    Args:
        path_key: Path key (e.g., 'wwwroot', 'pycore_db', 'laravel_db')
        sub_path: Optional sub-path to append

    Returns:
        Path: Mapped path
    """
    is_windows = platform.system() == 'Windows'

    if is_windows:
        # Windows mappings
        base_d = Path('D:/')

        # Detect Windows version
        win_version = platform.release()
        if '10' in win_version:
            win_suffix = 'win10'
        elif '11' in win_version:
            win_suffix = 'win11'
        else:
            win_suffix = f'win{win_version}'

        mappings = {
            'applications': base_d / 'applications',
            'programing': base_d / 'programing',
            'core_node': get_core_node_root(),
            'www': base_d / 'www',
            'wwwroot': base_d / 'www' / 'wwwroot',
            'pycore_db': base_d / 'www' / 'wwwroot' / 'pycore_db',
            'laravel_db': base_d / 'www' / 'wwwroot' / 'laravel_db',
            # PostgreSQL data root on the shared D: data disk (native Windows PG).
            # Mirrors gvar_common.sh + PathMapper.php "postgresql".
            'postgresql': base_d / 'www' / 'wwwroot' / 'postgresql',
            'compile_dir': base_d / f'_{win_suffix}',
            # Native ext4 loop-mount target for the PostgreSQL D-drive image (a
            # WSL-only concept; kept here for parity. Not used on Windows).
            'pg_mount': Path('/var/lib/postgresql/d'),
            # Unified App Manager log namespace (a Linux-server concept; fixed
            # paths kept here for parity, mirroring gvar_common.sh).
            'app_manager_logs': Path('/opt/_core_node/logs'),
            'app_manager_logs_old': Path('/opt/core_node_unified_manager/logs'),
            # Shared download cache (HF / pip / whisper / torch). Mirrors gvar_common.sh "cache".
            'cache': base_d / 'www' / 'cache',
        }
    else:
        # Linux mappings (context-aware). The web/data base is the base the shell
        # installer detected + persisted (source of truth), else a full disk detection
        # re-implemented here. The chosen disk is honored AS-IS -- NO POSIX coercion:
        # a Windows NTFS DATA disk is shared with Windows (/mnt/<ntfs>/www == D:\\www),
        # mounted uid=/gid= so the login user owns it. PostgreSQL stays on native ext4
        # (pg_mount -> /var/lib/postgresql/d), not under www, so it is unaffected.
        base_path = _get_base_data_directory()

        # Distro suffix for the SEPARATE compile/dev base (unchanged).
        distro_name, distro_version = _get_linux_distro_info()
        distro_suffix = f'{distro_name}_{distro_version}' if distro_version else distro_name
        dev_base = _get_dev_compile_base(base_path, distro_suffix)

        # Dedup: "/" or "/www" collapse to /www; any selected disk gets "<base>/www".
        if str(base_path) in ('/', '/www'):
            www_base = Path('/www')
        else:
            www_base = base_path / 'www'

        mappings = {
            'applications': www_base / 'applications',
            'programing': www_base / 'programing',
            'core_node': get_core_node_root(),
            'www': www_base,
            'wwwroot': www_base / 'wwwroot',
            'pycore_db': www_base / 'wwwroot' / 'pycore_db',
            'laravel_db': www_base / 'wwwroot' / 'laravel_db',
            # PostgreSQL data root on the shared web/data disk (native Linux
            # server). On WSL the cluster uses the ext4 image at pg_mount instead.
            'postgresql': www_base / 'wwwroot' / 'postgresql',
            'compile_dir': dev_base / f'_{distro_suffix}',
            # Native ext4 loop-mount target for the PostgreSQL D-drive image (WSL
            # persistence). MUST stay on the native Linux fs (NOT drvfs): pg needs a
            # postgres-owned, mode-0700 data dir that drvfs cannot provide. The
            # data/image itself lives under 'laravel_db'.
            'pg_mount': Path('/var/lib/postgresql/d'),
            # Unified App Manager log namespace ROOT (scripts/app_manager/linux_sh).
            # Kept on the native Linux fs like pg_mount. Retired predecessor:
            # 'app_manager_logs_old'. MUST stay in sync with gvar_common.sh.
            'app_manager_logs': Path('/opt/_core_node/logs'),
            'app_manager_logs_old': Path('/opt/core_node_unified_manager/logs'),
            'cache': www_base / 'cache',
        }

    # Get mapped path
    mapped_path = mappings.get(path_key, Path(path_key))

    # Append sub_path if provided
    if sub_path:
        sub_path = sub_path.lstrip('/').lstrip('\\')
        mapped_path = mapped_path / sub_path

    # Create directory if it doesn't exist (only for web-related paths)
    if path_key in ['wwwroot', 'www', 'applications', 'pycore_db', 'laravel_db']:
        mapped_path.mkdir(parents=True, exist_ok=True)

    return mapped_path


# Constants - Auto-initialized paths
# NOTE: must be initialized AFTER map_web_path() is defined below -- on Windows
# get_local_data_dir() -> get_shared_download_cache_dir() -> map_web_path('cache'),
# so an earlier placement raises NameError at import time.
SYSTEM_CACHE_DIR = get_system_cache_dir()
UI_STATE_CACHE_DIR = get_ui_state_cache_dir()
APP_CACHE_DIR = get_app_cache_dir()
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()
CORE_NODE_ROOT = get_core_node_root()
LOCAL_DATA_DIR = get_local_data_dir()
APP_TEMP_DIR = get_app_temp_dir()


__all__ = [
    'get_xdg_cache_home',
    'get_shared_download_cache_dir',
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'get_local_data_dir',
    'get_app_temp_dir',
    'get_core_node_root',
    'get_repo_root',
    'get_lang_compiler_dir',
    'map_web_path',
    'SYSTEM_CACHE_DIR',
    'UI_STATE_CACHE_DIR',
    'APP_CACHE_DIR',
    'APP_CONFIG_DIR',
    'APP_DATA_DIR',
    'APP_LOGS_DIR',
    'CORE_NODE_ROOT',
    'LOCAL_DATA_DIR',
    'APP_TEMP_DIR',
    # User data store (re-exported from user_data_store)
    'UserDataStore',
    'get_user_data_store',
    'STORE_FILE_NAME',
]
