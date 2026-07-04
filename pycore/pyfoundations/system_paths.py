#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
System Paths Module

Defines system-wide cache and data directories for core_node applications.
These paths are used for storing persistent data, cache, and configuration files.

Platform-specific paths:
    Windows: C:\Users\{username}\.core_node
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
import re
import sys
import json
import time
import platform
import threading
import configparser
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pathlib import Path
from typing import Optional, Tuple, List, Any, Dict


def _is_wsl() -> bool:
    """
    Check if running in WSL (Windows Subsystem for Linux)

    Returns:
        bool: True if running in WSL
    """
    # Check for WSL-specific indicators
    if os.path.exists('/mnt/c/Windows'):
        return True

    # Check /proc/version for Microsoft/WSL
    if os.path.exists('/proc/version'):
        with open('/proc/version', 'r') as f:
            version_info = f.read().lower()
            if 'microsoft' in version_info or 'wsl' in version_info:
                return True

    return False


def _is_desktop_linux() -> bool:
    """
    Check if running on desktop Linux (has display server)

    Returns:
        bool: True if running on desktop Linux
    """
    # Check for display environment variables
    if os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'):
        return True

    # Check for desktop session
    if os.environ.get('DESKTOP_SESSION') or os.environ.get('XDG_SESSION_TYPE'):
        return True

    return False


def _get_linux_distro_info() -> Tuple[str, str]:
    """
    Get Linux distribution name and version

    Returns:
        Tuple[str, str]: (distro_name, version)
            e.g., ('ubuntu', '24.04') or ('debian', '12')
    """
    distro_name = 'linux'
    version = ''

    # Try to read /etc/os-release
    if os.path.exists('/etc/os-release'):
        with open('/etc/os-release', 'r') as f:
            content = f.read()

            # Extract ID (distro name)
            id_match = re.search(r'^ID=([^\n]+)$', content, re.MULTILINE)
            if id_match:
                distro_name = id_match.group(1).strip().strip('"').lower()

            # Extract VERSION_ID (version number)
            version_match = re.search(r'^VERSION_ID=([^\n]+)$', content, re.MULTILINE)
            if version_match:
                version = version_match.group(1).strip().strip('"')

    # Remove decimal points for version (24.04 -> 24)
    if version and '.' in version:
        version = version.split('.')[0]

    return distro_name, version


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


def _get_mounted_drives() -> List[Path]:
    """
    Get list of mounted drives in /mnt/ sorted by size (largest first)

    Returns:
        List[Path]: List of mounted drives sorted by available space
    """
    mounted_drives = []
    mnt_path = Path('/mnt')

    if not mnt_path.exists():
        return mounted_drives

    # Get all directories in /mnt/
    for item in mnt_path.iterdir():
        if item.is_dir() and item.name not in ['.', '..']:
            # Check if it's actually mounted and accessible
            try:
                # Try to access the directory
                if os.access(str(item), os.R_OK):
                    # Get disk usage
                    stat = os.statvfs(str(item))
                    available_space = stat.f_bavail * stat.f_frsize
                    mounted_drives.append((item, available_space))
            except (OSError, PermissionError):
                # Skip inaccessible mounts
                pass

    # Sort by available space (largest first)
    mounted_drives.sort(key=lambda x: x[1], reverse=True)

    # Return just the paths
    return [drive[0] for drive in mounted_drives]


def _get_largest_mounted_drive() -> Optional[Path]:
    """
    Get the largest mounted drive in /mnt/

    Returns:
        Optional[Path]: Largest mounted drive or None if no drives found
    """
    mounted_drives = _get_mounted_drives()
    return mounted_drives[0] if mounted_drives else None


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


