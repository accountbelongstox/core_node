# Pair-code TCP sync server: manifest first (mtime/size), then file payloads only when needed.
# Single-file: inlined protocol + pip/ensurepip bootstrap (no external protocol.py required).

from __future__ import annotations

import json
import os
import secrets
import socket
import struct
import subprocess
import sys
import threading
import time
import traceback
from typing import Any

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)


def _pip_bootstrap() -> None:
    """Ensure pip exists; upgrade pip. Prints steps; on failure logs traceback and continues."""
    if os.environ.get("FILE_SYNC_V2_NO_AUTO_PIP", "").lower() in ("1", "true", "yes"):
        print("[file_sync_v2] FILE_SYNC_V2_NO_AUTO_PIP set, skipping pip bootstrap", flush=True)
        return
    try:
        print("[file_sync_v2] checking pip:", sys.executable, "-m pip --version", flush=True)
        v = subprocess.run(
            [sys.executable, "-m", "pip", "--version"],
            timeout=60,
            capture_output=True,
            text=True,
        )
        if v.returncode != 0:
            print("[file_sync_v2] pip not usable, running: python -m ensurepip --upgrade", flush=True)
            subprocess.run(
                [sys.executable, "-m", "ensurepip", "--upgrade"],
                timeout=180,
            )
        print("[file_sync_v2] upgrading pip: python -m pip install -U pip", flush=True)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-U", "pip"],
            timeout=600,
        )
        print("[file_sync_v2] pip bootstrap done", flush=True)
    except Exception as e:
        print(f"[file_sync_v2] pip bootstrap failed (server still starts): {e!r}", flush=True)
        traceback.print_exc()


_pip_bootstrap()

# --- inlined from protocol.py (framing + path helpers) ---
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


def write_json_then_bytes(sock, obj: dict[str, Any], payload: bytes) -> None:
    write_json_frame(sock, obj)
    if payload:
        sock.sendall(payload)


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


_SERVER_CONFIG = os.path.join(_SCRIPT_DIR, "server_config.json")

_PAIR_FAIL_LOCK = threading.Lock()
_PAIR_FAIL_STREAK = 0


def _clear_pair_fail_streak() -> None:
    global _PAIR_FAIL_STREAK
    with _PAIR_FAIL_LOCK:
        _PAIR_FAIL_STREAK = 0


def _bump_pair_fail_streak() -> bool:
    """Increment failed-auth streak; return True if server should exit (>= 2)."""
    global _PAIR_FAIL_STREAK
    with _PAIR_FAIL_LOCK:
        _PAIR_FAIL_STREAK += 1
        return _PAIR_FAIL_STREAK >= 2


def _random_two_digit_session_code() -> str:
    return f"{secrets.randbelow(100):02d}"


def _under_root(root: str, path: str) -> bool:
    root = os.path.abspath(root)
    path = os.path.abspath(path)
    try:
        return os.path.commonpath([root, path]) == root
    except ValueError:
        return False


def _list_server_files(root: str) -> dict[str, tuple[float, int]]:
    root = os.path.abspath(root)
    out: dict[str, tuple[float, int]] = {}
    if not os.path.isdir(root):
        return out
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            abs_p = os.path.join(dirpath, fn)
            rel = os.path.relpath(abs_p, root).replace(os.sep, "/")
            try:
                st = os.stat(abs_p)
                if os.path.isfile(abs_p):
                    out[rel] = (st.st_mtime, st.st_size)
            except OSError as e:
                print(f"[file_sync_v2] list_server_files skip {abs_p!r}: {e}", file=sys.stderr, flush=True)
    return out


def _needs_upload(
    server_files: dict[str, tuple[float, int]],
    rel: str,
    c_mtime: float,
    c_size: int,
) -> bool:
    if rel not in server_files:
        return True
    sm, ss = server_files[rel]
    if ss != c_size:
        return True
    if round(sm, 6) != round(float(c_mtime), 6):
        return True
    return False


def _delete_server_orphans(root: str, client_rels: set[str]) -> None:
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        return
    to_delete: list[str] = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            abs_p = os.path.join(dirpath, fn)
            rel = os.path.relpath(abs_p, root).replace(os.sep, "/")
            if rel not in client_rels:
                to_delete.append(abs_p)
    for abs_p in to_delete:
        try:
            if os.path.isfile(abs_p):
                os.remove(abs_p)
        except OSError as e:
            print(f"[file_sync_v2] orphan delete failed {abs_p!r}: {e}", file=sys.stderr, flush=True)
    _prune_empty_dirs(root)


