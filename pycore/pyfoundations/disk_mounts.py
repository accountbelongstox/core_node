#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Disk and mount probing for the web/data base and the dev-compile base.

Mirrors gvar_common.sh (get_base_data_directory / get_dev_compile_base) and
PHP PathMapper so all three languages resolve identically.
"""

import os
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import PROJECT_ROOT
from pycore.pyfoundations.system_info import (
    is_wsl,
    get_largest_mnt_drive as _get_largest_mounted_drive,
)
from pycore.pyfoundations.core_node_dirs import (
    NTFS_FSTYPES as _NTFS_FSTYPES,
    read_global_var as _read_global_var_center,
    www_data_root_mounted,
)
from pycore.pyfoundations.data_owner import ensure_owned_dir


# --------------------------------------------------------------------------- #
# Base-data-directory resolution, aligned with gvar_common.sh::get_base_data_directory
# and PHP PathMapper::getBaseDataDirectory. Primary source of truth: the base that
# the shell installer DETECTED and PERSISTED to /var/_core_node/global_var/BASE_DATA_DIR.
# If the shell has not provided a (valid) path, fall back to a full blkid/blockdev/
# findmnt disk detection re-implemented here so all three languages still converge.
# --------------------------------------------------------------------------- #
# Var-center keys persisted by 3_setting_base.sh (cross-language source of
# truth for the detected data base and the D:\www-equivalent web base). Reads
# go through core_node_dirs.read_global_var, which searches the canonical
# var center (<core_node_data_dir>/global_var) first and the legacy
# /var/_core_node/global_var second, so pre-migration installs keep working.
def get_dev_compile_base(secondary_base: 'Path', suffix: str) -> 'Path':
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
    if is_wsl():
        return secondary_base
    if (Path('/opt') / f'_{suffix}').is_dir():
        return Path('/opt')
    min_gb_text = os.environ.get('DEV_ROOT_MIN_FREE_GB', '50').strip()
    min_gb = int(min_gb_text) if min_gb_text.isdigit() else 50
    if _avail_bytes('/') > min_gb * (1024 ** 3):
        return Path('/opt')
    return secondary_base


_BASE_DATA_DIR_KEY = 'BASE_DATA_DIR'
WWW_PATH_KEY = 'WWW_PATH'


def read_persisted_var(key: str) -> str:
    """First line of a var-center key ('' when absent/unreadable)."""
    return _read_global_var_center(key) or ''


def linux_cross_os_cache_dir() -> Optional[Path]:
    r"""Cross-OS shared model cache when /www is the mounted NTFS/data disk
    root: Windows D:\www\cache == Linux /www/www/cache. Windows downloads every
    model into D:\www\cache (SharedCacheEnv.ps1), so reusing the same tree
    means each model downloads ONCE for both OSes. Model weights are
    device-agnostic -- the same tree serves GPU (CUDA) and CPU runs on
    unchanged hardware; framework wheels differ but live in venvs, never here.
    Returns None on Linux-only machines (caller uses the native cache)."""
    www_path_var = read_persisted_var(WWW_PATH_KEY)
    candidate: Optional[Path] = None
    if www_path_var and www_path_var != '/www' and Path(www_path_var).is_dir():
        candidate = Path(www_path_var) / 'cache'
    elif www_data_root_mounted():
        candidate = Path('/www/www/cache')
    if candidate is None:
        return None
    try:
        ensure_owned_dir(candidate)
    except OSError as exc:
        ColorPrint.gray(f"[DiskMounts] cross-OS cache {candidate} unavailable: {exc}")
    if candidate.is_dir() and os.access(candidate, os.W_OK):
        return candidate
    return None


def _run_cmd(args: List[str]) -> str:
    """Run a command; return stripped stdout, or '' on any failure (never raises)."""
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=8)
    except (OSError, subprocess.SubprocessError) as exc:
        ColorPrint.gray(f"[DiskMounts] command {args} failed: {exc}")
        return ''
    return (res.stdout or '').strip()


def iter_ntfs_mount_points() -> List[str]:
    """Mount points of every mounted NTFS volume (fstypes in
    core_node_dirs.NTFS_FSTYPES: ntfs3 kernel driver or ntfs-3g FUSE, which
    reports fuseblk). Bind-mounts of an NTFS root (e.g. 3_setting_base.sh
    binding the Windows D:\\ root at /www) appear here with the source
    filesystem type, so they are covered too."""
    points: List[str] = []
    try:
        with open('/proc/mounts', 'r', encoding='utf-8', errors='replace') as handle:
            for line in handle:
                parts = line.split()
                if len(parts) >= 3 and parts[2] in _NTFS_FSTYPES:
                    points.append(parts[1].replace('\\040', ' '))
    except OSError as exc:
        ColorPrint.yellow(f"[DiskMounts] read /proc/mounts failed: {exc}")
    return points


def _is_real_distinct_mount(p: Path) -> bool:
    """True when p is a real mountpoint on a device different from root's device."""
    if not p.is_dir():
        return False
    src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', str(p)])
    root_src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', '/'])
    return bool(src) and src != root_src