def _get_actual_user() -> str:
    """
    Get actual logged-in user (for Linux desktop/WSL when running as root)

    This function is useful when running as root to find the actual user.
    It searches /home/ directory for user directories.

    Returns:
        str: Actual user name, or current user if detection fails
    """
    # First try standard methods
    # Check SUDO_USER (when using sudo)
    sudo_user = os.environ.get('SUDO_USER')
    if sudo_user and sudo_user != 'root':
        return sudo_user

    # Check LOGNAME
    logname = os.environ.get('LOGNAME')
    if logname and logname != 'root':
        return logname

    # Check USER
    user = os.environ.get('USER')
    if user and user != 'root':
        return user

    # If running as root, search /home/ for actual user
    home_path = Path('/home')
    if home_path.exists():
        # Get all user directories in /home/
        user_dirs = []
        for item in home_path.iterdir():
            if item.is_dir() and item.name not in ['.', '..', 'lost+found']:
                # Check if it's a valid user home directory
                # Valid home directories usually have .bashrc or .profile
                if (item / '.bashrc').exists() or (item / '.profile').exists() or (item / '.bash_profile').exists():
                    # Get last modified time to find most recently used
                    try:
                        mtime = item.stat().st_mtime
                        user_dirs.append((item.name, mtime))
                    except (OSError, PermissionError):
                        pass

        if user_dirs:
            # Sort by modification time (most recent first)
            user_dirs.sort(key=lambda x: x[1], reverse=True)
            return user_dirs[0][0]

    # Fallback to current user from pwd module
    import pwd
    try:
        return pwd.getpwuid(os.getuid()).pw_name
    except:
        # Final fallback
        return os.environ.get('USER', 'user')


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
            - Windows: C:\Users\{username}\.core_node  (per-user)
            - Linux:   /var/_core_node                 (ONE shared, all-users-writable)

    On Linux this is a SINGLE shared directory so every user (and the service,
    whoever runs it) reads/writes the SAME runtime state. It is created 1777
    (sticky + world-writable) so any user can use it; only when it cannot be
    created AND is not writable do we fall back to the per-user ``~/.core_node``.
    """
    if sys.platform == 'win32':
        # Windows: per-user home directory.
        return _ensure_dir(Path.home() / '.core_node')

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
    return _ensure_dir(get_system_cache_dir() / 'config')


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


def get_local_data_dir() -> Path:
    r"""
    Get the repo-local data directory

    A single, git-ignored ``.data/`` folder at the core_node repo root that
    collects all transient/runtime artifacts that would otherwise scatter into
    the project tree (scratch temp, captured gifs, runtime logs, etc.). Distinct
    from :func:`get_app_data_dir` (the per-user ``~/.core_node/data``); this one
    is intentionally inside the repo and ignored by git.

    Returns:
        Path: Repo-local data directory (<repo>/.data/)
    """
    return _ensure_dir(get_core_node_root() / '.data')


def get_app_temp_dir() -> Path:
    r"""
    Get application temporary data directory

    Canonical scratch space for transient processor output (extracted audio,
    rendered video, captured screenshots, parsed files, etc.). Lives under the
    repo-local, git-ignored ``.data/`` dir so it is never created loosely in the
    (CWD-relative) project tree.

    Returns:
        Path: Application temp directory (<repo>/.data/temp/)
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


# Constants - Auto-initialized paths
SYSTEM_CACHE_DIR = get_system_cache_dir()
UI_STATE_CACHE_DIR = get_ui_state_cache_dir()
APP_CACHE_DIR = get_app_cache_dir()
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()
CORE_NODE_ROOT = get_core_node_root()
LOCAL_DATA_DIR = get_local_data_dir()
APP_TEMP_DIR = get_app_temp_dir()


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
        import subprocess
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


# ===========================================================================
# User Data Store (merged from the former user_data_store module).
# Single canonical place for pycore user data: one JSON file under
# get_app_config_dir() (defined above in this same module), organized into
# named sections, with optional per-feature <name>.json / <name>.ini overrides.
# ===========================================================================
# Canonical store file name inside the config directory.
STORE_FILE_NAME = "user_data.json"


