# Pair-code sync client: first run full tree sync; then filesystem watch + debounced incremental updates.
# Single-file: inlined protocol + pip/ensurepip + auto pip-install missing third-party (watchdog).
# v2: persistent connections, batch_files, TCP_NODELAY, parallel targets, scandir, snap hash skip.

from __future__ import annotations

import fnmatch
import hashlib
import importlib
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Iterable

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)


def _pip_bootstrap() -> None:
    if os.environ.get("FILE_SYNC_V2_NO_AUTO_PIP", "").lower() in ("1", "true", "yes"):
        return
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "--version"],
            check=True,
            timeout=30,
            capture_output=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        try:
            subprocess.run(
                [sys.executable, "-m", "ensurepip", "--upgrade"],
                check=False,
                timeout=120,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except OSError:
            pass
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "--upgrade", "pip"],
            check=False,
            timeout=300,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.TimeoutExpired, OSError):
        pass


_pip_bootstrap()


def _ensure_pip_package(import_name: str, pip_name: str | None = None) -> bool:
    pip_name = pip_name or import_name
    try:
        importlib.import_module(import_name)
        return True
    except ImportError:
        pass
    if os.environ.get("FILE_SYNC_V2_NO_AUTO_DEPS", "").lower() in ("1", "true", "yes"):
        return False
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", pip_name],
            check=False,
            timeout=300,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.TimeoutExpired):
        pass
    importlib.invalidate_caches()
    try:
        importlib.import_module(import_name)
        return True
    except ImportError:
        return False


# --- inlined protocol (framing + path helpers) ---
_JSON_LEN = struct.Struct("!I")


