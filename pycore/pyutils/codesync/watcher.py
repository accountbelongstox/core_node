# -*- coding: utf-8 -*-
"""
Code Sync watch manager — ONE shared, event-style file index (stdlib only).

Replaces the old per-client full-tree rescan: a single background thread scans the
configured watch_dirs once per tick, keeps a `dest_rel -> (mtime, hash, abspath)`
index, and — crucially — only re-hashes a file when its mtime advanced (unchanged
files are never re-read). Every dev→client push thread then just DIFFS this shared
snapshot against what it last sent (a cheap dict compare), so N clients cost one
scan, not N. New/modified entries are the "create/modify events".

Multi-dir + relative mapping: each watch dir's files map to the client under their
path relative to the core_node root (a dir outside the root maps under its
basename), so subdirs become the client's subdirs.

NOTE: detection is mtime-poll (stdlib, cross-platform; works where inotify doesn't,
e.g. WSL /mnt). True OS events (ctypes inotify / ReadDirectoryChangesW) are a future
optimization — the index/diff API here would not change.
"""

import hashlib
import os
import time
import uuid
from pathlib import Path
from typing import Dict, List, Tuple

from pycore.pyutils.codesync.runtime import (
    log as ColorPrint, is_shutdown_requested, register_shutdown_handler,
    get_core_node_root, THREAD_BUS, init_serialized_owner, serialized_method,
    start_bus_task,
)
from pycore.pyutils.codesync.sync_settings import build_excluder, get_sync_settings
from pycore.pyutils.codesync.textnorm import is_binary, normalize_eol

WATCH_TICK = 1.0  # seconds between index refreshes


class WatchManager:
    def __init__(self):
        owner_id = uuid.uuid4().hex
        self._index: Dict[str, Tuple[float, str, str]] = {}  # dest_rel -> (mtime, hash, abspath)
        self._running = False
        self._thread = None
        # Set once the FIRST scan has completed with a non-empty index. The push
        # sender gates on this so it never connects + sends an (empty) manifest
        # before the initial scan of a large tree finishes (which would just abort
        # and churn the clients).
        self._ready_signal = f"codesync.watch.ready.{owner_id}"
        self._running_signal = f"codesync.watch.running.{owner_id}"
        init_serialized_owner(self, "codesync.watch.state", "CodeSyncWatchState")
        THREAD_BUS.clear_signal(self._ready_signal)
        THREAD_BUS.signal(self._running_signal, False)

    def ready(self) -> bool:
        """True once the initial index scan has populated the snapshot."""
        return bool(THREAD_BUS.get_signal(self._ready_signal, False))

    def wait_ready(self, timeout: float = None) -> bool:
        if self.ready():
            return True
        return bool(THREAD_BUS.wait_signal(self._ready_signal, timeout))

    # ----- config ---------------------------------------------------------- #
    def watch_dirs(self) -> List[Path]:
        """Effective watch dirs: the configured list, or [project root] if empty."""
        cfg = get_sync_settings().get()
        dirs = [d for d in (cfg.get("watch_dirs") or []) if str(d).strip()]
        if not dirs:
            return [get_core_node_root()]
        out = []
        for d in dirs:
            p = Path(d)
            if not p.is_absolute():
                p = get_core_node_root() / d
            out.append(p)
        return out

    def watch_dirs_str(self) -> List[str]:
        return [str(p) for p in self.watch_dirs()]

    def _dest_rel(self, abspath: Path, watch_dir: Path, root: Path) -> str:
        """Client-side relative path: relative to the core_node root when possible
        (preserves the tree); otherwise basename(watch_dir)/<rel-to-watch-dir>."""
        try:
            return abspath.relative_to(root).as_posix()
        except Exception:
            try:
                sub = abspath.relative_to(watch_dir).as_posix()
            except Exception:
                sub = abspath.name
            return f"{watch_dir.name}/{sub}"

    # ----- lifecycle ------------------------------------------------------- #
    @serialized_method
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        THREAD_BUS.signal(self._running_signal, True)
        self._thread = start_bus_task(self._loop, thread_name="CodeSync-Watch")
        register_shutdown_handler(self.stop, priority=69, name="code_sync_watch")
        ColorPrint.green(f"[Watch] Started ({', '.join(self.watch_dirs_str())})")

    @serialized_method
    def stop(self) -> None:
        self._running = False
        THREAD_BUS.signal(self._running_signal, False)

    def _loop(self) -> None:
        while THREAD_BUS.get_signal(self._running_signal, False) and not is_shutdown_requested():
            try:
                self._scan_once()
            except Exception as exc:
                ColorPrint.yellow(f"[Watch] scan error: {exc}")
            steps = max(1, int(WATCH_TICK * 2))
            for _ in range(steps):
                if not THREAD_BUS.get_signal(self._running_signal, False) or is_shutdown_requested():
                    return
                time.sleep(0.5)

    def _scan_once(self) -> None:
        root = get_core_node_root()
        excluder = build_excluder(root)
        old = self.snapshot()
        new_index: Dict[str, Tuple[float, str, str]] = {}
        for wd in self.watch_dirs():
            if not wd.exists():
                continue
            stack = [str(wd)]
            while stack:
                d = stack.pop()
                try:
                    with os.scandir(d) as it:
                        for e in it:
                            try:
                                if e.is_dir(follow_symlinks=False):
                                    if not excluder.dir_excluded(e.name, e.path):
                                        stack.append(e.path)
                                    continue
                                if excluder.file_excluded(e.name, e.path):
                                    continue
                                ap = Path(e.path)
                                dest = self._dest_rel(ap, wd, root)
                                mtime = e.stat(follow_symlinks=False).st_mtime
                                prev = old.get(dest)
                                if prev and prev[0] >= mtime and prev[2] == str(ap):
                                    new_index[dest] = prev   # unchanged -> reuse hash (no re-read)
                                else:
                                    new_index[dest] = (mtime, self._hash(ap), str(ap))
                            except OSError:
                                continue
                except OSError:
                    continue
        self._replace_index(new_index)
        # Mark ready once we have a real, non-empty index: the push sender waits for
        # this before connecting, so a (re)start never sends an empty manifest.
        if new_index:
            THREAD_BUS.signal(self._ready_signal, True)

    @staticmethod
    def _hash(path: Path) -> str:
        """Canonical content hash: text files are hashed in their LF-normalized
        form so the same source produces the same hash on Windows and Linux (and
        so it matches git's normalized blobs). Binary files are hashed raw, and
        stay chunked to bound memory."""
        try:
            with open(path, "rb") as f:
                head = f.read(65536)
                if is_binary(head):
                    m = hashlib.md5()
                    m.update(head)
                    for chunk in iter(lambda: f.read(65536), b""):
                        m.update(chunk)
                    return m.hexdigest()
                rest = f.read()
            return hashlib.md5(normalize_eol(head + rest)).hexdigest()
        except Exception:
            return ""

    @serialized_method
    def _replace_index(self, new_index: Dict[str, Tuple[float, str, str]]) -> None:
        self._index = new_index

    @serialized_method
    def snapshot(self) -> Dict[str, Tuple[float, str, str]]:
        return dict(self._index)


class _WatchManagerProvider:
    def __init__(self) -> None:
        self._instance = None
        init_serialized_owner(self, "codesync.watch_provider", "CodeSyncWatchProvider")

    @serialized_method
    def get(self) -> WatchManager:
        if self._instance is None:
            self._instance = WatchManager()
        return self._instance


_watch_manager_provider = _WatchManagerProvider()


def get_watch_manager() -> WatchManager:
    return _watch_manager_provider.get()