class UserDataStore:
    r"""
    Thread-safe, file-backed user data store.

    Sections are top-level keys of the JSON document, each holding a dict. Use
    :meth:`get` / :meth:`set` for single values and :meth:`get_section` /
    :meth:`update_section` for whole sections.
    """

    def __init__(self, base_dir: Optional[Path] = None, file_name: str = STORE_FILE_NAME):
        self._base_dir = Path(base_dir) if base_dir else get_app_config_dir()
        self._path = self._base_dir / file_name
        self._lock = threading.RLock()
        self._data: Optional[Dict[str, Any]] = None  # loaded lazily

    # --- paths ------------------------------------------------------------- #
    @property
    def path(self) -> Path:
        """Absolute path of the canonical store file."""
        return self._path

    @property
    def base_dir(self) -> Path:
        """Directory that holds the store and any per-feature config files."""
        return self._base_dir

    # --- low-level load / save -------------------------------------------- #
    def _ensure_loaded(self) -> Dict[str, Any]:
        """Load the store from disk once; return the in-memory document."""
        if self._data is not None:
            return self._data
        with self._lock:
            if self._data is not None:
                return self._data
            data: Dict[str, Any] = {}
            try:
                if self._path.exists():
                    with self._path.open("r", encoding="utf-8") as fh:
                        loaded = json.load(fh)
                    if isinstance(loaded, dict):
                        data = loaded
                    else:
                        ColorPrint.yellow(
                            f"[UserDataStore] {self._path} is not an object; ignoring."
                        )
            except Exception as exc:  # corrupt file: keep a backup, start fresh
                ColorPrint.yellow(f"[UserDataStore] Failed to read {self._path}: {exc}")
                self._backup_corrupt_file()
                data = {}
            self._data = data
            return self._data

    def _backup_corrupt_file(self) -> None:
        """Rename an unreadable store file aside so the user can inspect it."""
        try:
            if self._path.exists():
                bad = self._path.with_suffix(self._path.suffix + ".corrupt")
                os.replace(str(self._path), str(bad))
                ColorPrint.yellow(f"[UserDataStore] Backed up corrupt store to {bad}")
        except Exception:
            pass

    def save(self) -> None:
        """Atomically persist the in-memory document to disk."""
        with self._lock:
            data = self._data if self._data is not None else {}
            try:
                self._base_dir.mkdir(parents=True, exist_ok=True)
                tmp = self._path.with_suffix(self._path.suffix + ".tmp")
                with tmp.open("w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=True)
                    fh.flush()
                    os.fsync(fh.fileno())
                os.replace(str(tmp), str(self._path))
                # World-writable on Linux so ANY user can overwrite this shared
                # state file (the dir is 1777, but a 0644 file written by another
                # user would otherwise block updates).
                if sys.platform != 'win32':
                    try:
                        os.chmod(str(self._path), 0o666)
                    except OSError:
                        pass
            except Exception as exc:
                ColorPrint.red(f"[UserDataStore] Failed to save {self._path}: {exc}")

    def reload(self) -> None:
        """Drop the in-memory cache so the next access re-reads from disk."""
        with self._lock:
            self._data = None

    # --- section / value access ------------------------------------------- #
    def get_section(self, namespace: str) -> Dict[str, Any]:
        """Return a *copy* of a section dict (empty dict if absent)."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            return dict(section) if isinstance(section, dict) else {}

    def set_section(self, namespace: str, value: Dict[str, Any]) -> None:
        """Replace a whole section and persist."""
        with self._lock:
            data = self._ensure_loaded()
            data[namespace] = dict(value or {})
            self.save()

    def update_section(self, namespace: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Shallow-merge ``patch`` into a section and persist; return the section."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if not isinstance(section, dict):
                section = {}
            section.update(patch or {})
            data[namespace] = section
            self.save()
            return dict(section)

    def get(self, namespace: str, key: Optional[str] = None, default: Any = None) -> Any:
        """
        Read a value. With ``key`` omitted, returns a copy of the whole section
        (or ``default`` if the section is absent).
        """
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if key is None:
                if isinstance(section, dict):
                    return dict(section)
                return default
            if isinstance(section, dict) and key in section:
                return section[key]
            return default

    def set(self, namespace: str, key: str, value: Any) -> None:
        """Set a single value inside a section and persist."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if not isinstance(section, dict):
                section = {}
            section[key] = value
            data[namespace] = section
            self.save()

    def delete(self, namespace: str, key: Optional[str] = None) -> None:
        """Remove a key (or an entire section when ``key`` is omitted)."""
        with self._lock:
            data = self._ensure_loaded()
            if key is None:
                data.pop(namespace, None)
            else:
                section = data.get(namespace)
                if isinstance(section, dict):
                    section.pop(key, None)
            self.save()

    def as_dict(self) -> Dict[str, Any]:
        """Return a shallow copy of the whole document."""
        with self._lock:
            return dict(self._ensure_loaded())

    # --- content-ingest history (capped ring) ----------------------------- #
    def record_content_history(self, entry: Dict[str, Any], cap: int = 200) -> None:
        """Append ONE content-ingest history entry to the capped ring and persist.

        Cross-feature history of book / subtitle / document ingests, stored under
        the ``content_history`` section as ``{"entries": [...]}`` (newest LAST).
        Each entry is expected to carry ``{type, source_key, path, title,
        languages, counts, status, ts}`` but is stored as-given (a missing ``ts``
        is stamped with the current time). The ring keeps only the last ``cap``
        entries; same-``source_key``+``type`` is de-duplicated (the newer record
        replaces the older) so re-syncs update in place rather than growing the
        ring. Never raises — a bad entry is ignored.
        """
        if not isinstance(entry, dict):
            return
        with self._lock:
            data = self._ensure_loaded()
            section = data.get("content_history")
            if not isinstance(section, dict):
                section = {}
            entries = section.get("entries")
            if not isinstance(entries, list):
                entries = []
            rec = dict(entry)
            if not rec.get("ts"):
                rec["ts"] = time.time()
            key = (rec.get("source_key"), rec.get("type"))
            if key != (None, None):
                entries = [e for e in entries
                           if (e.get("source_key"), e.get("type")) != key]
            entries.append(rec)
            if cap and len(entries) > cap:
                entries = entries[-cap:]
            section["entries"] = entries
            data["content_history"] = section
            self.save()

    def get_content_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return content-ingest history entries (newest FIRST).

        ``limit`` caps the number returned (most-recent first). Returns [] when no
        history exists.
        """
        with self._lock:
            data = self._ensure_loaded()
            section = data.get("content_history")
            entries = section.get("entries") if isinstance(section, dict) else None
            if not isinstance(entries, list):
                return []
            ordered = list(reversed(entries))
            if limit and limit > 0:
                return ordered[:limit]
            return ordered

    # --- per-feature differentiated config (json / ini) ------------------- #
    def feature_config_path(self, name: str, ext: str = "json") -> Path:
        """Path of a sibling per-feature config file (e.g. ``video_extract.json``)."""
        return self._base_dir / f"{name}.{ext.lstrip('.')}"

    def load_feature_config(self, name: str) -> Dict[str, Any]:
        r"""
        Load a feature's effective config: the matching store section with an
        optional ``<name>.json`` or ``<name>.ini`` file merged on top.

        Precedence (low -> high): store section < ``<name>.ini`` < ``<name>.json``.
        Missing files are simply skipped, so this always returns a dict.
        """
        result = self.get_section(name)

        ini_path = self.feature_config_path(name, "ini")
        if ini_path.exists():
            try:
                parser = configparser.ConfigParser()
                parser.read(ini_path, encoding="utf-8")
                # Flatten: DEFAULT section keys at top level, others as nested dicts.
                for key, val in parser.defaults().items():
                    result[key] = val
                for sect in parser.sections():
                    result[sect] = dict(parser.items(sect))
            except Exception as exc:
                ColorPrint.yellow(f"[UserDataStore] Failed to read {ini_path}: {exc}")

        json_path = self.feature_config_path(name, "json")
        if json_path.exists():
            try:
                with json_path.open("r", encoding="utf-8") as fh:
                    loaded = json.load(fh)
                if isinstance(loaded, dict):
                    result.update(loaded)
            except Exception as exc:
                ColorPrint.yellow(f"[UserDataStore] Failed to read {json_path}: {exc}")

        return result

    def save_feature_config(self, name: str, data: Dict[str, Any]) -> None:
        """Write a feature's differentiated config to ``<name>.json`` (atomic)."""
        with self._lock:
            try:
                self._base_dir.mkdir(parents=True, exist_ok=True)
                path = self.feature_config_path(name, "json")
                tmp = path.with_suffix(path.suffix + ".tmp")
                with tmp.open("w", encoding="utf-8") as fh:
                    json.dump(dict(data or {}), fh, ensure_ascii=False, indent=2, sort_keys=True)
                    fh.flush()
                    os.fsync(fh.fileno())
                os.replace(str(tmp), str(path))
                if sys.platform != 'win32':
                    try:
                        os.chmod(str(path), 0o666)
                    except OSError:
                        pass
            except Exception as exc:
                ColorPrint.red(f"[UserDataStore] Failed to save feature config {name}: {exc}")


# --- module-level singleton ----------------------------------------------- #
_store_lock = threading.Lock()
_store_singleton: Optional[UserDataStore] = None


def get_user_data_store() -> UserDataStore:
    """Return the process-wide :class:`UserDataStore` singleton."""
    global _store_singleton
    if _store_singleton is None:
        with _store_lock:
            if _store_singleton is None:
                _store_singleton = UserDataStore()
    return _store_singleton


__all__ = [
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'get_local_data_dir',
    'get_app_temp_dir',
    'get_core_node_root',
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
    # User data store (merged from user_data_store)
    'UserDataStore',
    'get_user_data_store',
    'STORE_FILE_NAME',
]
