# -*- coding: utf-8 -*-
"""Real-user ownership policy for shared data entries (Python twin of
scripts/shells/linux/common/fs_perm_helpers.sh).

A root pycore process (launcher, agent-history root spool, root-context
worker, installers) creates shared entries owned by the active regular login
user with the shared mode-777 policy, so the de-privileged worker and every
other project can read and write them. A non-root process only applies the
mode to entries it owns. Windows, protected system paths and mount-fixed
filesystems (NTFS/FUSE/exFAT: ownership is set by mount options) are left
as created.

Owner resolution mirrors resolve_active_permission_owner: explicit owner
(CORE_NODE_DATA_OWNER, exported by pyservice_entry.sh), sudo/pkexec caller,
active login session, best-scored /home user.

Stdlib-only: imported by core_node_dirs and pygvar.
"""

from __future__ import annotations

import functools
import os
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import IO, Any, Iterable, Optional, Tuple, Union

from pycore.pyfoundations.desktop_session import RUN_USER_ROOT, SESSION_BUS_SOCKET
from pycore.pyfoundations.service_contract import path_values as _contract_paths

IS_POSIX = os.name != 'nt'
if IS_POSIX:
    import pwd

DATA_OWNER_ENV = 'CORE_NODE_DATA_OWNER'
# DATA_OWNER_ENV value that keeps root-created entries owned by root.
ROOT_OWNER_NAME = 'root'
DATA_OWNER_UID_ENV_KEYS = ('SUDO_UID', 'PKEXEC_UID')
DATA_OWNER_NAME_ENV_KEYS = ('SUDO_USER',)
ROOT_UID = 0
REGULAR_UID_MIN = 1000
NOBODY_UID = 65534
NOLOGIN_SHELL_SUFFIXES = ('/nologin', '/false')
EXCLUDED_USERS = frozenset({
    'root', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 'news', 'uucp',
    'proxy', 'backup', 'list', 'irc', '_apt', 'git', 'gitea', 'mysql',
    'postgres', 'redis', 'nginx', 'www-data', 'node', 'nobody', 'daemon',
    'messagebus', 'sshd', 'polkitd', 'systemd-network', 'systemd-timesync',
})
HOME_ROOT = Path('/home')
HOME_SCORE_MARKERS = ('Downloads', 'Documents', 'Desktop')
PROC_MOUNTS = Path('/proc/mounts')
MOUNT_ESCAPED_SPACE = '\\040'
MOUNT_FIXED_FSTYPES = frozenset(_contract_paths('ntfs_fs_types')) | frozenset({
    'fuse', 'fuseblk', 'exfat', 'vfat', 'drvfs',
})
SHARED_MODE = 0o777
# Mirrors fs_perm_target_safety: allowed subtrees win, then protected
# subtrees and exact system roots are never re-owned or re-moded.
ADOPT_ALLOWED_TREES = ('/usr/local', '/var/_core_node')
ADOPT_PROTECTED_TREES = (
    '/usr', '/etc', '/bin', '/sbin', '/lib', '/lib64', '/boot', '/root',
    '/run', '/proc', '/sys', '/dev',
)
ADOPT_PROTECTED_EXACT = frozenset({
    '/', '/var', '/var/lib', '/var/log', '/home', '/opt', '/srv', '/mnt',
    '/media', '/tmp',
})

PathLike = Union[str, 'os.PathLike[str]']


@dataclass(frozen=True)
class DataOwner:
    """Regular login user that owns shared entries created by root."""

    uid: int
    gid: int
    name: str


@functools.lru_cache(maxsize=1)
def _passwd_entries() -> Tuple[Any, ...]:
    return tuple(pwd.getpwall()) if IS_POSIX else ()


def _is_regular(entry: Any) -> bool:
    return (
        REGULAR_UID_MIN <= entry.pw_uid < NOBODY_UID
        and entry.pw_name not in EXCLUDED_USERS
        and not entry.pw_shell.endswith(NOLOGIN_SHELL_SUFFIXES)
    )


def _regular_by_name(name: str) -> Optional[Any]:
    for entry in _passwd_entries():
        if entry.pw_name == name and _is_regular(entry):
            return entry
    return None


def _regular_by_uid(uid: int) -> Optional[Any]:
    for entry in _passwd_entries():
        if entry.pw_uid == uid and _is_regular(entry):
            return entry
    return None


def _env_candidates() -> Iterable[Optional[Any]]:
    yield _regular_by_name(os.environ.get(DATA_OWNER_ENV, '').strip())
    for key in DATA_OWNER_UID_ENV_KEYS:
        raw_uid = os.environ.get(key, '').strip()
        yield _regular_by_uid(int(raw_uid)) if raw_uid.isdigit() else None
    for key in DATA_OWNER_NAME_ENV_KEYS:
        yield _regular_by_name(os.environ.get(key, '').strip())


def _active_session_candidate() -> Optional[Any]:
    if not RUN_USER_ROOT.is_dir():
        return None
    session_uids = sorted(
        int(runtime_dir.name)
        for runtime_dir in RUN_USER_ROOT.iterdir()
        if runtime_dir.name.isdigit() and (runtime_dir / SESSION_BUS_SOCKET).exists()
    )
    for uid in session_uids:
        entry = _regular_by_uid(uid)
        if entry is not None:
            return entry
    return None


