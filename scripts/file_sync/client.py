# Pair-code sync client: first run full tree sync; then filesystem watch + debounced incremental updates.

from __future__ import annotations

import fnmatch
import json
import os
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Iterable

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from pycore.pyfoundations.service_contract import host as contract_host, port as contract_port, service_domain
from protocol import load_json_config, read_json_frame, resolve_path_against, write_json_frame

_DEFAULT_SERVER_HOST = service_domain("laravel_api")
_DEFAULT_SERVER_PORT = contract_port("file_sync")

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

_DEFAULT_EXCLUDES = (
    # --- git ---
    ".git",
    ".gitignore",
    ".gitmodules",
    # --- node / js / ts ---
    "node_modules",
    ".npm",
    ".yarn",
    ".pnp.*",
    "bower_components",
    ".next",
    ".nuxt",
    ".output",
    ".cache",
    "dist",
    "build",
    ".parcel-cache",
    ".turbo",
    # --- python ---
    "__pycache__",
    ".venv",
    "venv",
    "env",
    ".eggs",
    "*.egg-info",
    "*.pyc",
    "*.pyo",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    # --- flutter / dart ---
    ".dart_tool",
    ".flutter-plugins",
    ".flutter-plugins-dependencies",
    ".pub-cache",
    ".packages",
    "build",
    # --- vite / frontend build ---
    ".vite",
    # --- rust ---
    "target",
    # --- go ---
    "vendor",
    # --- java / kotlin ---
    ".gradle",
    ".m2",
    # --- IDE / editor ---
    ".idea",
    ".vs",
    ".vscode",
    "*.swp",
    "*.swo",
    # --- OS junk ---
    "Thumbs.db",
    ".DS_Store",
    "desktop.ini",
    # --- misc temp / generated ---
    "*.module",
    "*.log",
    "coverage",
    ".nyc_output",
    "tmp",
    ".tmp",
    ".temp",
    # --- C/C++ headers & build artifacts ---
    "*.hpp",
    "*.hxx",
    "*.ipp",
    # --- compiled / binary ---
    "*.o",
    "*.obj",
    "*.a",
    "*.lib",
    "*.so",
    "*.dylib",
    "*.dll",
    "*.exe",
    "*.bin",
    "*.class",
    "*.jar",
    "*.war",
    "*.ear",
    "*.dex",
    "*.ko",
    "*.elf",
    "*.pdb",
    # --- archives ---
    "*.zip",
    "*.tar",
    "*.tar.gz",
    "*.tgz",
    "*.tar.bz2",
    "*.tar.xz",
    "*.rar",
    "*.7z",
    "*.gz",
    "*.bz2",
    "*.xz",
    "*.zst",
    # --- images ---
    # --- video ---
    "*.mp4",
    "*.avi",
    "*.mkv",
    "*.mov",
    "*.wmv",
    "*.flv",
    "*.webm",
    "*.m4v",
    # --- audio ---
    "*.mp3",
    "*.wav",
    "*.flac",
    "*.aac",
    "*.ogg",
    "*.wma",
    "*.m4a",
    # --- fonts ---
    # --- database / data ---
    "*.sqlite",
    "*.sqlite3",
    "*.db",
    "*.mdb",
    "*.ldb",
    # --- documents ---
    # --- package lock files ---
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Pipfile.lock",
    "Cargo.lock",
    "composer.lock",
    "Gemfile.lock",
    # --- C/C++ source (third-party SDK) ---
    "*.cxx",
    "*.proto",
    "*.expected",
    # --- .NET / C# build ---
    "*.nupkg",
    # --- misc binary / temp ---
    "*.wasm",
    "*.pak",
    "*.dat",
    "*.cache",
    "*.pid",
    "*.seed",
    "*.tmp",
    "*.bak",
    "*.orig",
    "*.rej",
    "*.gpg",
    # --- misc config that appears everywhere ---
    ".editorconfig",
    ".eslintcache",
    # --- SDK / third-party large dirs ---
    "SDK",
    "sdk",
    "third_party",
    "3rdparty",
    "bin",
    "obj",
    "out",
    "release",
    "debug",
    "Release",
    "Debug",
    ".pub",
    "Pods",
    ".symlinks",
)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_CLIENT_CONFIG = os.path.join(_SCRIPT_DIR, "client_config.json")
_STATE_FILE = os.path.join(_SCRIPT_DIR, ".sync_client_state.json")