def _path_hosts_project(base: Path) -> bool:
    """True when base/programing/core_node is a real checkout (.git or package.json)."""
    proj = base / 'programing' / 'core_node'
    return proj.is_dir() and ((proj / '.git').exists() or (proj / 'package.json').is_file())


def _read_persisted_base() -> Optional[Path]:
    """The base the shell installer detected + persisted (cross-language source of truth)."""
    val = read_persisted_var(_BASE_DATA_DIR_KEY)
    if not val:
        return None
    p = Path(val)
    # Mirrors gvar_storage_common.sh Priority 2: re-validate the persisted base
    # against the CURRENT free-space policy on every run, so a stale cache left by
    # an older script version cannot override it. Real work (a hosted project) and
    # the sanctioned logical roots are kept; a real disk mount is kept only while
    # its free space STRICTLY beats the root filesystem, else the root fs wins.
    if _path_hosts_project(p):
        return p
    if val in ('/www', '/mnt/d'):
        return p
    if _is_real_distinct_mount(p):
        if _avail_bytes(str(p)) > _avail_bytes('/'):
            return p
        return Path('/www')
    return None


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
        size_text = _run_cmd(['blockdev', '--getsize64', dev])
        size_i = int(size_text) if size_text.isdigit() else 0
        if size_i > best_size:
            best_size, best_dev = size_i, dev
    return best_size, best_dev


def _avail_bytes(path: str) -> int:
    """Free bytes available at *path*; 0 when it cannot be measured."""
    try:
        st = os.statvfs(path)
    except OSError as exc:
        ColorPrint.gray(f"[DiskMounts] statvfs {path} failed: {exc}")
        return 0
    return st.f_bavail * st.f_frsize


def _detect_largest_disk_base() -> Optional[Path]:
    """Free-space-aware disk detection (used only when sh provided no base).

    Mirrors gvar_common.sh Priority 3: candidates are the largest NTFS and largest
    POSIX data devices, each resolved to its current mount; the root filesystem
    wins (as /www) when '/' has at least as much AVAILABLE space as the best
    candidate -- ties included. Only a disk with strictly more free space is used.
    Unmeasurable paths count as 0.
    """
    _n_size, n_dev = _largest_device_of_type(True)
    _d_size, d_dev = _largest_device_of_type(False)
    best_path = ''
    best_free = 0
    for dev in (n_dev, d_dev):
        if not dev:
            continue
        path = _resolve_device_mount_path(dev)
        if not path:
            continue
        free = _avail_bytes(path)
        if free > best_free:
            best_free, best_path = free, path
    if not best_path:
        return None
    if _avail_bytes('/') >= best_free:
        return Path('/www')
    return Path(best_path)


def get_base_data_directory() -> Path:
    """CODE/data base, mirroring gvar_common.sh::get_base_data_directory.

    Priority: WSL -> run-anchor adopt (disk the checkout lives on) -> persisted base
    (the shell source of truth) -> full disk detection here -> largest mounted drive -> '/'.
    """
    if is_wsl():
        return Path('/mnt/d')
    # The disk where THIS checkout physically lives wins (matches sh P1.5).
    run_base = Path(PROJECT_ROOT).resolve().parent.parent  # <base>/programing/core_node -> <base>
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
