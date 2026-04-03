# Pair-code sync client: first run full tree sync; then filesystem watch + debounced incremental updates.

from __future__ import annotations

import fnmatch
import json
import os
import socket
import threading
import time
from typing import Callable, Iterable

from protocol import load_json_config, read_json_frame, resolve_path_against, write_json_frame

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

_DEFAULT_EXCLUDES = (
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    ".idea",
    ".vs",
    "Thumbs.db",
    ".DS_Store",
    "*.pyc",
    "*.pyo",
    "*.module",
)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_CLIENT_CONFIG = os.path.join(_SCRIPT_DIR, "client_config.json")
_STATE_FILE = os.path.join(_SCRIPT_DIR, ".sync_client_state.json")


def _excluded(rel_unix: str, patterns: Iterable[str]) -> bool:
    rel = rel_unix.replace("\\", "/")
    parts = rel.split("/")
    name = parts[-1] if parts else ""
    for pat in patterns:
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel, pat):
            return True
        for part in parts:
            if fnmatch.fnmatch(part, pat):
                return True
    return False


def _remove_prefix(snap: dict[str, tuple[float, int]], rel: str) -> None:
    rel = rel.replace("\\", "/").strip("/")
    for k in list(snap.keys()):
        if k == rel or k.startswith(rel + "/"):
            del snap[k]


def _scan_local(root: str, excludes: tuple[str, ...]) -> dict[str, tuple[float, int]]:
    root = os.path.abspath(root)
    out: dict[str, tuple[float, int]] = {}
    for dirpath, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir == ".":
            rel_dir = ""
        rel_unix = rel_dir.replace(os.sep, "/") if rel_dir else ""
        dirnames[:] = [
            d
            for d in dirnames
            if not _excluded(
                (rel_unix + "/" + d) if rel_unix else d,
                excludes,
            )
        ]
        for fn in filenames:
            abs_f = os.path.join(dirpath, fn)
            rel_u = f"{rel_unix}/{fn}" if rel_unix else fn
            if _excluded(rel_u, excludes):
                continue
            try:
                st = os.stat(abs_f)
            except OSError:
                continue
            if not os.path.isfile(abs_f):
                continue
            out[rel_u] = (st.st_mtime, st.st_size)
    return out


def _scan_subtree(root: str, base_rel: str, excludes: tuple[str, ...]) -> dict[str, tuple[float, int]]:
    root = os.path.abspath(root)
    base = os.path.join(root, base_rel.replace("/", os.sep))
    if not os.path.isdir(base):
        return {}
    out: dict[str, tuple[float, int]] = {}
    for dirpath, dirnames, filenames in os.walk(base, topdown=True, followlinks=False):
        rel_dir = os.path.relpath(dirpath, root).replace(os.sep, "/")
        dirnames[:] = [
            d
            for d in dirnames
            if not _excluded(
                (rel_dir + "/" + d) if rel_dir else d,
                excludes,
            )
        ]
        for fn in filenames:
            abs_f = os.path.join(dirpath, fn)
            rel_u = f"{rel_dir}/{fn}" if rel_dir else fn
            if _excluded(rel_u, excludes):
                continue
            try:
                st = os.stat(abs_f)
            except OSError:
                continue
            if not os.path.isfile(abs_f):
                continue
            out[rel_u] = (st.st_mtime, st.st_size)
    return out


def _update_one(
    snap: dict[str, tuple[float, int]],
    root: str,
    excludes: tuple[str, ...],
    rel: str,
) -> None:
    rel = rel.replace("\\", "/").strip("/")
    if not rel:
        return
    abs_p = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(abs_p):
        _remove_prefix(snap, rel)
        return
    if os.path.isfile(abs_p):
        if _excluded(rel, excludes):
            snap.pop(rel, None)
            return
        try:
            st = os.stat(abs_p)
        except OSError:
            snap.pop(rel, None)
            return
        snap[rel] = (st.st_mtime, st.st_size)
        return
    if os.path.isdir(abs_p):
        _remove_prefix(snap, rel)
        snap.update(_scan_subtree(root, rel, excludes))