def _excluded(rel_unix: str, patterns: Iterable[str]) -> bool:
    rel = rel_unix.replace("\\", "/")
    parts = rel.split("/")
    name = parts[-1] if parts else ""
    for pat in patterns:
        # match filename or full relative path
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel, pat):
            return True
        # match any single path segment
        for part in parts:
            if fnmatch.fnmatch(part, pat):
                return True
        # match path prefix (e.g. "pyapps/d3-check" matches "pyapps/d3-check/foo/bar.py")
        if "/" in pat:
            pat_normalized = pat.replace("\\", "/").strip("/")
            if rel == pat_normalized or rel.startswith(pat_normalized + "/"):
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
        on_flush: Callable[[list[str], list[str]], None],
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
            rels = self._pending.copy()
            self._pending.clear()
            self._timer = None
        if not rels:
            return
        changed: list[str] = []
        deleted: list[str] = []
        with self._lock:
            for rel in sorted(rels):
                rel = rel.replace("\\", "/").strip("/")
                abs_p = os.path.join(self.root, rel.replace("/", os.sep))
                if os.path.isfile(abs_p) and not _excluded(rel, self.excludes):
                    try:
                        st = os.stat(abs_p)
                        old = self.snap.get(rel)
                        if old is None or old[0] != st.st_mtime or old[1] != st.st_size:
                            self.snap[rel] = (st.st_mtime, st.st_size)
                            changed.append(rel)
                    except OSError:
                        pass
                elif not os.path.exists(abs_p):
                    if rel in self.snap:
                        del self.snap[rel]
                        deleted.append(rel)
                    # also clean entries under this prefix (directory deleted)
                    prefix = rel + "/"
                    for k in list(self.snap.keys()):
                        if k.startswith(prefix):
                            del self.snap[k]
                            deleted.append(k)
                elif os.path.isdir(abs_p):
                    # directory changed — scan for new/modified files in it
                    sub = _scan_subtree(self.root, rel, self.excludes)
                    for sr, (mt, sz) in sub.items():
                        old = self.snap.get(sr)
                        if old is None or old[0] != mt or old[1] != sz:
                            self.snap[sr] = (mt, sz)
                            changed.append(sr)
        if changed or deleted:
            self.on_flush(changed, deleted)

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


def _connect(host: str, port: int, connect_timeout: float = 15.0) -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    s.settimeout(connect_timeout)
    print(f"connecting to {host}:{port} ...", flush=True)
    s.connect((host, port))
    print(f"connected to {host}:{port}", flush=True)
    s.settimeout(3600.0)
    return s


def _auth(sock: socket.socket, pair: str) -> None:
    print("authenticating ...", flush=True)
    write_json_frame(sock, {"cmd": "auth", "pair": pair})
    r = read_json_frame(sock)
    if r.get("cmd") != "auth_ok":
        raise RuntimeError(f"auth failed: {r}")
    print("auth ok", flush=True)


def _try_pair_handshake(host: str, port: int, code: str) -> tuple[str, str]:
    sock: socket.socket | None = None
    try:
        sock = _connect(host, port)
        write_json_frame(sock, {"cmd": "auth", "pair": code})
        r = read_json_frame(sock)
    except (ConnectionError, OSError) as e:
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass
        return "net", str(e)
    except (ValueError, json.JSONDecodeError) as e:
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass
        return "proto", str(e)
    else:
        try:
            sock.close()
        except OSError:
            pass

    if r.get("cmd") == "auth_ok":
        return "ok", ""
    if r.get("cmd") == "auth_fail":
        return "auth_fail", str(r.get("reason", "pair mismatch"))
    return "proto", repr(r)