def _home_score_candidate() -> Optional[Any]:
    best_entry = None
    best_score = -1
    for entry in _passwd_entries():
        home = Path(entry.pw_dir)
        if not _is_regular(entry) or home.parent != HOME_ROOT or not home.is_dir():
            continue
        score = sum(1 for marker in HOME_SCORE_MARKERS if (home / marker).is_dir())
        if score > best_score:
            best_entry, best_score = entry, score
    return best_entry


@functools.lru_cache(maxsize=1)
def data_owner() -> Optional[DataOwner]:
    """Owner for entries this process creates; None unless running as root
    with a resolvable regular login user."""
    if not IS_POSIX or os.geteuid() != ROOT_UID:
        return None
    # An explicit root owner disables delegation (hosted notebook VMs ship an
    # unused default login user that must not take over root's files).
    if os.environ.get(DATA_OWNER_ENV, '').strip() == ROOT_OWNER_NAME:
        return None
    for entry in _env_candidates():
        if entry is not None:
            return DataOwner(uid=entry.pw_uid, gid=entry.pw_gid, name=entry.pw_name)
    entry = _active_session_candidate() or _home_score_candidate()
    if entry is None:
        return None
    return DataOwner(uid=entry.pw_uid, gid=entry.pw_gid, name=entry.pw_name)


def real_user_name() -> str:
    """Regular login user behind this process: the data owner under root,
    otherwise the current account."""
    owner = data_owner()
    if owner is not None:
        return owner.name
    if IS_POSIX:
        current_uid = os.getuid()
        for entry in _passwd_entries():
            if entry.pw_uid == current_uid:
                return entry.pw_name
    return os.environ.get('USER') or os.environ.get('USERNAME') or ''


def mount_source(target: str) -> Optional[Tuple[str, str, str]]:
    """Longest-matching (mountpoint, source, fstype) for target from /proc/mounts."""
    best: Optional[Tuple[str, str, str]] = None
    if not PROC_MOUNTS.is_file():
        return None
    for line in PROC_MOUNTS.read_text(encoding='utf-8', errors='replace').splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        mount_point = parts[1].replace(MOUNT_ESCAPED_SPACE, ' ')
        if target == mount_point or target.startswith(mount_point.rstrip('/') + '/'):
            if best is None or len(mount_point) > len(best[0]):
                best = (mount_point, parts[0], parts[2])
    return best


def _ownership_is_mount_fixed(path: str) -> bool:
    found = mount_source(path)
    return found is not None and found[2] in MOUNT_FIXED_FSTYPES


def _is_protected(path: str) -> bool:
    for tree in ADOPT_ALLOWED_TREES:
        if path == tree or path.startswith(tree + '/'):
            return False
    if path in ADOPT_PROTECTED_EXACT:
        return True
    return any(path == tree or path.startswith(tree + '/') for tree in ADOPT_PROTECTED_TREES)


def adopt_path(path: PathLike, mode: Optional[int] = None) -> Path:
    """Give an existing entry to the data owner (root only) and apply mode
    (root, or the entry's own owner). Symlinks are never followed."""
    target = Path(path)
    if not IS_POSIX or not os.path.lexists(target):
        return target
    resolved = os.path.realpath(target)
    if _is_protected(os.path.abspath(target)) or _is_protected(resolved):
        return target
    status = os.lstat(target)
    owner = data_owner()
    euid = os.geteuid()
    needs_chown = owner is not None and (status.st_uid, status.st_gid) != (owner.uid, owner.gid)
    needs_chmod = (
        mode is not None
        and not stat.S_ISLNK(status.st_mode)
        and stat.S_IMODE(status.st_mode) != mode
        and euid in (ROOT_UID, status.st_uid)
    )
    if not (needs_chown or needs_chmod) or _ownership_is_mount_fixed(resolved):
        return target
    if needs_chown:
        os.lchown(target, owner.uid, owner.gid)
    if needs_chmod:
        os.chmod(target, mode)
    return target


def ensure_owned_dir(path: PathLike) -> Path:
    """mkdir -p, then apply the shared owner/mode policy to the target and to
    every directory this call created."""
    target = Path(path)
    created = [entry for entry in (target, *target.parents) if not entry.exists()]
    target.mkdir(parents=True, exist_ok=True)
    for entry in reversed(created):
        adopt_path(entry, SHARED_MODE)
    if target not in created:
        adopt_path(target, SHARED_MODE)
    return target


def open_owned(path: PathLike, mode: str = 'a', **kwargs: Any) -> IO[Any]:
    """open() for shared files: parent ensured, file adopted after opening."""
    target = Path(path)
    ensure_owned_dir(target.parent)
    handle = open(target, mode, **kwargs)
    adopt_path(target, SHARED_MODE)
    return handle


__all__ = [
    'DATA_OWNER_ENV',
    'SHARED_MODE',
    'DataOwner',
    'data_owner',
    'real_user_name',
    'mount_source',
    'adopt_path',
    'ensure_owned_dir',
    'open_owned',
]
