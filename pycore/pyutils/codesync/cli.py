# -*- coding: utf-8 -*-
"""
Stdlib CLI for Code Sync — the `pyservice.sh codesync ...` surface.

    pyservice.sh codesync run [--host H] [--port P]      # start the standalone daemon
    pyservice.sh codesync show
    pyservice.sh codesync role [dev|client]
    pyservice.sh codesync peers list|add|remove|update ...
    pyservice.sh codesync distribute on|off               # dev (needs a running daemon)
    pyservice.sh codesync skip-update on|off              # client (needs a running daemon)

HTTP-first, file-fallback: while a daemon (or the full pycore service) is running
on the target port, edits go through its HTTP API and apply live; while it is
stopped, persistent settings (role/peers) are written straight to the committed
peer file and take effect next start. Runtime-only toggles (distribute /
skip-update) require a running daemon.

Stdlib only: HTTP via `.runtime.http`, persistence via `.peer_config`.
"""

import argparse
import json
import sys

from .runtime import http

DEFAULT_PORT = 59000


# --------------------------------------------------------------------------- #
# small HTTP helpers                                                           #
# --------------------------------------------------------------------------- #
def _base(port):
    return f"http://127.0.0.1:{port}"


def _http_get(port, path, timeout=2.0):
    try:
        r = http.get(_base(port) + path, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception:
        return None
    return None


def _http_post(port, path, body, timeout=4.0):
    try:
        r = http.post(_base(port) + path, json=body, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        return {"success": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception:
        return None


def _server_up(port):
    return _http_get(port, "/code-sync/ping", timeout=1.0) is not None


def _emit(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def _peer_config():
    from .peer_config import get_peer_config
    return get_peer_config()


def _offline_snapshot(cfg):
    """Build a peer snapshot from the committed config that matches the shape the
    running service returns (self reported separately and EXCLUDED from `peers`,
    every peer carrying the live-status keys with offline defaults). Keeps
    show / peers-list output identical whether or not a daemon is running."""
    me = cfg.get_self()
    self_id = me.get("id")
    peers = [
        {**p, "reachable": False, "last_seen": None, "status": None, "pending": False}
        for p in cfg.list_peers() if p.get("id") != self_id
    ]
    return me, peers, cfg.version()


# --------------------------------------------------------------------------- #
# commands                                                                     #
# --------------------------------------------------------------------------- #
def cmd_run(args):
    from . import daemon
    return daemon.run(host=args.host, port=args.port, reload=getattr(args, "reload", False))


def cmd_show(args):
    data = _http_get(args.port, "/code-sync/peers")
    if data is not None:
        _emit({"source": "service", "self": data.get("self"),
               "peers": data.get("peers"), "version": data.get("version")})
        return 0
    me, peers, version = _offline_snapshot(_peer_config())
    _emit({"source": "file", "self": me, "peers": peers, "version": version})
    return 0


def cmd_role(args):
    if not args.role:  # get
        if _server_up(args.port):
            data = _http_get(args.port, "/code-sync/peers") or {}
            _emit({"source": "service", "role": (data.get("self") or {}).get("role")})
        else:
            _emit({"source": "file", "role": _peer_config().get_role()})
        return 0
    if args.role not in ("dev", "client"):
        _emit({"success": False, "error": "role must be 'dev' or 'client'"})
        return 1
    if _server_up(args.port):
        res = _http_post(args.port, "/code-sync/role", {"role": args.role})
        _emit({"source": "service", "result": res})
        return 0 if res and res.get("success") else 1
    role = _peer_config().set_role(args.role)
    _emit({"source": "file", "success": True, "role": role})
    return 0


def cmd_peers(args):
    op = args.peers_op
    up = _server_up(args.port)
    cfg = None if up else _peer_config()

    if op == "list":
        if up:
            data = _http_get(args.port, "/code-sync/peers") or {}
            _emit({"source": "service", "peers": data.get("peers"), "self": data.get("self")})
        else:
            me, peers, _ = _offline_snapshot(cfg)
            _emit({"source": "file", "peers": peers, "self": me})
        return 0

    if op == "add":
        if not args.host:
            _emit({"success": False, "error": "--host is required"})
            return 1
        name = args.name or args.host
        role = args.role or "client"
        port = args.peer_port or DEFAULT_PORT
        if up:
            res = _http_post(args.port, "/code-sync/peers/add",
                             {"name": name, "host": args.host, "port": port, "role": role})
            _emit({"source": "service", "result": res})
            return 0 if res and res.get("success") else 1
        cfg.add_peer(name, args.host, port, role)
        _emit({"source": "file", "success": True, "peers": cfg.list_peers()})
        return 0

    if op == "remove":
        if not args.id:
            _emit({"success": False, "error": "--id is required"})
            return 1
        if up:
            res = _http_post(args.port, "/code-sync/peers/remove", {"id": args.id})
            _emit({"source": "service", "result": res})
            return 0 if res and res.get("success") else 1
        ok = cfg.remove_peer(args.id)
        _emit({"source": "file", "success": ok, "peers": cfg.list_peers()})
        return 0 if ok else 1

    if op == "update":
        if not args.id:
            _emit({"success": False, "error": "--id is required"})
            return 1
        fields = {}
        if args.name is not None:
            fields["name"] = args.name
        if args.host is not None:
            fields["host"] = args.host
        if args.peer_port is not None:
            fields["port"] = args.peer_port
        if args.role is not None:
            fields["role"] = args.role
        if up:
            res = _http_post(args.port, "/code-sync/peers/update", {"id": args.id, **fields})
            _emit({"source": "service", "result": res})
            return 0 if res and res.get("success") else 1
        updated = cfg.update_peer(args.id, fields)
        _emit({"source": "file", "success": updated is not None, "peer": updated})
        return 0 if updated is not None else 1

    _emit({"success": False, "error": f"unknown peers op: {op}"})
    return 1


def _runtime_toggle(args, path, label):
    if not _server_up(args.port):
        _emit({"success": False,
               "error": f"{label} requires a running code-sync daemon on port {args.port}. "
                        f"Start it first (pyservice.sh codesync run)."})
        return 1
    state = str(args.state).lower() in ("on", "true", "1", "yes", "enable", "enabled")
    res = _http_post(args.port, path, {"enabled": state})
    _emit({"source": "service", "result": res})
    return 0 if res and res.get("success") else 1


def cmd_distribute(args):
    return _runtime_toggle(args, "/code-sync/distribute", "distribute")


def cmd_skip_update(args):
    return _runtime_toggle(args, "/code-sync/skip-update", "skip-update")


# --------------------------------------------------------------------------- #
# parser                                                                        #
# --------------------------------------------------------------------------- #
def build_parser():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help="code-sync port to target when a daemon/service is running (default 59000)")

    p = argparse.ArgumentParser(prog="pyservice codesync",
                                description="Standalone Code Sync (role / peers / daemon).")
    sub = p.add_subparsers(dest="action", required=True)

    run = sub.add_parser("run", parents=[common], help="start the standalone code-sync daemon")
    run.add_argument("--host", default="0.0.0.0", help="bind host (default 0.0.0.0)")
    # Deprecated no-op: codesync is resident and never hot-reloads. Kept ONLY so an
    # old systemd unit whose ExecStart baked `--reload` still parses and starts.
    run.add_argument("--reload", action="store_true", help=argparse.SUPPRESS)
    run.set_defaults(func=cmd_run)

    sub.add_parser("show", parents=[common], help="show role + peers").set_defaults(func=cmd_show)

    role = sub.add_parser("role", parents=[common], help="get or set this device role")
    role.add_argument("role", nargs="?", choices=["dev", "client"], help="omit to print current role")
    role.set_defaults(func=cmd_role)

    peers = sub.add_parser("peers", parents=[common], help="list/add/remove/update peers")
    peers.add_argument("peers_op", choices=["list", "add", "remove", "update"])
    peers.add_argument("--name")
    peers.add_argument("--host")
    peers.add_argument("--peer-port", dest="peer_port", type=int, help="peer port (default 59000)")
    peers.add_argument("--role", choices=["dev", "client"])
    peers.add_argument("--id")
    peers.set_defaults(func=cmd_peers)

    dist = sub.add_parser("distribute", parents=[common],
                          help="dev: start/stop distributing code (running daemon only)")
    dist.add_argument("state", choices=["on", "off"])
    dist.set_defaults(func=cmd_distribute)

    skip = sub.add_parser("skip-update", parents=[common],
                          help="client: temporarily reject code (running daemon only)")
    skip.add_argument("state", choices=["on", "off"])
    skip.set_defaults(func=cmd_skip_update)

    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    func = getattr(args, "func", None)
    if func is None:
        return 1
    try:
        return func(args) or 0
    except Exception as exc:
        _emit({"success": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