def _interactive_acquire_pair(host: str, port: int) -> str:
    label = f"{host}:{port}"
    wrong_pair = 0
    while wrong_pair < 2:
        raw = input(f"配对码 [{label}]（服务端控制台上的两位数字）: ").strip()
        if len(raw) != 2 or not raw.isdigit():
            print("请输入两位数字（00–99）。", flush=True)
            continue
        kind, detail = _try_pair_handshake(host, port, raw)
        if kind == "ok":
            print(f"已与 {label} 配对成功。", flush=True)
            return raw
        if kind == "net":
            print(f"无法连接: {detail}", flush=True)
            print("请确认服务端已启动后再输入配对码。", flush=True)
            continue
        if kind == "proto":
            print(f"协议错误: {detail}", flush=True)
            wrong_pair += 1
            continue
        wrong_pair += 1
        print(f"配对码错误: {detail}", flush=True)
    raise SystemExit(
        "已连续两次输入错误配对码。服务端可能已自动退出，请重启服务端后重新运行本客户端。"
    )


def _fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f}KB"
    return f"{n / 1024 / 1024:.1f}MB"


def _push_file(sock: socket.socket, root: str, rel_unix: str, mtime: float) -> int:
    """Send file frame + payload, no ACK expected. Returns bytes sent."""
    dst = os.path.join(root, rel_unix.replace("/", os.sep))
    with open(dst, "rb") as f:
        data = f.read()
    write_json_frame(
        sock,
        {"cmd": "file", "path": rel_unix, "size": len(data), "mtime": mtime},
    )
    if data:
        sock.sendall(data)
    return len(data)


def _manifest_round(
    sock: socket.socket,
    local_root: str,
    snap: dict[str, tuple[float, int]],
) -> None:
    files_payload: dict[str, dict[str, float | int]] = {}
    for rel, (mt, sz) in snap.items():
        files_payload[rel] = {"mtime": mt, "size": sz}
    print(f"sending manifest ({len(files_payload)} files) ...", flush=True)
    write_json_frame(sock, {"cmd": "manifest", "files": files_payload})
    plan = read_json_frame(sock)
    if plan.get("cmd") != "sync_plan":
        raise RuntimeError(f"unexpected response: {plan}")
    up = plan.get("upload") or []
    if not isinstance(up, list):
        raise RuntimeError("sync_plan.upload must be list")
    total_up = len(up)
    if total_up == 0:
        print("nothing to upload, all up-to-date", flush=True)
        write_json_frame(sock, {"cmd": "bye"})
        _ = read_json_frame(sock)
        return

    total_bytes = 0
    t_start = time.time()
    last_report = t_start
    print(f"uploading {total_up} file(s) (no-ack pipeline) ...", flush=True)
    for i, rel in enumerate(up, 1):
        rel_s = str(rel).replace("\\", "/")
        if rel_s not in snap:
            raise RuntimeError(f"server asked unknown path: {rel_s}")
        mt = snap[rel_s][0]
        sz = _push_file(sock, local_root, rel_s, mt)
        total_bytes += sz
        now = time.time()
        if now - last_report >= 2.0 or i == total_up or i == 1:
            elapsed = now - t_start
            pct = i * 100 // total_up
            rate = total_bytes / elapsed if elapsed > 0 else 0
            abs_p = os.path.join(local_root, rel_s.replace("/", os.sep))
            print(
                f"  [{i}/{total_up}] {pct}%  {_fmt_size(total_bytes)} sent  {_fmt_size(int(rate))}/s  {abs_p}",
                flush=True,
            )
            last_report = now

    # all files pushed — send bye and wait for server summary
    write_json_frame(sock, {"cmd": "bye"})
    print("all files sent, waiting for server confirmation ...", flush=True)
    result = read_json_frame(sock)
    elapsed = time.time() - t_start
    if result.get("cmd") == "sync_done":
        srv_count = result.get("received", 0)
        srv_bytes = result.get("bytes", 0)
        srv_errors = result.get("errors", [])
        print(
            f"server confirmed: {srv_count} files, {_fmt_size(srv_bytes)}, {elapsed:.1f}s",
            flush=True,
        )
        if srv_errors:
            print(f"  server errors ({len(srv_errors)}): {srv_errors[:5]}", flush=True)
    elif result.get("cmd") == "error":
        raise RuntimeError(f"server error: {result.get('err')}")
    else:
        print(f"upload done: {total_up} files, {_fmt_size(total_bytes)}, {elapsed:.1f}s", flush=True)


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


