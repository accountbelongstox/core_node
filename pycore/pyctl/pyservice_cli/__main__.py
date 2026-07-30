# -*- coding: utf-8 -*-
"""
Headless config CLI for pycore (no UI required).

    python -m pycore.pyctl.pyservice_cli config system get [--key K]
    python -m pycore.pyctl.pyservice_cli config system set (--key K --value V | --json '{...}')
    python -m pycore.pyctl.pyservice_cli config codesync show
    python -m pycore.pyctl.pyservice_cli config codesync role [dev|client]
    python -m pycore.pyctl.pyservice_cli config codesync peers list
    python -m pycore.pyctl.pyservice_cli config codesync peers add --name N --host H [--port 59000] [--role client]
    python -m pycore.pyctl.pyservice_cli config codesync peers remove --id ID
    python -m pycore.pyctl.pyservice_cli config codesync peers update --id ID [--name N] [--host H] [--port P] [--role R]
    python -m pycore.pyctl.pyservice_cli config codesync distribute (on|off)
    python -m pycore.pyctl.pyservice_cli config codesync skip-update (on|off)

Design: HTTP-first, file-fallback. When the local service is running, changes go
through its HTTP API so they apply live (and broadcast to any UI). When it is
stopped, persistent settings (system settings, code-sync role/peers) are written
straight to their files and take effect on next start. Runtime-only toggles
(distribute / skip-update) require the running service.
"""

import argparse
import json
import sys
from pathlib import Path

from pycore.pyutils.common.http_client import HttpClient, build_http_base_url
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.codesync.peer_config import get_peer_config
from pycore.pyfoundations.pygvar import HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT


# Make `pycore` importable when run as a script/module from anywhere.
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

DEFAULT_PORT = PYCORE_HTTP_PORT
HTTP_CLIENT = HttpClient()


# --------------------------------------------------------------------------- #
# Small HTTP helpers (server may or may not be running)                        #
# --------------------------------------------------------------------------- #
def _base(port):
    return build_http_base_url(HTTP_LOOPBACK_HOST, port)


