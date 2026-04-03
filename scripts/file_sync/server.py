# Pair-code TCP sync server: manifest first (mtime/size), then file payloads only when needed.

from __future__ import annotations

import json
import os
import secrets
import socket
import threading
import time

from protocol import (
    load_json_config,
    read_file_payload,
    read_json_frame,
    resolve_path_against,
    safe_rel,
    to_os_path,
    write_json_frame,
)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SERVER_CONFIG = os.path.join(_SCRIPT_DIR, "server_config.json")


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
            except OSError:
                pass
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
        except OSError:
            pass
    _prune_empty_dirs(root)


def _prune_empty_dirs(root: str) -> None:
    root = os.path.abspath(root)
    for dirpath, _, _ in os.walk(root, topdown=False):
        if os.path.abspath(dirpath) == root:
            continue
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
        except OSError:
            pass


def handle_client(
    conn: socket.socket,
    _addr: tuple,
    expected_pair: str,
    root: str,
) -> None:
    try:
        conn.settimeout(3600.0)
        msg = read_json_frame(conn)
        if msg.get("cmd") != "auth":
            write_json_frame(conn, {"cmd": "auth_fail", "reason": "need auth first"})
            return
        got = str(msg.get("pair", ""))
        if not secrets.compare_digest(got, expected_pair):
            write_json_frame(conn, {"cmd": "auth_fail", "reason": "pair mismatch"})
            return
        write_json_frame(conn, {"cmd": "auth_ok"})
        m = read_json_frame(conn)
        if m.get("cmd") != "manifest":
            write_json_frame(conn, {"cmd": "error", "err": "expected manifest after auth"})
            return
        raw_files = m.get("files")
        if not isinstance(raw_files, dict):
            write_json_frame(conn, {"cmd": "error", "err": "manifest.files must be object"})
            return
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
        upload: list[str] = []
        for rel, (c_mtime, c_size) in client_map.items():
            if _needs_upload(server_files, rel, c_mtime, c_size):
                upload.append(rel)
        upload.sort()
        write_json_frame(conn, {"cmd": "sync_plan", "upload": upload})
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
                    write_json_frame(conn, {"cmd": "error", "err": "bad path"})
                    continue
                parent = os.path.dirname(dst)
                if parent and not os.path.isdir(parent):
                    os.makedirs(parent, exist_ok=True)
                data = read_file_payload(conn, size)
                tmp = dst + ".part"
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, dst)
                try:
                    os.utime(dst, (mtime, mtime))
                except OSError:
                    pass
                write_json_frame(conn, {"cmd": "ack", "path": rel})
                continue
            if cmd == "bye":
                write_json_frame(conn, {"cmd": "bye"})
                return
            write_json_frame(conn, {"cmd": "error", "err": f"unknown cmd {cmd!r}"})
    except (ConnectionError, OSError, ValueError, json.JSONDecodeError, KeyError) as e:
        try:
            write_json_frame(conn, {"cmd": "error", "err": str(e)})
        except OSError:
            pass
    finally:
        try:
            conn.close()
        except OSError:
            pass


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
    expected_pair = str(cfg.get("pair_code", ""))
    if not expected_pair or expected_pair == "SET_PAIR_CODE":
        raise SystemExit("edit server_config.json: set pair_code")
    if not root:
        raise SystemExit("edit server_config.json: set root")
    os.makedirs(root, exist_ok=True)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(32)
    print(f"sync server listening {host}:{port} -> {root}", flush=True)
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
