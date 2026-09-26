# -*- coding: utf-8 -*-
"""
Root read helper for agent history (Linux only).

pyservice_entry.sh runs the worker as the desktop user (tray needs its D-Bus
session), so agent sources owned by root with mode 0600 (claudeteam / kimi1 /
kimi2 ... started as root) are unreadable to it. The launcher therefore keeps
this small root process next to the worker:

    python -m pycore.pyctl.agent_history.root_spool --worker-user <user> --parent-pid <pid>

Root side (``run``): every AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S it discovers
sources with the shared extractor registry, keeps ONLY regular files the
worker cannot read that stay inside the home they were found in (no symlink /
hard-link escape), parses them and writes the parsed sessions into
AGENT_HISTORY_ROOT_SPOOL_DIR (root:<worker gid>, 0750 / 0640). It exits when
the parent (the worker's sudo process) exits.

Worker side (``read_index`` / ``read_sessions``): the service overlays the
spooled sources onto its own discovery; extraction, live scan, prompt-new
events and the prompt archive then treat them like any other source.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.agent_home_scanner import unreadable_user_homes
from pycore.pyfoundations.system_paths import (
    AGENT_HISTORY_ROOT_SPOOL_DIR,
    AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S,
    AGENT_HISTORY_ROOT_SPOOL_STALE_S,
)

SPOOL_INDEX_FILE = "index.json"
SPOOL_LOCK_FILE = ".lock"
SPOOL_DIR_MODE = 0o750
SPOOL_FILE_MODE = 0o640
_READ_BIT = 4
_EXEC_BIT = 1


# --------------------------------------------------------------------------- #
# Worker side (read-only)
# --------------------------------------------------------------------------- #
def _trusted_spool_dir() -> Optional[str]:
    if sys.platform == "win32":
        return None
    try:
        st = os.lstat(AGENT_HISTORY_ROOT_SPOOL_DIR)
    except OSError:
        return None
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0:
        return None
    return AGENT_HISTORY_ROOT_SPOOL_DIR


def read_index() -> Dict[str, Any]:
    """{"updated_at", "sources": {path: {tool, user, home, mtime, bytes, file}}}; {} when absent."""
    spool = _trusted_spool_dir()
    if not spool:
        return {}
    try:
        with open(os.path.join(spool, SPOOL_INDEX_FILE), "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def read_sources() -> Dict[str, Dict[str, Any]]:
    sources = read_index().get("sources")
    return sources if isinstance(sources, dict) else {}


def read_sessions(file_name: str) -> List[Dict[str, Any]]:
    spool = _trusted_spool_dir()
    if not spool or os.path.basename(file_name) != file_name:
        return []
    try:
        with open(os.path.join(spool, file_name), "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return []
    sessions = data.get("sessions") if isinstance(data, dict) else None
    return [s for s in sessions if isinstance(s, dict)] if isinstance(sessions, list) else []


def spool_status() -> Dict[str, Any]:
    index = read_index()
    updated_at = int(index.get("updated_at") or 0)
    sources = index.get("sources") if isinstance(index.get("sources"), dict) else {}
    return {
        "active": bool(updated_at) and time.time() - updated_at <= AGENT_HISTORY_ROOT_SPOOL_STALE_S,
        "updated_at": updated_at,
        "sources": len(sources),
        "homes": sorted({str(r.get("home") or "") for r in sources.values() if isinstance(r, dict)} - {""}),
        "worker_user": str(index.get("worker_user") or ""),
    }


def uncovered_unreadable_homes() -> List[str]:
    """Unreadable homes minus those an active root spool already covers."""
    unreadable = unreadable_user_homes()
    if not unreadable:
        return unreadable
    status = spool_status()
    if not status["active"]:
        return unreadable
    covered = {os.path.realpath(h) for h in status["homes"]}
    return [h for h in unreadable if os.path.realpath(h) not in covered]


# --------------------------------------------------------------------------- #
# Root side
# --------------------------------------------------------------------------- #
def _perm_ok(st: os.stat_result, uid: int, gids: Set[int], bit: int) -> bool:
    if st.st_uid == uid:
        return bool(st.st_mode & (bit << 6))
    if st.st_gid in gids:
        return bool(st.st_mode & (bit << 3))
    return bool(st.st_mode & bit)


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
            except OSError:
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
    target = os.path.join(spool, name)
    temp = f"{target}.tmp{os.getpid()}"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, SPOOL_FILE_MODE)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
    os.chown(temp, 0, gid)
    os.chmod(temp, SPOOL_FILE_MODE)
    os.replace(temp, target)


def _spoolable_sources(extractors: List[Any], access: _WorkerAccess) -> Dict[str, Dict[str, Any]]:
    from pycore.pyfoundations.agent_home_scanner import scan_user_homes

    found: Dict[str, Dict[str, Any]] = {}
    access.reset()
    for home, user in scan_user_homes().items():
        home_real = os.path.realpath(home).rstrip(os.sep) + os.sep
        for extractor in extractors:
            for d in extractor.discover(home, user):
                path = str(d.get("path") or "")
                if not path or path in found or not path.startswith(home_real):
                    continue
                try:
                    st = os.lstat(path)
                except OSError:
                    continue
                if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or access.can_read(path, st):
                    continue
                found[path] = {
                    "tool": extractor.tool(),
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


def run(worker_user: str, parent_pid: int) -> int:
    import fcntl
    import pwd

    from pycore.pyctl.agent_history.extractor_registry import build_extractors

    if os.geteuid() != 0:
        print("[AgentHistoryRootSpool] must run as root; exiting", flush=True)
        return 0
    entry = pwd.getpwnam(worker_user)
    gids = set(os.getgrouplist(worker_user, entry.pw_gid))
    spool = _prepare_spool_dir(entry.pw_gid)
    lock = open(os.path.join(spool, SPOOL_LOCK_FILE), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("[AgentHistoryRootSpool] another instance holds the spool; exiting", flush=True)
        return 0

    extractors = build_extractors()
    by_tool = {extractor.tool(): extractor for extractor in extractors}
    access = _WorkerAccess(entry.pw_uid, gids)
    written: Dict[str, Tuple[int, int]] = {}
    print(f"[AgentHistoryRootSpool] serving worker={worker_user} spool={spool}", flush=True)
    while _parent_alive(parent_pid):
        try:
            sources = _spoolable_sources(extractors, access)
            for path, rec in sources.items():
                key = (rec["mtime"], rec["bytes"])
                if written.get(path) == key:
                    continue
                sessions = by_tool[rec["tool"]].parse_source(path, rec["user"])
                _write_json(spool, rec["file"], {"path": path, "sessions": sessions}, entry.pw_gid)
                written[path] = key
            keep = {rec["file"] for rec in sources.values()}
            for name in os.listdir(spool):
                if name.endswith(".json") and name != SPOOL_INDEX_FILE and name not in keep:
                    os.unlink(os.path.join(spool, name))
            written = {p: k for p, k in written.items() if p in sources}
            _write_json(spool, SPOOL_INDEX_FILE, {
                "updated_at": int(time.time()),
                "worker_user": worker_user,
                "sources": sources,
            }, entry.pw_gid)
        except Exception as e:
            print(f"[AgentHistoryRootSpool] cycle failed: {e}", flush=True)
        time.sleep(AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S)
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="agent_history_root_spool")
    parser.add_argument("--worker-user", required=True)
    parser.add_argument("--parent-pid", type=int, default=0)
    args = parser.parse_args(argv)
    return run(args.worker_user, args.parent_pid)


__all__ = [
    "read_index",
    "read_sessions",
    "read_sources",
    "spool_status",
    "uncovered_unreadable_homes",
]


if __name__ == "__main__":
    sys.exit(main())
