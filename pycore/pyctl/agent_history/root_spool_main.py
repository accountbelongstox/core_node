# -*- coding: utf-8 -*-
"""
Root-side agent history spool process (Linux only, process entry).

Launched by pyservice_entry.sh next to the worker:

    python -m pycore.pyctl.agent_history.root_spool_main --worker-user <user> --parent-pid <pid>

Every AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S it discovers sources with the shared
source registry, keeps ONLY root-owned regular files the worker cannot read
that stay inside the home they were found in (no symlink / hard-link escape),
parses them and writes the parsed sessions into AGENT_HISTORY_ROOT_SPOOL_DIR
(root:<worker gid>, 0750 / 0640). It exits when the parent (the worker's sudo
process) exits. The worker-side reader is ``root_spool``.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import pwd
import stat
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyctl.agent_history.root_spool import (
    SPOOL_DIR_MODE,
    SPOOL_FILE_MODE,
    SPOOL_INDEX_FILE,
    SPOOL_LOCK_FILE,
)
from pycore.pyctl.agent_history.sources.source_registry import source_registry
from pycore.pyfoundations.agent_home_scanner import scan_user_homes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.agent_paths import (
    AGENT_HISTORY_ROOT_SPOOL_DIR,
    AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S,
)

# Only root-owned agent sessions (claudeteam / kimi slots started as root) are
# spooled; another human user's private sessions are never exposed.
SPOOL_SOURCE_OWNER_UID = 0
_READ_BIT = 4
_EXEC_BIT = 1


def _perm_ok(st: os.stat_result, uid: int, gids: Set[int], bit: int) -> bool:
    if st.st_uid == uid:
        return bool(st.st_mode & (bit << 6))
    if st.st_gid in gids:
        return bool(st.st_mode & (bit << 3))
    return bool(st.st_mode & bit)


def _lstat(path: str) -> Optional[os.stat_result]:
    try:
        return os.lstat(path)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistoryRootSpool] lstat failed path={path}: {exc}")
        return None


class _WorkerAccess:
    """Mode-bit read check for the worker identity (per-cycle dir cache)."""

    def __init__(self, uid: int, gids: Set[int]) -> None:
        self.uid = uid
        self.gids = gids
        self._dirs: Dict[str, bool] = {}

    def reset(self) -> None:
        self._dirs.clear()

    def _dir_ok(self, path: str) -> bool:
        ok = self._dirs.get(path)
        if ok is None:
            try:
                ok = _perm_ok(os.stat(path), self.uid, self.gids, _EXEC_BIT)
            except OSError as exc:
                ColorPrint.yellow(f"[AgentHistoryRootSpool] stat failed dir={path}: {exc}")
                ok = False
            self._dirs[path] = ok
        return ok

    def can_read(self, path: str, st: os.stat_result) -> bool:
        if not _perm_ok(st, self.uid, self.gids, _READ_BIT):
            return False
        current = os.path.dirname(path)
        while True:
            if not self._dir_ok(current):
                return False
            parent = os.path.dirname(current)
            if parent == current:
                return True
            current = parent


def _spool_file_name(path: str) -> str:
    return hashlib.md5(path.encode("utf-8")).hexdigest() + ".json"


def _prepare_spool_dir(gid: int) -> str:
    spool = AGENT_HISTORY_ROOT_SPOOL_DIR
    os.makedirs(spool, mode=SPOOL_DIR_MODE, exist_ok=True)
    st = os.lstat(spool)
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0:
        raise RuntimeError(f"spool dir is not a root-owned directory: {spool}")
    os.chown(spool, 0, gid)
    os.chmod(spool, SPOOL_DIR_MODE)
    return spool


def _write_json(spool: str, name: str, data: Dict[str, Any], gid: int) -> None:
    """Root-owned group-readable replace; O_NOFOLLOW + chown before publish,
    which the generic atomic store (owner adoption) does not provide."""
    target = os.path.join(spool, name)
    temp = f"{target}.tmp{os.getpid()}"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, SPOOL_FILE_MODE)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
    os.chown(temp, 0, gid)
    os.chmod(temp, SPOOL_FILE_MODE)
    os.replace(temp, target)


def _spoolable_sources(access: _WorkerAccess) -> Dict[str, Dict[str, Any]]:
    found: Dict[str, Dict[str, Any]] = {}
    access.reset()
    for home, user in scan_user_homes().items():
        home_real = os.path.realpath(home).rstrip(os.sep) + os.sep
        for d in source_registry.discover_all(home, user):
            path = str(d.get("path") or "")
            if not path or path in found or not path.startswith(home_real):
                continue
            st = _lstat(path)
            if (
                st is None
                or not stat.S_ISREG(st.st_mode)
                or st.st_nlink != 1
                or st.st_uid != SPOOL_SOURCE_OWNER_UID
                or access.can_read(path, st)
            ):
                continue
            found[path] = {
                "tool": d["tool"],
                "source": d["source"],
                "format": d["format"],
                "user": user,
                "home": home,
                "mtime": int(st.st_mtime),
                "bytes": int(st.st_size),
                "file": _spool_file_name(path),
            }
    return found


def _parent_alive(pid: int) -> bool:
    if pid <= 0:
        return True
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _spool_cycle(
    spool: str,
    access: _WorkerAccess,
    written: Dict[str, Tuple[int, int]],
    worker_user: str,
    gid: int,
) -> Dict[str, Tuple[int, int]]:
    sources = _spoolable_sources(access)
    for path, rec in sources.items():
        key = (rec["mtime"], rec["bytes"])
        if written.get(path) == key:
            continue
        sessions = source_registry.parse(path, rec["user"], rec["tool"], rec["source"])
        _write_json(spool, rec["file"], {"path": path, "sessions": sessions}, gid)
        written[path] = key
    keep = {rec["file"] for rec in sources.values()}
    for name in os.listdir(spool):
        if name.endswith(".json") and name != SPOOL_INDEX_FILE and name not in keep:
            os.unlink(os.path.join(spool, name))
    _write_json(spool, SPOOL_INDEX_FILE, {
        "updated_at": int(time.time()),
        "worker_user": worker_user,
        "sources": sources,
    }, gid)
    return {p: k for p, k in written.items() if p in sources}


def run(worker_user: str, parent_pid: int) -> int:
    if os.geteuid() != 0:
        ColorPrint.yellow("[AgentHistoryRootSpool] must run as root; exiting")
        return 0
    entry = pwd.getpwnam(worker_user)
    gids = set(os.getgrouplist(worker_user, entry.pw_gid))
    spool = _prepare_spool_dir(entry.pw_gid)
    lock = open(os.path.join(spool, SPOOL_LOCK_FILE), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        ColorPrint.yellow("[AgentHistoryRootSpool] another instance holds the spool; exiting")
        return 0

    access = _WorkerAccess(entry.pw_uid, gids)
    written: Dict[str, Tuple[int, int]] = {}
    ColorPrint.blue(f"[AgentHistoryRootSpool] serving worker={worker_user} spool={spool}")
    while _parent_alive(parent_pid):
        try:
            written = _spool_cycle(spool, access, written, worker_user, entry.pw_gid)
        except (OSError, ValueError) as exc:
            ColorPrint.red(f"[AgentHistoryRootSpool] cycle failed spool={spool}: {exc}")
        time.sleep(AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S)
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="agent_history_root_spool")
    parser.add_argument("--worker-user", required=True)
    parser.add_argument("--parent-pid", type=int, default=0)
    args = parser.parse_args(argv)
    return run(args.worker_user, args.parent_pid)


if __name__ == "__main__":
    sys.exit(main())