def recv_exact(sock, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("peer closed")
        buf += chunk
    return bytes(buf)


def read_json_frame(sock) -> dict[str, Any]:
    raw_len = recv_exact(sock, _JSON_LEN.size)
    (ln,) = _JSON_LEN.unpack(raw_len)
    if ln > 256 * 1024 * 1024:
        raise ValueError("json frame too large")
    data = recv_exact(sock, ln)
    return json.loads(data.decode("utf-8"))


def read_file_payload(sock, size: int) -> bytes:
    if size < 0 or size > 512 * 1024 * 1024:
        raise ValueError("bad file size")
    return recv_exact(sock, size)


def write_json_frame(sock, obj: dict[str, Any]) -> None:
    b = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    sock.sendall(_JSON_LEN.pack(len(b)) + b)


def safe_rel(rel: str) -> str:
    rel = rel.replace("\\", "/").strip("/")
    parts: list[str] = []
    for p in rel.split("/"):
        if p in ("", "."):
            continue
        if p == "..":
            raise ValueError("path traversal")
        parts.append(p)
    return "/".join(parts)


def to_os_path(root: str, rel_unix: str) -> str:
    rel = rel_unix.replace("/", os.sep)
    return os.path.normpath(os.path.join(root, rel))


def load_json_config(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve_path_against(base_dir: str, p: str) -> str:
    p = os.path.expanduser((p or "").strip())
    if not p:
        return ""
    if os.path.isabs(p):
        return os.path.normpath(p)
    return os.path.normpath(os.path.join(base_dir, p))


_HAS_WATCHDOG = False
if _ensure_pip_package("watchdog"):
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    _HAS_WATCHDOG = True
else:
    class FileSystemEventHandler:  # type: ignore[no-redef]
        pass

    class Observer:  # type: ignore[no-redef]
        pass

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

_CLIENT_CONFIG = os.path.join(_SCRIPT_DIR, "client_config.json")
_STATE_FILE = os.path.join(_SCRIPT_DIR, ".sync_client_state.json")


def _target_key(host: str, port: int) -> str:
    return f"{host}:{port}"


def _parse_pattern_list(value: object, field: str) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        raise SystemExit(f"client_config.json: {field} must be array of strings")
    out: list[str] = []
    for j, item in enumerate(value):
        if not isinstance(item, str):
            raise SystemExit(f"client_config.json: {field}[{j}] must be string")
        s = item.strip()
        if not s:
            raise SystemExit(f"client_config.json: {field}[{j}] must not be empty")
        out.append(s)
    return tuple(out)


def _parse_targets(cfg: dict) -> list[dict[str, str | int | bool | tuple[str, ...]]]:
    default_include = _parse_pattern_list(cfg.get("include", []), "include")
    default_exclude = _parse_pattern_list(cfg.get("exclude", []), "exclude")
    raw_servers = cfg.get("servers")

    targets: list[dict[str, str | int | bool | tuple[str, ...]]] = []
    if isinstance(raw_servers, list):
        if not raw_servers:
            raise SystemExit("client_config.json: servers must not be empty")
        for i, raw in enumerate(raw_servers):
            if not isinstance(raw, dict):
                raise SystemExit(f"client_config.json: servers[{i}] must be object")
            host = str(raw.get("host", raw.get("server_host", ""))).strip()
            if not host:
                raise SystemExit(f"client_config.json: servers[{i}].host required")
            try:
                port = int(raw.get("port", raw.get("server_port", 18765)))
            except (TypeError, ValueError):
                raise SystemExit(f"client_config.json: servers[{i}].port must be integer")
            enabled = raw.get("enabled", True)
            if not isinstance(enabled, bool):
                raise SystemExit(f"client_config.json: servers[{i}].enabled must be boolean")
            include = (
                _parse_pattern_list(raw.get("include"), f"servers[{i}].include")
                if "include" in raw
                else default_include
            )
            exclude = (
                _parse_pattern_list(raw.get("exclude"), f"servers[{i}].exclude")
                if "exclude" in raw
                else default_exclude
            )
            targets.append(
                {
                    "host": host,
                    "port": port,
                    "pair": "",
                    "enabled": enabled,
                    "include": include,
                    "exclude": exclude,
                    "key": _target_key(host, port),
                }
            )
        return targets

    host = str(cfg.get("server_host", "api.si.12gm.com")).strip()
    try:
        port = int(cfg.get("server_port", 18765))
    except (TypeError, ValueError):
        raise SystemExit("client_config.json: server_port must be integer")
    return [
        {
            "host": host,
            "port": port,
            "pair": "",
            "enabled": True,
            "include": default_include,
            "exclude": default_exclude,
            "key": _target_key(host, port),
        }
    ]


def _try_pair_handshake(host: str, port: int, code: str) -> tuple[str, str]:
    """Returns (kind, detail). kind is ok | auth_fail | net | proto."""
    sock: socket.socket | None = None
    try:
        sock = _connect(host, port)
        write_json_frame(sock, {"cmd": "auth", "pair": code})
        r = read_json_frame(sock)
        if r.get("cmd") == "auth_fail":
            return "auth_fail", str(r.get("reason", "pair mismatch"))
        if r.get("cmd") != "auth_ok":
            return "proto", repr(r)
        write_json_frame(sock, {"cmd": "pair_check_end"})
        ack = read_json_frame(sock)
        if ack.get("cmd") != "pair_check_ack":
            return "proto", f"expected pair_check_ack, got {ack!r}"
        return "ok", ""
    except (ConnectionError, OSError) as e:
        return "net", str(e)
    except (ValueError, json.JSONDecodeError) as e:
        return "proto", str(e)
    finally:
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                sock.close()
            except OSError:
                pass


def _interactive_acquire_pairs(enabled_targets: list[dict[str, str | int | bool | tuple[str, ...]]]) -> None:
    for t in enabled_targets:
        label = f"{t['host']}:{t['port']}"
        wrong_pair = 0
        while wrong_pair < 2:
            raw = input(f"Pair code [{label}] (two digits from server console): ").strip()
            if len(raw) != 2 or not raw.isdigit():
                print("Enter two digits (00-99).", flush=True)
                continue
            kind, detail = _try_pair_handshake(str(t["host"]), int(t["port"]), raw)
            if kind == "ok":
                t["pair"] = raw
                print(f"Paired successfully with {label}.", flush=True)
                break
            if kind == "net":
                print(f"Cannot connect: {detail}", flush=True)
                print("Ensure the server is running, then enter the pair code again.", flush=True)
                continue
            if kind == "proto":
                print(f"Protocol error: {detail}", flush=True)
                wrong_pair += 1
                continue
            wrong_pair += 1
            print(f"Wrong pair code: {detail}", flush=True)
        else:
            raise SystemExit(
                "Wrong pair code twice in a row. The server may have exited; "
                "restart the server and run this client again."
            )


def _target_initial_done(state: dict, key: str, single_target: bool) -> bool:
    by_target = state.get("initial_sync_done_by_target")
    if isinstance(by_target, dict):
        return bool(by_target.get(key, False))
    if single_target:
        return bool(state.get("initial_sync_done", False))
    return False


def _mark_target_initial_done(state: dict, key: str) -> None:
    by_target = state.get("initial_sync_done_by_target")
    if not isinstance(by_target, dict):
        by_target = {}
    by_target[key] = True
    state["initial_sync_done_by_target"] = by_target
    if len(by_target) == 1:
        state["initial_sync_done"] = True


def _mark_target_requires_initial_sync(state: dict, key: str) -> None:
    by_target = state.get("initial_sync_done_by_target")
    if not isinstance(by_target, dict):
        by_target = {}
    by_target[key] = False
    state["initial_sync_done_by_target"] = by_target
    state["initial_sync_done"] = False


def _matches_any_pattern(rel_unix: str, patterns: Iterable[str]) -> bool:
    rel = rel_unix.replace("\\", "/")
    parts = rel.split("/")
    name = parts[-1] if parts else ""
    for pat in patterns:
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel, pat):
            return True
        for part in parts:
            if fnmatch.fnmatch(part, pat):
                return True
        if "/" in pat:
            pat_normalized = pat.replace("\\", "/").strip("/")
            if rel == pat_normalized or rel.startswith(pat_normalized + "/"):
                return True
    return False


def _excluded(rel_unix: str, patterns: Iterable[str]) -> bool:
    return _matches_any_pattern(rel_unix, patterns)


def _target_path_allowed(
    rel_unix: str,
    include_patterns: Iterable[str],
    exclude_patterns: Iterable[str],
) -> bool:
    include = tuple(include_patterns)
    exclude = tuple(exclude_patterns)
    if include and not _matches_any_pattern(rel_unix, include):
        return False
    if exclude and _matches_any_pattern(rel_unix, exclude):
        return False
    return True


def _target_patterns(target: dict[str, object]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    include_raw = target.get("include")
    exclude_raw = target.get("exclude")
    include = include_raw if isinstance(include_raw, tuple) else ()
    exclude = exclude_raw if isinstance(exclude_raw, tuple) else ()
    return include, exclude


def _filter_snapshot_for_target(
    snap: dict[str, tuple[float, int]],
    target: dict[str, object],
) -> dict[str, tuple[float, int]]:
    include, exclude = _target_patterns(target)
    if not include and not exclude:
        return snap
    out: dict[str, tuple[float, int]] = {}
    for rel, meta in snap.items():
        if _target_path_allowed(rel, include, exclude):
            out[rel] = meta
    return out


def _filter_paths_for_target(paths: list[str], target: dict[str, object]) -> list[str]:
    include, exclude = _target_patterns(target)
    if not include and not exclude:
        return paths
    out: list[str] = []
    for rel in paths:
        if _target_path_allowed(rel, include, exclude):
            out.append(rel)
    return out


def _remove_prefix(snap: dict[str, tuple[float, int]], rel: str) -> None:
    rel = rel.replace("\\", "/").strip("/")
    for k in list(snap.keys()):
        if k == rel or k.startswith(rel + "/"):
            del snap[k]


# ---------------------------------------------------------------------------
# File scanning — uses os.scandir for better perf (Windows caches stat info)
# ---------------------------------------------------------------------------

def _scandir_recurse(
    base_dir: str,
    rel_prefix: str,
    excludes: tuple[str, ...],
    out: dict[str, tuple[float, int]],
) -> None:
    try:
        it = os.scandir(base_dir)
    except OSError:
        return
    with it:
        for entry in it:
            rel = f"{rel_prefix}/{entry.name}" if rel_prefix else entry.name
            try:
                if entry.is_dir(follow_symlinks=False):
                    if not _excluded(rel, excludes):
                        _scandir_recurse(entry.path, rel, excludes, out)
                elif entry.is_file(follow_symlinks=False):
                    if not _excluded(rel, excludes):
                        st = entry.stat(follow_symlinks=False)
                        out[rel] = (st.st_mtime, st.st_size)
            except OSError:
                pass


def _scan_local(root: str, excludes: tuple[str, ...]) -> dict[str, tuple[float, int]]:
    root = os.path.abspath(root)
    out: dict[str, tuple[float, int]] = {}
    _scandir_recurse(root, "", excludes, out)
    return out


def _scan_subtree(root: str, base_rel: str, excludes: tuple[str, ...]) -> dict[str, tuple[float, int]]:
    root = os.path.abspath(root)
    base = os.path.join(root, base_rel.replace("/", os.sep))
    if not os.path.isdir(base):
        return {}
    out: dict[str, tuple[float, int]] = {}
    _scandir_recurse(base, base_rel, excludes, out)
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


# ---------------------------------------------------------------------------
# Snapshot hashing (P2 — skip network sync when nothing changed)
# ---------------------------------------------------------------------------

def _snap_hash(snap: dict[str, tuple[float, int]]) -> str:
    if not snap:
        return ""
    h = hashlib.md5()
    for k in sorted(snap):
        mt, sz = snap[k]
        h.update(f"{k}\0{mt}\0{sz}\n".encode())
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Watch handler
# ---------------------------------------------------------------------------

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
                    prefix = rel + "/"
                    for k in list(self.snap.keys()):
                        if k.startswith(prefix):
                            del self.snap[k]
                            deleted.append(k)
                elif os.path.isdir(abs_p):
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


# ---------------------------------------------------------------------------
# Networking — connect / auth / persistent connection
# ---------------------------------------------------------------------------

def _connect(host: str, port: int, connect_timeout: float = 15.0) -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
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


class _PersistentConn:
    """Manages a persistent TCP session to one server target."""

    def __init__(self, host: str, port: int, pair: str) -> None:
        self.host = host
        self.port = port
        self.pair = pair
        self._sock: socket.socket | None = None
        self._lock = threading.Lock()

    def ensure_connected(self) -> socket.socket:
        with self._lock:
            if self._sock is not None:
                return self._sock
            self._sock = _connect(self.host, self.port)
            _auth(self._sock, self.pair)
            return self._sock

    def invalidate(self) -> None:
        with self._lock:
            if self._sock is not None:
                try:
                    self._sock.close()
                except OSError:
                    pass
                self._sock = None

    def close_session(self) -> None:
        with self._lock:
            if self._sock is not None:
                try:
                    write_json_frame(self._sock, {"cmd": "session_bye"})
                    self._sock.settimeout(3.0)
                    try:
                        read_json_frame(self._sock)
                    except Exception:
                        pass
                except OSError:
                    pass
                try:
                    self._sock.close()
                except OSError:
                    pass
                self._sock = None


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def _fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f}KB"
    return f"{n / 1024 / 1024:.1f}MB"


# ---------------------------------------------------------------------------
# File pushing — with batching for small files (P2)
# ---------------------------------------------------------------------------

_BATCH_FILE_THRESHOLD = 64 * 1024   # individual file smaller than this → batch
_BATCH_TOTAL_LIMIT = 256 * 1024     # flush batch when accumulated payload exceeds this


def _push_file(sock: socket.socket, root: str, rel_unix: str, mtime: float) -> int:
    """Send one file frame + payload. Returns bytes sent."""
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


def _push_files_batched(
    sock: socket.socket,
    root: str,
    files: list[str],
    snap: dict[str, tuple[float, int]],
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> tuple[int, int]:
    """Push files with batching for small files. Returns (count, bytes)."""
    batch_meta: list[dict[str, Any]] = []
    batch_data = bytearray()
    total_sent = 0
    total_bytes = 0

    def _flush_batch() -> None:
        nonlocal total_sent, total_bytes
        if not batch_meta:
            return
        write_json_frame(sock, {
            "cmd": "batch_files",
            "files": batch_meta,
            "total_size": len(batch_data),
        })
        if batch_data:
            sock.sendall(bytes(batch_data))
        total_sent += len(batch_meta)
        total_bytes += len(batch_data)
        batch_meta.clear()
        batch_data.clear()

    for rel in files:
        if rel not in snap:
            continue
        mt = snap[rel][0]
        abs_p = os.path.join(root, rel.replace("/", os.sep))
        try:
            with open(abs_p, "rb") as f:
                data = f.read()
        except OSError:
            continue
        size = len(data)

        if size <= _BATCH_FILE_THRESHOLD:
            batch_meta.append({"path": rel, "size": size, "mtime": mt})
            batch_data.extend(data)
            if len(batch_data) >= _BATCH_TOTAL_LIMIT:
                _flush_batch()
                if progress_cb:
                    progress_cb(total_sent, total_bytes, "")
        else:
            _flush_batch()
            write_json_frame(sock, {"cmd": "file", "path": rel, "size": size, "mtime": mt})
            if data:
                sock.sendall(data)
            total_sent += 1
            total_bytes += size
            if progress_cb:
                progress_cb(total_sent, total_bytes, abs_p)

    _flush_batch()
    return total_sent, total_bytes


# ---------------------------------------------------------------------------
# Sync rounds — manifest & incremental push
# ---------------------------------------------------------------------------

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

    t_start = time.time()
    last_report = t_start
    print(f"uploading {total_up} file(s) (batched pipeline) ...", flush=True)

    def _progress(sent: int, nbytes: int, path: str) -> None:
        nonlocal last_report
        now = time.time()
        if now - last_report >= 2.0 or sent == total_up or sent == 1:
            elapsed = now - t_start
            pct = sent * 100 // total_up if total_up else 100
            rate = nbytes / elapsed if elapsed > 0 else 0
            print(
                f"  [{sent}/{total_up}] {pct}%  {_fmt_size(nbytes)} sent  {_fmt_size(int(rate))}/s"
                + (f"  {path}" if path else ""),
                flush=True,
            )
            last_report = now

    # validate all paths exist in snap
    upload_list: list[str] = []
    for rel in up:
        rel_s = str(rel).replace("\\", "/")
        if rel_s not in snap:
            raise RuntimeError(f"server asked unknown path: {rel_s}")
        upload_list.append(rel_s)

    total_sent, total_bytes = _push_files_batched(sock, local_root, upload_list, snap, _progress)

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
        print(f"upload done: {total_sent} files, {_fmt_size(total_bytes)}, {elapsed:.1f}s", flush=True)


def _run_one_sync(
    conn: _PersistentConn,
    root: str,
    snap: dict[str, tuple[float, int]],
) -> None:
    """Full manifest sync using persistent connection."""
    sock = conn.ensure_connected()
    try:
        _manifest_round(sock, root, snap)
    except Exception:
        conn.invalidate()
        raise


def _run_incremental_push(
    conn: _PersistentConn,
    root: str,
    changed: list[str],
    deleted: list[str],
    snap: dict[str, tuple[float, int]],
) -> None:
    """Push only changed/deleted files using persistent connection."""
    sock = conn.ensure_connected()
    try:
        write_json_frame(sock, {"cmd": "push", "deleted": deleted})
        t_start = time.time()
        total_sent, total_bytes = _push_files_batched(sock, root, changed, snap)
        write_json_frame(sock, {"cmd": "bye"})
        result = read_json_frame(sock)
        elapsed = time.time() - t_start
        if result.get("cmd") == "sync_done":
            srv_errors = result.get("errors", [])
            detail = f"{total_sent} pushed, {len(deleted)} deleted, {_fmt_size(total_bytes)}, {elapsed:.1f}s"
            if srv_errors:
                detail += f", {len(srv_errors)} error(s)"
            print(f"  push ok: {detail}", flush=True)
        elif result.get("cmd") == "error":
            print(f"  push error: {result.get('err')}", flush=True)
        else:
            print(f"  push done: {total_sent} files, {_fmt_size(total_bytes)}, {elapsed:.1f}s", flush=True)
    except Exception:
        conn.invalidate()
        raise


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------

def _load_state() -> dict:
    if not os.path.isfile(_STATE_FILE):
        return {}
    try:
        with open(_STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _save_state(state: dict) -> None:
    try:
        with open(_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def _run_loop() -> None:
    if not os.path.isfile(_CLIENT_CONFIG):
        raise SystemExit(f"missing config: {_CLIENT_CONFIG}")
    cfg = load_json_config(_CLIENT_CONFIG)
    targets = _parse_targets(cfg)
    enabled_targets = [t for t in targets if bool(t.get("enabled", True))]
    disabled_targets = [t for t in targets if not bool(t.get("enabled", True))]

    local_raw = cfg.get("local_dir", "../../")
    root = resolve_path_against(_SCRIPT_DIR, str(local_raw))
    root = os.path.abspath(root) if root else ""
    if bool(cfg.get("print_paths_only", False)):
        print(f"client_config={os.path.abspath(_CLIENT_CONFIG)}", flush=True)
        print(f"script_dir={os.path.abspath(_SCRIPT_DIR)}", flush=True)
        print(f"local_sync_root={root}", flush=True)
        print(f"server_targets={len(targets)}", flush=True)
        for i, t in enumerate(targets, 1):
            status = "enabled" if bool(t.get("enabled", True)) else "disabled"
            print(f"target[{i}]={t['host']}:{t['port']} ({status})", flush=True)
        raise SystemExit(0)
    if not root:
        raise SystemExit("edit client_config.json: set local_dir")
    if not os.path.isdir(root):
        raise SystemExit(f"not a directory: {root}")
    if enabled_targets:
        if not sys.stdin.isatty():
            raise SystemExit(
                "Interactive pair entry requires a TTY (stdin is not a terminal)."
            )
        _interactive_acquire_pairs(enabled_targets)
    extra = cfg.get("exclude") or []
    if not isinstance(extra, list):
        extra = []
    ex = tuple(_DEFAULT_EXCLUDES) + tuple(str(x) for x in extra)
    interval = float(cfg.get("interval_seconds", 2.0))
    use_watch = bool(cfg.get("use_watch", True))
    debounce = float(cfg.get("watch_debounce_seconds", 0.35))

    state = _load_state()
    single_target = len(targets) == 1

    disabled_state_updated = False
    for t in disabled_targets:
        key = str(t["key"])
        if _target_initial_done(state, key, single_target):
            _mark_target_requires_initial_sync(state, key)
            disabled_state_updated = True
    if disabled_state_updated:
        _save_state(state)

    print(
        f"config: root={root}  targets={len(targets)} "
        f"(enabled={len(enabled_targets)}, disabled={len(disabled_targets)})  excludes={len(ex)}",
        flush=True,
    )
    for t in targets:
        status = "enabled" if bool(t.get("enabled", True)) else "disabled"
        print(f"  target: {t['key']} [{status}]", flush=True)

    if not enabled_targets:
        print("no enabled targets; set servers[].enabled=true to start syncing", flush=True)

    # --- create persistent connections ---
    conns: dict[str, _PersistentConn] = {}
    for t in enabled_targets:
        key = str(t["key"])
        conns[key] = _PersistentConn(str(t["host"]), int(t["port"]), str(t["pair"]))

    print("scanning local files ...", flush=True)
    t0 = time.time()
    snap: dict[str, tuple[float, int]] = _scan_local(root, ex)
    total_size = sum(sz for _, sz in snap.values())
    print(
        f"scan done: {len(snap)} files, {_fmt_size(total_size)} total ({time.time() - t0:.1f}s)",
        flush=True,
    )

    # per-target snap hash for skip optimization
    last_snap_hashes: dict[str, str] = {}

    def do_sync_target(
        target: dict[str, str | int | bool | tuple[str, ...]],
        s: dict[str, tuple[float, int]],
        label: str,
    ) -> bool:
        key = str(target["key"])
        conn = conns[key]
        target_snap = _filter_snapshot_for_target(s, target)
        try:
            _run_one_sync(conn, root, target_snap)
            print(f"ok {label} [{key}] files={len(target_snap)}", flush=True)
            last_snap_hashes[key] = _snap_hash(target_snap)
            return True
        except (OSError, RuntimeError, ValueError) as e:
            print(f"sync failed ({label}) [{key}]: {e}", flush=True)
            return False

    def push_target(
        target: dict[str, str | int | bool | tuple[str, ...]],
        changed: list[str],
        deleted: list[str],
        s: dict[str, tuple[float, int]],
    ) -> bool:
        key = str(target["key"])
        conn = conns[key]
        target_changed = _filter_paths_for_target(changed, target)
        target_deleted = _filter_paths_for_target(deleted, target)
        target_snap = _filter_snapshot_for_target(s, target)
        if not target_changed and not target_deleted:
            print(f"  -> push target [{key}] skipped (no paths matched target rules)", flush=True)
            return True
        try:
            print(
                f"  -> push target [{key}] changed={len(target_changed)} deleted={len(target_deleted)}",
                flush=True,
            )
            _run_incremental_push(conn, root, target_changed, target_deleted, target_snap)
            last_snap_hashes[key] = _snap_hash(target_snap)
            return True
        except (OSError, RuntimeError, ValueError) as e:
            print(f"  push failed [{key}]: {e}", flush=True)
            return False

    # --- initial sync ---
    pending_initial = [
        t
        for t in enabled_targets
        if not _target_initial_done(state, str(t["key"]), single_target)
    ]

    max_workers = min(len(enabled_targets), 4) if len(enabled_targets) > 1 else 1
    pool: ThreadPoolExecutor | None = ThreadPoolExecutor(max_workers=max_workers) if max_workers > 1 else None

    def _parallel_sync(targets_list: list, label: str) -> int:
        """Sync multiple targets in parallel. Returns count of successes."""
        if not targets_list:
            return 0
        if pool is None or len(targets_list) == 1:
            ok = 0
            for t in targets_list:
                if do_sync_target(t, snap, label):
                    ok += 1
            return ok
        futures = {}
        for t in targets_list:
            f = pool.submit(do_sync_target, t, snap, label)
            futures[f] = t
        ok = 0
        for f in as_completed(futures):
            try:
                if f.result():
                    ok += 1
            except Exception as e:
                t = futures[f]
                print(f"  sync exception [{t['key']}]: {e}", flush=True)
        return ok

    def _parallel_push(
        targets_list: list,
        changed: list[str],
        deleted: list[str],
    ) -> None:
        if not targets_list:
            return
        if pool is None or len(targets_list) == 1:
            for t in targets_list:
                push_target(t, changed, deleted, snap)
            return
        futures = {}
        for t in targets_list:
            f = pool.submit(push_target, t, changed, deleted, snap)
            futures[f] = t
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                t = futures[f]
                print(f"  push exception [{t['key']}]: {e}", flush=True)

    skip_first_poll = False
    if pending_initial:
        print(f"initial full sync (entire tree) for {len(pending_initial)} target(s)", flush=True)
        initial_ok = _parallel_sync(pending_initial, "initial")
        for t in pending_initial:
            key = str(t["key"])
            # mark done if sync succeeded (check via last_snap_hashes)
            if key in last_snap_hashes:
                _mark_target_initial_done(state, key)
        _save_state(state)
        if initial_ok == len(pending_initial):
            print("initial sync done for all targets; switching to incremental", flush=True)
            skip_first_poll = True
        else:
            print(
                f"initial sync partially failed ({initial_ok}/{len(pending_initial)}); will retry automatically",
                flush=True,
            )
    elif use_watch and _HAS_WATCHDOG:
        _parallel_sync(enabled_targets, "startup_reconcile")

    # --- watch mode ---
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
                need_full: list = []
                need_push: list = []
                for t in enabled_targets:
                    key = str(t["key"])
                    if not _target_initial_done(state, key, single_target):
                        need_full.append(t)
                    else:
                        need_push.append(t)
                if need_full:
                    ok = _parallel_sync(need_full, "watch_full_sync")
                    for t in need_full:
                        key = str(t["key"])
                        if key in last_snap_hashes:
                            _mark_target_initial_done(state, key)
                            _save_state(state)
                if need_push:
                    _parallel_push(need_push, changed, deleted)

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
        _cleanup_conns(conns, pool)
        return

    # --- poll mode ---
    if use_watch and not _HAS_WATCHDOG:
        print("watchdog not installed; pip install watchdog  OR  set use_watch false", flush=True)

    try:
        while True:
            if skip_first_poll:
                skip_first_poll = False
            else:
                try:
                    snap.clear()
                    snap.update(_scan_local(root, ex))

                    # P2: skip targets whose snap hash hasn't changed
                    targets_to_sync: list = []
                    for t in enabled_targets:
                        key = str(t["key"])
                        target_snap = _filter_snapshot_for_target(snap, t)
                        h = _snap_hash(target_snap)
                        if h == last_snap_hashes.get(key) and _target_initial_done(state, key, single_target):
                            continue
                        targets_to_sync.append(t)

                    if targets_to_sync:
                        ok = _parallel_sync(targets_to_sync, "poll")
                        for t in targets_to_sync:
                            key = str(t["key"])
                            if key in last_snap_hashes and not _target_initial_done(state, key, single_target):
                                _mark_target_initial_done(state, key)
                                _save_state(state)
                except (OSError, RuntimeError, ValueError) as e:
                    print(f"sync round failed: {e}", flush=True)
            time.sleep(interval)
    except KeyboardInterrupt:
        pass
    finally:
        _cleanup_conns(conns, pool)


def _cleanup_conns(
    conns: dict[str, _PersistentConn],
    pool: ThreadPoolExecutor | None,
) -> None:
    for conn in conns.values():
        try:
            conn.close_session()
        except Exception:
            pass
    if pool is not None:
        pool.shutdown(wait=False)


def main() -> None:
    _run_loop()


if __name__ == "__main__":
    main()
