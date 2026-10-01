# -*- coding: utf-8 -*-
"""
Code Sync watch manager — ONE shared, event-style file index.

Replaces the old per-client full-tree rescan: a single background thread scans the
configured watch_dirs once per tick, keeps one shared metadata and hash index,
and only re-hashes a file when its size or filesystem timestamps change. Every
dev-to-client push thread then just DIFFS this shared
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
import json
import os
import time
import uuid
from pathlib import Path
from typing import Dict, List, Tuple

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    RunningFlag,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.text_eol import is_binary, normalize_eol
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.codesync.paths import codesync_cache_dir, sync_root
from pycore.pyutils.codesync.sync_settings import build_excluder, sync_settings

WATCH_TICK = 1.0  # seconds between index refreshes
INDEX_CACHE_VERSION = 2


class WatchManager:
    def __init__(self):
        owner_id = uuid.uuid4().hex
        self._index: Dict[str, Tuple[float, str, str, int, int, int]] = {}
        self._metrics = {
            "duration_ms": 0,
            "files": 0,
            "bytes": 0,
            "hashed": 0,
            "cached": 0,
            "last_scan_at": 0.0,
        }
        self._running = RunningFlag("codesync.watch")
        self._cache_path = codesync_cache_dir() / "file_index.json"
        # Set once the FIRST scan has completed with a non-empty index. The push
        # sender gates on this so it never connects + sends an (empty) manifest
        # before the initial scan of a large tree finishes (which would just abort
        # and churn the clients).
        self._ready_signal = f"codesync.watch.ready.{owner_id}"
        init_serialized_owner(self, "codesync.watch.state", "CodeSyncWatchState")

    def ready(self) -> bool:
        """True once the initial index scan has populated the snapshot."""
        return bool(THREAD_BUS.get_signal(self._ready_signal, False))

    def running(self) -> bool:
        return self._running.is_running()

    def wait_ready(self, timeout: float = None) -> bool:
        if self.ready():
            return True
        return bool(THREAD_BUS.wait_signal(self._ready_signal, timeout))

    # ----- config ---------------------------------------------------------- #
    def watch_dirs(self) -> List[Path]:
        """Effective watch dirs: the configured list, or [project root] if empty."""
        cfg = sync_settings.get()
        dirs = [d for d in (cfg.get("watch_dirs") or []) if str(d).strip()]
        if not dirs:
            return [sync_root()]
        out = []
        for d in dirs:
            p = Path(d)
            if not p.is_absolute():
                p = sync_root() / d
            out.append(p)
        return out

    def watch_dirs_str(self) -> List[str]:
        return [str(p) for p in self.watch_dirs()]

    def _dest_rel(self, abspath: Path, watch_dir: Path, root: Path) -> str:
        """Client-side relative path: relative to the core_node root when possible
        (preserves the tree); otherwise basename(watch_dir)/<rel-to-watch-dir>."""
        if abspath.is_relative_to(root):
            return abspath.relative_to(root).as_posix()
        sub = abspath.relative_to(watch_dir).as_posix() if abspath.is_relative_to(watch_dir) else abspath.name
        return f"{watch_dir.name}/{sub}"

    # ----- lifecycle ------------------------------------------------------- #
    def start(self) -> None:
        if not self._running.start():
            return
        start_bus_task(self._loop, thread_name="CodeSync-Watch")
        THREAD_BUS.register_shutdown_handler(self.stop, priority=69, name="code_sync_watch")
        ColorPrint.green(f"[Watch] Started ({', '.join(self.watch_dirs_str())})")

    def stop(self) -> None:
        self._running.stop()

    def _loop(self) -> None:
        while self._running.active():
            self._scan_once()
            self._running.wait(WATCH_TICK)

    def _scan_once(self) -> None:
        started_at = time.monotonic()
        root = sync_root()
        excluder = build_excluder(root)
        old = self.snapshot()
        if not old:
            old = self._load_cache()
        new_index: Dict[str, Tuple[float, str, str, int, int, int]] = {}
        hashed = 0
        cached = 0
        total_bytes = 0
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
                                stat = e.stat(follow_symlinks=False)
                                mtime = stat.st_mtime
                                mtime_ns = stat.st_mtime_ns
                                ctime_ns = stat.st_ctime_ns
                                size = stat.st_size
                                prev = old.get(dest)
                                if (prev and len(prev) >= 6
                                        and int(prev[4]) == mtime_ns
                                        and int(prev[5]) == ctime_ns
                                        and int(prev[3]) == size
                                        and prev[2] == str(ap)):
                                    new_index[dest] = (
                                        mtime, prev[1], str(ap), size, mtime_ns, ctime_ns,
                                    )
                                    cached += 1
                                else:
                                    new_index[dest] = (
                                        mtime, self._hash(ap), str(ap), size, mtime_ns, ctime_ns,
                                    )
                                    hashed += 1
                                total_bytes += size
                            except OSError:
                                continue
                except OSError:
                    continue
        metrics = {
            "duration_ms": int((time.monotonic() - started_at) * 1000),
            "files": len(new_index),
            "bytes": total_bytes,
            "hashed": hashed,
            "cached": cached,
            "last_scan_at": time.time(),
        }
        changed = new_index != old
        self._replace_index(new_index, metrics)
        if changed:
            self._save_cache(new_index)
        # Mark ready once we have a real, non-empty index: the push sender waits for
        # this before connecting, so a (re)start never sends an empty manifest.
        if new_index:
            THREAD_BUS.signal(self._ready_signal, True)

    @staticmethod
    def _hash(path: Path) -> str:
        """Canonical content hash: text files are hashed in their LF-normalized
        form so the same source produces the same hash on Windows and Linux (and
        so it matches git's normalized blobs). Binary files are hashed raw, and
        stay chunked to bound memory. An unreadable file hashes to ""."""
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
        except OSError as exc:
            ColorPrint.yellow(f"[Watch] hash read failed path={path}: {exc}")
            return ""
        return hashlib.md5(normalize_eol(head + rest)).hexdigest()

    @serialized_method
    def _replace_index(
        self,
        new_index: Dict[str, Tuple[float, str, str, int, int, int]],
        metrics: Dict[str, float],
    ) -> None:
        self._index = new_index
        self._metrics = dict(metrics)

    @serialized_method
    def snapshot(self) -> Dict[str, Tuple[float, str, str, int, int, int]]:
        return dict(self._index)

    @serialized_method
    def get_metrics(self) -> Dict[str, float]:
        return dict(self._metrics)

    def code_stats(self) -> Dict[str, float]:
        metrics = self.get_metrics()
        snap = self.snapshot()
        latest = max((float(meta[0]) for meta in snap.values()), default=0.0)
        return {
            "files": int(metrics.get("files") or 0),
            "bytes": int(metrics.get("bytes") or 0),
            "last_modified": latest,
        }

    def _load_cache(self) -> Dict[str, Tuple[float, str, str, int, int, int]]:
        if not self._cache_path.is_file():
            return {}
        try:
            payload = json.loads(self._cache_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[Watch] index cache ignored path={self._cache_path}: {exc}")
            return {}
        if not isinstance(payload, dict) or int(payload.get("version") or 0) != INDEX_CACHE_VERSION:
            return {}
        return {
            str(dest): (
                float(record[0]),
                str(record[1]),
                str(record[2]),
                int(record[3]),
                int(record[4]),
                int(record[5]),
            )
            for dest, record in (payload.get("files") or {}).items()
            if isinstance(record, list) and len(record) == 6
        }

    def _save_cache(
        self,
        index: Dict[str, Tuple[float, str, str, int, int, int]],
    ) -> None:
        payload = {
            "version": INDEX_CACHE_VERSION,
            "files": {dest: list(meta) for dest, meta in index.items()},
        }
        try:
            atomic_write_json(self._cache_path, payload, indent=None)
        except OSError as exc:
            ColorPrint.yellow(f"[Watch] index cache save failed path={self._cache_path}: {exc}")


watch_manager = WatchManager()