def _run_incremental_push(
    host: str,
    port: int,
    pair: str,
    root: str,
    changed: list[str],
    deleted: list[str],
    snap: dict[str, tuple[float, int]],
) -> None:
    """Push only changed/deleted files to server — no manifest, no comparison."""
    sock = _connect(host, port)
    try:
        _auth(sock, pair)
        write_json_frame(sock, {"cmd": "push", "deleted": deleted})
        total_bytes = 0
        t_start = time.time()
        sent = 0
        for rel in changed:
            if rel not in snap:
                continue
            mt = snap[rel][0]
            abs_p = os.path.join(root, rel.replace("/", os.sep))
            sz = _push_file(sock, root, rel, mt)
            total_bytes += sz
            sent += 1
            print(f"  >> {abs_p} ({_fmt_size(sz)})", flush=True)
        write_json_frame(sock, {"cmd": "bye"})
        result = read_json_frame(sock)
        elapsed = time.time() - t_start
        if result.get("cmd") == "sync_done":
            srv_errors = result.get("errors", [])
            detail = f"{sent} pushed, {len(deleted)} deleted, {_fmt_size(total_bytes)}, {elapsed:.1f}s"
            if srv_errors:
                detail += f", {len(srv_errors)} error(s)"
            print(f"  push ok: {detail}", flush=True)
        elif result.get("cmd") == "error":
            print(f"  push error: {result.get('err')}", flush=True)
        else:
            print(f"  push done: {sent} files, {_fmt_size(total_bytes)}, {elapsed:.1f}s", flush=True)
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
    host_key = str(cfg.get("server_host_key", "")).strip()
    port_key = str(cfg.get("server_port_key", "")).strip()
    host = str(cfg.get("server_host") or (contract_host(host_key) if host_key else _DEFAULT_SERVER_HOST))
    port = int(cfg.get("server_port") or (contract_port(port_key) if port_key else _DEFAULT_SERVER_PORT))
    local_raw = cfg.get("local_dir", "../../")
    root = resolve_path_against(_SCRIPT_DIR, str(local_raw))
    root = os.path.abspath(root) if root else ""
    if bool(cfg.get("print_paths_only", False)):
        print(f"client_config={os.path.abspath(_CLIENT_CONFIG)}", flush=True)
        print(f"script_dir={os.path.abspath(_SCRIPT_DIR)}", flush=True)
        print(f"local_sync_root={root}", flush=True)
        print(f"server_target={host}:{port}", flush=True)
        raise SystemExit(0)
    if not root:
        raise SystemExit("edit client_config.json: set local_dir")
    if not os.path.isdir(root):
        raise SystemExit(f"not a directory: {root}")
    if not sys.stdin.isatty():
        raise SystemExit("需要在终端中交互输入配对码（stdin 不是 tty）。")
    pair = _interactive_acquire_pair(host, port)
    extra = cfg.get("exclude") or []
    if not isinstance(extra, list):
        extra = []
    ex = tuple(_DEFAULT_EXCLUDES) + tuple(str(x) for x in extra)
    interval = float(cfg.get("interval_seconds", 2.0))
    use_watch = bool(cfg.get("use_watch", True))
    debounce = float(cfg.get("watch_debounce_seconds", 0.35))

    state = _load_state()
    was_initial_done = bool(state.get("initial_sync_done"))

    print(f"config: root={root}  server={host}:{port}  excludes={len(ex)}", flush=True)
    print("scanning local files ...", flush=True)
    t0 = time.time()
    snap: dict[str, tuple[float, int]] = _scan_local(root, ex)
    total_size = sum(sz for _, sz in snap.values())
    print(
        f"scan done: {len(snap)} files, {_fmt_size(total_size)} total ({time.time() - t0:.1f}s)",
        flush=True,
    )

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

        def on_flush(changed: list[str], deleted: list[str]) -> None:
            with sync_lock:
                ts = time.strftime("%H:%M:%S")
                print(f"[{ts}] watch: {len(changed)} changed, {len(deleted)} deleted", flush=True)
                for rel in changed:
                    print(f"  + {os.path.join(root, rel.replace('/', os.sep))}", flush=True)
                for rel in deleted:
                    print(f"  - {os.path.join(root, rel.replace('/', os.sep))}", flush=True)
                try:
                    _run_incremental_push(host, port, pair, root, changed, deleted, snap)
                except (OSError, RuntimeError, ValueError) as e:
                    print(f"  push failed: {e}", flush=True)

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