def _prune_empty_dirs(root: str) -> None:
    root = os.path.abspath(root)
    for dirpath, _, _ in os.walk(root, topdown=False):
        if os.path.abspath(dirpath) == root:
            continue
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
        except OSError as e:
            print(f"[file_sync_v2] rmdir skip {dirpath!r}: {e}", file=sys.stderr, flush=True)


def _fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f}KB"
    return f"{n / 1024 / 1024:.1f}MB"


_TEXT_EXTS = frozenset((
    ".sh", ".bash", ".zsh", ".fish", ".csh",
    ".py", ".pyw", ".pyi",
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts",
    ".json", ".jsonc", ".json5",
    ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".conf",
    ".xml", ".html", ".htm", ".xhtml", ".svg",
    ".css", ".scss", ".sass", ".less",
    ".md", ".markdown", ".rst", ".txt", ".text",
    ".csv", ".tsv",
    ".sql",
    ".rb", ".rake", ".gemspec",
    ".php", ".phtml",
    ".java", ".kt", ".kts", ".scala", ".groovy", ".gradle",
    ".go", ".mod", ".sum",
    ".rs",
    ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".ipp",
    ".cs", ".csx", ".csproj", ".sln", ".props",
    ".swift",
    ".dart",
    ".lua",
    ".r", ".R",
    ".pl", ".pm",
    ".ex", ".exs",
    ".erl", ".hrl",
    ".hs", ".lhs",
    ".vue",
    ".svelte",
    ".astro",
    ".bat", ".cmd", ".ps1", ".psm1",
    ".makefile", ".mk",
    ".dockerfile",
    ".tf", ".tfvars",
    ".env", ".env.example", ".env.local",
    ".editorconfig", ".gitignore", ".gitattributes", ".gitmodules",
    ".dockerignore", ".npmrc", ".yarnrc", ".eslintrc", ".prettierrc",
    ".htaccess", ".nginx",
    ".proto",
    ".graphql", ".gql",
    ".lock",
))

# names without extension that are text
_TEXT_NAMES = frozenset((
    "Makefile", "Dockerfile", "Vagrantfile", "Gemfile", "Rakefile",
    "Procfile", "Brewfile", "Justfile",
    "LICENSE", "LICENCE", "COPYING", "AUTHORS", "CONTRIBUTORS",
    "README", "CHANGELOG", "CHANGES", "NEWS", "HISTORY",
    ".gitignore", ".gitattributes", ".dockerignore", ".editorconfig",
))


def _is_text_file(rel: str) -> bool:
    name = rel.rsplit("/", 1)[-1] if "/" in rel else rel
    if name in _TEXT_NAMES:
        return True
    _, ext = os.path.splitext(name)
    return ext.lower() in _TEXT_EXTS


def _fix_line_endings(data: bytes) -> bytes:
    """Convert CRLF to LF for text files on Linux."""
    if b"\r\n" in data:
        return data.replace(b"\r\n", b"\n")
    return data


def _log(addr: tuple, msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{addr[0]}:{addr[1]}] {msg}", flush=True)


def _handle_push(
    conn: socket.socket,
    addr: tuple,
    root: str,
    first_msg: dict,
) -> None:
    """Incremental push mode: client sends files directly, no manifest comparison."""
    deleted = first_msg.get("deleted") or []
    _log(addr, f"push mode, {len(deleted)} delete(s) queued")
    # handle deletions
    for rel_raw in deleted:
        rel = safe_rel(str(rel_raw))
        dst = to_os_path(root, rel)
        if _under_root(root, dst) and os.path.isfile(dst):
            try:
                os.remove(dst)
                _log(addr, f"  deleted {dst}")
            except OSError as e:
                _log(addr, f"  delete failed {dst!r}: {e}")
    received = 0
    received_bytes = 0
    errors: list[str] = []
    t_start = time.time()
    last_report = t_start
    while True:
        m = read_json_frame(conn)
        cmd = m.get("cmd")
        if cmd == "file":
            rel = safe_rel(str(m.get("path", "")))
            size = int(m.get("size", -1))
            mtime = float(m.get("mtime", time.time()))
            dst = to_os_path(root, rel)
            if not _under_root(root, dst):
                errors.append(f"bad path: {rel}")
                read_file_payload(conn, size)
                continue
            parent = os.path.dirname(dst)
            if parent and not os.path.isdir(parent):
                os.makedirs(parent, exist_ok=True)
            data = read_file_payload(conn, size)
            if _is_text_file(rel):
                data = _fix_line_endings(data)
            tmp = dst + ".part"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dst)
            try:
                os.utime(dst, (mtime, mtime))
            except OSError as e:
                _log(addr, f"  utime failed {dst!r}: {e}")
            received += 1
            received_bytes += size
            now = time.time()
            _log(addr, f"  << {dst} ({_fmt_size(size)})")
            last_report = now
            continue
        if cmd == "bye":
            elapsed = time.time() - t_start
            _log(addr, f"push done: {received} files, {len(deleted)} deleted, {_fmt_size(received_bytes)}, {elapsed:.1f}s")
            write_json_frame(conn, {
                "cmd": "sync_done",
                "received": received,
                "deleted": len(deleted),
                "bytes": received_bytes,
                "errors": errors,
            })
            return
        write_json_frame(conn, {"cmd": "error", "err": f"unknown cmd {cmd!r}"})