def _to_rel(root: str, abs_path: str) -> str | None:
    root = os.path.abspath(root)
    try:
        rel = os.path.relpath(os.path.abspath(abs_path), root).replace(os.sep, "/")
    except ValueError:
        return None
    if rel.startswith(".."):
        return None
    return rel


def _path_entirely_excluded(rel: str, excludes: tuple[str, ...]) -> bool:
    rel = rel.replace("\\", "/").strip("/")
    if not rel:
        return False
    parts = rel.split("/")
    for i in range(len(parts)):
        seg = "/".join(parts[: i + 1])
        if _excluded(seg, excludes):
            return True
    return False


class _WatchHandler(FileSystemEventHandler):
    def __init__(
        self,
        root: str,
        excludes: tuple[str, ...],
        snap: dict[str, tuple[float, int]],
        debounce: float,
        on_flush: Callable[[dict[str, tuple[float, int]]], None],
    ) -> None:
        super().__init__()
        self.root = os.path.abspath(root)
        self.excludes = excludes
        self.snap = snap
        self.debounce = debounce
        self.on_flush = on_flush
        self._lock = threading.Lock()
        self._pending: set[str] = set()
        self._timer: threading.Timer | None = None

    def _queue(self, abs_path: str) -> None:
        rel = _to_rel(self.root, abs_path)
        if rel is None:
            return
        if _path_entirely_excluded(rel, self.excludes):
            return
        with self._lock:
            self._pending.add(rel)
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce, self._run_flush)
            self._timer.daemon = True
            self._timer.start()

    def _run_flush(self) -> None:
        with self._lock:
            rels = self._pending
            self._pending = set()
            self._timer = None
        if not rels:
            return
        ordered = sorted(rels, key=lambda x: (-len(x.replace("\\", "/").strip("/").split("/")), x))
        with self._lock:
            for rel in ordered:
                _update_one(self.snap, self.root, self.excludes, rel)
            snap_copy = dict(self.snap)
        self.on_flush(snap_copy)

    def on_created(self, event: object) -> None:
        self._queue(event.src_path)

    def on_deleted(self, event: object) -> None:
        self._queue(event.src_path)

    def on_modified(self, event: object) -> None:
        self._queue(event.src_path)

    def on_moved(self, event: object) -> None:
        self._queue(event.src_path)
        if getattr(event, "dest_path", None):
            self._queue(event.dest_path)


def _connect(host: str, port: int) -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3600.0)
    s.connect((host, port))
    return s


def _auth(sock: socket.socket, pair: str) -> None:
    write_json_frame(sock, {"cmd": "auth", "pair": pair})
    r = read_json_frame(sock)
    if r.get("cmd") != "auth_ok":
        raise RuntimeError(r)


def _send_file(sock: socket.socket, root: str, rel_unix: str, mtime: float) -> None:
    dst = os.path.join(root, rel_unix.replace("/", os.sep))
    with open(dst, "rb") as f:
        data = f.read()
    write_json_frame(
        sock,
        {"cmd": "file", "path": rel_unix, "size": len(data), "mtime": mtime},
    )
    if data:
        sock.sendall(data)
    r = read_json_frame(sock)
    if r.get("cmd") not in ("ack",):
        raise RuntimeError(r)


def _manifest_round(
    sock: socket.socket,
    local_root: str,
    snap: dict[str, tuple[float, int]],
) -> None:
    files_payload: dict[str, dict[str, float | int]] = {}
    for rel, (mt, sz) in snap.items():
        files_payload[rel] = {"mtime": mt, "size": sz}
    write_json_frame(sock, {"cmd": "manifest", "files": files_payload})
    plan = read_json_frame(sock)
    if plan.get("cmd") != "sync_plan":
        raise RuntimeError(plan)
    up = plan.get("upload") or []
    if not isinstance(up, list):
        raise RuntimeError("sync_plan.upload must be list")
    for rel in up:
        rel_s = str(rel).replace("\\", "/")
        if rel_s not in snap:
            raise RuntimeError(f"server asked unknown path: {rel_s}")
        mt = snap[rel_s][0]
        _send_file(sock, local_root, rel_s, mt)
    write_json_frame(sock, {"cmd": "bye"})
    _ = read_json_frame(sock)