def _http_get(port, path, timeout=2.0):
    try:
        r = HTTP_CLIENT.get(_base(port) + path, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception:
        return None
    return None


def _http_post(port, path, body, timeout=4.0):
    try:
        r = HTTP_CLIENT.post(_base(port) + path, json=body, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        return {"success": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception:
        return None


def _server_up(port):
    return _http_get(port, "/code-sync/ping", timeout=1.0) is not None


def _emit(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def _coerce(value):
    """Turn a CLI string into a typed value (true/false/int/float/json) or keep str."""
    if value is None:
        return None
    try:
        return json.loads(value)
    except Exception:
        return value


def _bool_arg(token):
    return str(token).lower() in ("on", "true", "1", "yes", "enable", "enabled")


# --------------------------------------------------------------------------- #
# system settings                                                             #
# --------------------------------------------------------------------------- #
def cmd_system_get(args):
    settings = None
    data = _http_get(args.port, "/api/local/user-data/system-settings")
    if data is not None:
        settings = data.get("settings") or {}
        source = "service"
    else:
        settings = user_data_store.get_section("system_settings") or {}
        source = "file"
    if args.key:
        _emit({"source": source, "key": args.key, "value": settings.get(args.key)})
    else:
        _emit({"source": source, "settings": settings})
    return 0


def cmd_system_set(args):
    if args.json:
        try:
            patch = json.loads(args.json)
            if not isinstance(patch, dict):
                raise ValueError("--json must be an object")
        except Exception as e:
            _emit({"success": False, "error": f"invalid --json: {e}"})
            return 1
    elif args.key is not None:
        patch = {args.key: _coerce(args.value)}
    else:
        _emit({"success": False, "error": "provide --key/--value or --json"})
        return 1

    if _server_up(args.port):
        # Merge over current (the service replaces the whole section), then POST.
        cur = (_http_get(args.port, "/api/local/user-data/system-settings") or {}).get("settings") or {}
        cur.update(patch)
        res = _http_post(args.port, "/api/local/user-data/system-settings", {"settings": cur})
        _emit({"source": "service", "result": res})
        return 0 if res and res.get("success") else 1
    else:
        saved = user_data_store.update_section("system_settings", patch)
        _emit({"source": "file", "success": True, "settings": saved})
        return 0


# --------------------------------------------------------------------------- #
# code sync                                                                    #
# --------------------------------------------------------------------------- #
def _offline_snapshot(cfg):
    """Build a peer snapshot from the committed config that matches the shape the
    running service returns (pycore's mesh snapshot / get_peers): self is reported
    separately and EXCLUDED from `peers`, and every peer carries the live-status
    keys with offline defaults. This keeps `show` / `peers list` output identical
    whether the service is up (service path) or stopped (file path)."""
    me = cfg.get_self()
    self_id = me.get("id")
    peers = [
        {**p, "reachable": False, "last_seen": None, "status": None, "pending": False}
        for p in cfg.list_peers() if p.get("id") != self_id
    ]
    return me, peers, cfg.version()


def cmd_codesync_show(args):
    data = _http_get(args.port, "/code-sync/peers")
    if data is not None:
        _emit({"source": "service", "self": data.get("self"),
               "peers": data.get("peers"), "version": data.get("version")})
        return 0
    me, peers, version = _offline_snapshot(get_peer_config())
    _emit({"source": "file", "self": me, "peers": peers, "version": version})
    return 0


def cmd_codesync_role(args):
    if not args.role:  # get
        if _server_up(args.port):
            data = _http_get(args.port, "/code-sync/peers") or {}
            _emit({"source": "service", "role": (data.get("self") or {}).get("role")})
        else:
            _emit({"source": "file", "role": get_peer_config().get_role()})
        return 0
    # set
    if args.role not in ("dev", "client"):
        _emit({"success": False, "error": "role must be 'dev' or 'client'"})
        return 1
    if _server_up(args.port):
        res = _http_post(args.port, "/code-sync/role", {"role": args.role})
        _emit({"source": "service", "result": res})
        return 0 if res and res.get("success") else 1
    role = get_peer_config().set_role(args.role)
    _emit({"source": "file", "success": True, "role": role})
    return 0


def cmd_codesync_peers(args):
    op = args.peers_op
    up = _server_up(args.port)
    # offline config handle
    cfg = None
    if not up:
        cfg = get_peer_config()

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
    """distribute / skip-update: require a running service (runtime-only state)."""
    if not _server_up(args.port):
        _emit({"success": False,
               "error": f"{label} requires the running service on port {args.port}. "
                        f"Start it first (pyservice.sh run / start)."})
        return 1
    res = _http_post(args.port, path, {"enabled": _bool_arg(args.state)})
    _emit({"source": "service", "result": res})
    return 0 if res and res.get("success") else 1


def cmd_codesync_distribute(args):
    return _runtime_toggle(args, "/code-sync/distribute", "distribute")


def cmd_codesync_skip_update(args):
    return _runtime_toggle(args, "/code-sync/skip-update", "skip-update")


# --------------------------------------------------------------------------- #
# parser                                                                       #
# --------------------------------------------------------------------------- #
def build_parser():
    # Shared --port option, attached to every leaf so it can appear after the
    # subcommand (pyservice.sh forwards `config ...` first, then user args).
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help="RPC server port to target when the service is running (default 59000)")

    p = argparse.ArgumentParser(prog="pyservice config",
                                description="Headless pycore configuration (system settings + code sync).")
    top = p.add_subparsers(dest="group", required=True)

    cfg = top.add_parser("config", help="configuration commands")
    cfgsub = cfg.add_subparsers(dest="domain", required=True)

    # system
    syscmd = cfgsub.add_parser("system", help="system settings (theme, lang, accent, ...)")
    syssub = syscmd.add_subparsers(dest="action", required=True)
    sg = syssub.add_parser("get", parents=[common], help="print system settings")
    sg.add_argument("--key", help="print only this key")
    sg.set_defaults(func=cmd_system_get)
    ss = syssub.add_parser("set", parents=[common], help="set settings (--key/--value or --json)")
    ss.add_argument("--key")
    ss.add_argument("--value")
    ss.add_argument("--json", help='JSON object, e.g. {"theme":"light","lang":"zh"}')
    ss.set_defaults(func=cmd_system_set)

    # codesync
    cs = cfgsub.add_parser("codesync", help="code-sync role / peers / distribute / skip-update")
    cssub = cs.add_subparsers(dest="action", required=True)

    cssub.add_parser("show", parents=[common], help="show role + peers").set_defaults(func=cmd_codesync_show)

    role = cssub.add_parser("role", parents=[common], help="get or set this device role")
    role.add_argument("role", nargs="?", choices=["dev", "client"], help="omit to print current role")
    role.set_defaults(func=cmd_codesync_role)

    peers = cssub.add_parser("peers", parents=[common], help="list/add/remove/update peers")
    peers.add_argument("peers_op", choices=["list", "add", "remove", "update"])
    peers.add_argument("--name")
    peers.add_argument("--host")
    peers.add_argument("--peer-port", dest="peer_port", type=int, help="peer port (default 59000)")
    peers.add_argument("--role", choices=["dev", "client"])
    peers.add_argument("--id")
    peers.set_defaults(func=cmd_codesync_peers)

    dist = cssub.add_parser("distribute", parents=[common],
                            help="dev: start/stop distributing code (running service only)")
    dist.add_argument("state", choices=["on", "off"])
    dist.set_defaults(func=cmd_codesync_distribute)

    skip = cssub.add_parser("skip-update", parents=[common],
                            help="client: temporarily reject code (running service only)")
    skip.add_argument("state", choices=["on", "off"])
    skip.set_defaults(func=cmd_codesync_skip_update)

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    func = getattr(args, "func", None)
    if func is None:
        parser.print_help()
        return 1
    try:
        return func(args) or 0
    except Exception as e:
        _emit({"success": False, "error": str(e)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