def handle_client(
    conn: socket.socket,
    _addr: tuple,
    expected_pair: str,
    root: str,
) -> None:
    try:
        conn.settimeout(3600.0)
        _log(_addr, "connected")
        msg = read_json_frame(conn)
        if msg.get("cmd") != "auth":
            _log(_addr, "rejected: no auth cmd")
            write_json_frame(conn, {"cmd": "auth_fail", "reason": "need auth first"})
            return
        got = str(msg.get("pair", ""))
        if len(got) != len(expected_pair) or not secrets.compare_digest(got, expected_pair):
            _log(_addr, "rejected: pair mismatch")
            write_json_frame(conn, {"cmd": "auth_fail", "reason": "pair mismatch"})
            if _bump_pair_fail_streak():
                _log(_addr, "two consecutive pair failures; exiting process")
                try:
                    conn.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                os._exit(1)
            return
        _clear_pair_fail_streak()
        _log(_addr, "auth ok")
        write_json_frame(conn, {"cmd": "auth_ok"})
        _log(_addr, "waiting for next frame (manifest, push, pair_check_end, ...) ...")
        m = read_json_frame(conn)
        _log(_addr, f"received cmd={m.get('cmd')!r}")
        if m.get("cmd") == "pair_check_end":
            write_json_frame(conn, {"cmd": "pair_check_ack"})
            _log(_addr, "pair-check handshake done (client will close)")
            return
        if m.get("cmd") == "push":
            _handle_push(conn, _addr, root, m)
            return
        if m.get("cmd") != "manifest":
            write_json_frame(conn, {"cmd": "error", "err": "expected manifest or push after auth"})
            return
        raw_files = m.get("files")
        if not isinstance(raw_files, dict):
            write_json_frame(conn, {"cmd": "error", "err": "manifest.files must be object"})
            return
        _log(_addr, f"manifest received: {len(raw_files)} files")
        client_map: dict[str, tuple[float, int]] = {}
        for k, v in raw_files.items():
            rel = safe_rel(str(k))
            if not isinstance(v, dict):
                write_json_frame(
                    conn,
                    {"cmd": "error", "err": f"manifest.files[{k!r}] must be object with mtime,size"},
                )
                return
            try:
                c_mtime = float(v["mtime"])
                c_size = int(v["size"])
            except (KeyError, TypeError, ValueError):
                write_json_frame(
                    conn,
                    {"cmd": "error", "err": f"manifest.files[{k!r}] needs numeric mtime,size"},
                )
                return
            client_map[rel] = (c_mtime, c_size)
        client_rels = set(client_map.keys())
        _delete_server_orphans(root, client_rels)
        server_files = _list_server_files(root)
        _log(_addr, f"server has {len(server_files)} files locally")
        upload: list[str] = []
        for rel, (c_mtime, c_size) in client_map.items():
            if _needs_upload(server_files, rel, c_mtime, c_size):
                upload.append(rel)
        upload.sort()
        new_count = sum(1 for r in upload if r not in server_files)
        update_count = len(upload) - new_count
        _log(_addr, f"sync plan: {len(upload)} to upload ({new_count} new, {update_count} changed), {len(client_map) - len(upload)} up-to-date")
        write_json_frame(conn, {"cmd": "sync_plan", "upload": upload})
        received = 0
        received_bytes = 0
        errors: list[str] = []
        total_up = len(upload)
        t_start = time.time()
        last_report = t_start
        while True:
            m = read_json_frame(conn)
            cmd = m.get("cmd")
            if cmd == "ping":
                write_json_frame(conn, {"cmd": "pong"})
                continue
            if cmd == "file":
                rel = safe_rel(str(m.get("path", "")))
                size = int(m.get("size", -1))
                mtime = float(m.get("mtime", time.time()))
                dst = to_os_path(root, rel)
                if not _under_root(root, dst):
                    errors.append(f"bad path: {rel}")
                    # still must consume the payload
                    read_file_payload(conn, size)
                    continue
                parent = os.path.dirname(dst)
                if parent and not os.path.isdir(parent):
                    os.makedirs(parent, exist_ok=True)
                data = read_file_payload(conn, size)
                if _is_text_file(rel):
                    data = _fix_line_endings(data)
                tmp = dst + ".part"
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, dst)
                try:
                    os.utime(dst, (mtime, mtime))
                except OSError as e:
                    _log(_addr, f"  utime failed {dst!r}: {e}")
                received += 1
                received_bytes += size
                now = time.time()
                if now - last_report >= 2.0 or received == total_up or received == 1:
                    elapsed = now - t_start
                    pct = received * 100 // total_up if total_up else 100
                    rate = received_bytes / elapsed if elapsed > 0 else 0
                    _log(_addr, f"  recv [{received}/{total_up}] {pct}%  {_fmt_size(received_bytes)}  {_fmt_size(int(rate))}/s  {dst}")
                    last_report = now
                # no per-file ACK — final summary sent on "bye"
                continue
            if cmd == "bye":
                elapsed = time.time() - t_start
                _log(_addr, f"sync done: {received} files, {_fmt_size(received_bytes)}, {elapsed:.1f}s")
                write_json_frame(conn, {
                    "cmd": "sync_done",
                    "received": received,
                    "bytes": received_bytes,
                    "errors": errors,
                })
                return
            write_json_frame(conn, {"cmd": "error", "err": f"unknown cmd {cmd!r}"})
    except ConnectionError as e:
        _log(
            _addr,
            f"connection lost: {e!r} — client closed TCP before sending a full frame "
            f"(after auth_ok, expect manifest or push). Check client logs, firewall, or idle timeout.",
        )
    except json.JSONDecodeError as e:
        _log(_addr, f"invalid JSON in frame: {e!r}")
        write_json_frame(conn, {"cmd": "error", "err": str(e)})
    except (ValueError, KeyError) as e:
        _log(_addr, f"protocol/data error: {type(e).__name__}: {e!r}")
        write_json_frame(conn, {"cmd": "error", "err": str(e)})
    except OSError as e:
        _log(_addr, f"socket/os error: {e!r}")
    except Exception as e:
        _log(_addr, f"unexpected error: {type(e).__name__}: {e!r}")
        traceback.print_exc()
    finally:
        _log(_addr, "disconnected")
        try:
            conn.close()
        except OSError as e:
            print(f"[file_sync_v2] conn.close: {e!r}", file=sys.stderr, flush=True)