def _run_one_sync(
    host: str,
    port: int,
    pair: str,
    root: str,
    snap: dict[str, tuple[float, int]],
) -> None:
    sock = _connect(host, port)
    try:
        _auth(sock, pair)
        _manifest_round(sock, root, snap)
    finally:
        try:
            sock.close()
        except OSError:
            pass


def _load_state() -> dict:
    if not os.path.isfile(_STATE_FILE):
        return {}
    try:
        with open(_STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _save_state(initial_done: bool) -> None:
    try:
        with open(_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump({"initial_sync_done": initial_done}, f)
    except OSError:
        pass


def _run_loop() -> None:
    if not os.path.isfile(_CLIENT_CONFIG):
        raise SystemExit(f"missing config: {_CLIENT_CONFIG}")
    cfg = load_json_config(_CLIENT_CONFIG)
    host = str(cfg.get("server_host", "api.si.12gm.com"))
    port = int(cfg.get("server_port", 18765))
    local_raw = cfg.get("local_dir", "../../")
    root = resolve_path_against(_SCRIPT_DIR, str(local_raw))
    root = os.path.abspath(root) if root else ""
    if bool(cfg.get("print_paths_only", False)):
        print(f"client_config={os.path.abspath(_CLIENT_CONFIG)}", flush=True)
        print(f"script_dir={os.path.abspath(_SCRIPT_DIR)}", flush=True)
        print(f"local_sync_root={root}", flush=True)
        print(f"server_target={host}:{port}", flush=True)
        raise SystemExit(0)
    pair = str(cfg.get("pair_code", ""))
    if not pair or pair == "SET_PAIR_CODE":
        raise SystemExit("edit client_config.json: set pair_code (must match server)")
    if not root:
        raise SystemExit("edit client_config.json: set local_dir")
    if not os.path.isdir(root):
        raise SystemExit(f"not a directory: {root}")
    extra = cfg.get("exclude") or []
    if not isinstance(extra, list):
        extra = []
    ex = tuple(_DEFAULT_EXCLUDES) + tuple(str(x) for x in extra)
    interval = float(cfg.get("interval_seconds", 2.0))
    use_watch = bool(cfg.get("use_watch", True))
    debounce = float(cfg.get("watch_debounce_seconds", 0.35))

    state = _load_state()
    was_initial_done = bool(state.get("initial_sync_done"))

    snap: dict[str, tuple[float, int]] = _scan_local(root, ex)

    def do_sync(s: dict[str, tuple[float, int]], label: str) -> None:
        try:
            _run_one_sync(host, port, pair, root, s)
            print(f"ok {label}", flush=True)
        except (OSError, RuntimeError, ValueError) as e:
            print(f"sync failed ({label}): {e}", flush=True)

    skip_first_poll = False
    if not was_initial_done:
        print("initial full sync (entire tree)", flush=True)
        try:
            _run_one_sync(host, port, pair, root, snap)
            _save_state(True)
            print("initial sync done; switching to incremental", flush=True)
            skip_first_poll = True
        except (OSError, RuntimeError, ValueError) as e:
            print(f"initial sync failed: {e}", flush=True)
            raise SystemExit(1)
    elif use_watch and _HAS_WATCHDOG:
        do_sync(snap, "startup_reconcile")

    if use_watch and _HAS_WATCHDOG:
        sync_lock = threading.Lock()

        def on_flush(snap_copy: dict[str, tuple[float, int]]) -> None:
            with sync_lock:
                do_sync(snap_copy, "watch")

        handler = _WatchHandler(root, ex, snap, debounce, on_flush)
        observer = Observer()
        observer.schedule(handler, root, recursive=True)
        observer.start()
        print(f"watch mode on {root} (debounce {debounce}s)", flush=True)
        try:
            while True:
                time.sleep(3600.0)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()
        return

    if use_watch and not _HAS_WATCHDOG:
        print("watchdog not installed; pip install watchdog  OR  set use_watch false", flush=True)

    while True:
        if skip_first_poll:
            skip_first_poll = False
        else:
            try:
                snap.clear()
                snap.update(_scan_local(root, ex))
                do_sync(snap, "poll")
            except (OSError, RuntimeError, ValueError) as e:
                print(f"sync round failed: {e}", flush=True)
        time.sleep(interval)


def main() -> None:
    _run_loop()


if __name__ == "__main__":
    main()