def _serve() -> None:
    if not os.path.isfile(_SERVER_CONFIG):
        raise SystemExit(f"missing config: {_SERVER_CONFIG}")
    cfg = load_json_config(_SERVER_CONFIG)
    root_raw = cfg.get("root", "")
    root = resolve_path_against(_SCRIPT_DIR, str(root_raw))
    root = os.path.abspath(root) if root else ""
    host = str(cfg.get("host", "0.0.0.0"))
    port = int(cfg.get("port", 18765))
    if bool(cfg.get("print_paths_only", False)):
        print(f"server_config={os.path.abspath(_SERVER_CONFIG)}", flush=True)
        print(f"script_dir={os.path.abspath(_SCRIPT_DIR)}", flush=True)
        print(f"receive_root={root}", flush=True)
        print(f"listen={host}:{port}", flush=True)
        raise SystemExit(0)
    expected_pair = _random_two_digit_session_code()
    if not root:
        raise SystemExit("edit server_config.json: set root")
    os.makedirs(root, exist_ok=True)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(32)
    print(f"sync server listening {host}:{port} -> {root}", flush=True)
    print("", flush=True)
    print("=" * 52, flush=True)
    print(f"  PAIR CODE (enter on client):  {expected_pair}  ", flush=True)
    print("=" * 52, flush=True)
    print("", flush=True)
    try:
        while True:
            conn, addr = sock.accept()
            t = threading.Thread(
                target=handle_client,
                args=(conn, addr, expected_pair, root),
                daemon=True,
            )
            t.start()
    except KeyboardInterrupt:
        print("shutdown", flush=True)
    finally:
        sock.close()


def main() -> None:
    _serve()


if __name__ == "__main__":
    main()
