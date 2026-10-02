# -*- coding: utf-8 -*-
"""
The one headless pycore CLI (no UI required).

    python -m pycore.pyservice_cli config system get [--key K]
    python -m pycore.pyservice_cli config system set (--key K --value V | --json '{...}')
    python -m pycore.pyservice_cli config codesync run [--host H] [--port P] [--light]
    python -m pycore.pyservice_cli config codesync show
    python -m pycore.pyservice_cli config codesync role [dev|client]
    python -m pycore.pyservice_cli config codesync peers list|add|remove|update ...
    python -m pycore.pyservice_cli config codesync distribute (on|off)
    python -m pycore.pyservice_cli config codesync skip-update (on|off)

HTTP-first, file-fallback: while the local service (full pycore or the
codesync-only host started by `codesync run`) answers on the port, changes go
through its RPC routes and apply live; while it is stopped, persistent
settings (system settings, code-sync role/peers) are written to their files.
Runtime-only toggles (distribute / skip-update) require the running service.
Output is one JSON document on stdout; errors carry codes, not prose.
"""

import argparse
import json
import signal
import sys
import time
from typing import Any, Dict, Optional

from pycore.callmodule.rpc_routes.code_sync_routes import (
    register_code_sync_host_root,
    register_code_sync_routes,
)
from pycore.callmodule.rpc_routes.route_names import (
    UI_USER_DATA_GET_SYSTEM_SETTINGS,
    UI_USER_DATA_SET_SYSTEM_SETTINGS,
)
from pycore.pyfoundations.network_constants import HTTP_BIND_HOST, HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.codesync.manager import code_sync_manager
from pycore.pyutils.codesync.peer_config import VALID_ROLES, PeerConfig, peer_configs
import pycore.pyutils.codesync.routes as cs_routes
from pycore.pyutils.common.http_client import HttpClient, RESPONSE_CONTROL, build_http_base_url
from pycore.pyutils.common.strtools.normalization import to_bool
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.rpc.runner import HttpServerRunner

SYSTEM_SETTINGS_SECTION = "system_settings"
SERVICE_PROBE_TIMEOUT_SECONDS = 1.0
SERVICE_CALL_TIMEOUT_SECONDS = 4.0
SHUTDOWN_POLL_SECONDS = 0.5
http_client = HttpClient()


# --------------------------------------------------------------------------- #
# output + local RPC calls                                                     #
# --------------------------------------------------------------------------- #
def _emit(obj: Any) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False, indent=2, default=str) + "\n")


def _rpc(port: int, route: str, body: Optional[Dict[str, Any]] = None,
         timeout: float = SERVICE_CALL_TIMEOUT_SECONDS) -> Optional[Dict[str, Any]]:
    """POST one local RPC route; None when the service is not answering."""
    url = build_http_base_url(HTTP_LOOPBACK_HOST, port).rstrip("/") + cs_routes.rpc_path(route)
    try:
        response = http_client.post(url, json=body or {}, timeout=timeout, response=RESPONSE_CONTROL)
    except OSError:
        return None
    if response.status_code != 200:
        return {"success": False, "error": f"http_{response.status_code}"}
    try:
        payload = response.json()
    except ValueError:
        return {"success": False, "error": "response_not_json"}
    return payload if isinstance(payload, dict) else {"success": False, "error": "response_not_object"}


def _service_up(port: int) -> bool:
    return _rpc(port, cs_routes.RPC_PING, timeout=SERVICE_PROBE_TIMEOUT_SECONDS) is not None


def _result(source: str, result: Optional[Dict[str, Any]]) -> int:
    _emit({"source": source, "result": result})
    return 0 if result and result.get("success") else 1


def _parse_json_value(value: Optional[str]) -> Any:
    """A CLI string as typed JSON (true/1/{...}); plain text stays a string."""
    if value is None:
        return None
    try:
        return json.loads(value)
    except ValueError:
        return value


# --------------------------------------------------------------------------- #
# system settings                                                              #
# --------------------------------------------------------------------------- #
def cmd_system_get(args) -> int:
    data = _rpc(args.port, UI_USER_DATA_GET_SYSTEM_SETTINGS)
    source = "service" if data is not None else "file"
    settings = (data or {}).get("settings") if data is not None else user_data_store.get_section(SYSTEM_SETTINGS_SECTION)
    settings = settings or {}
    if args.key:
        _emit({"source": source, "key": args.key, "value": settings.get(args.key)})
    else:
        _emit({"source": source, "settings": settings})
    return 0


def cmd_system_set(args) -> int:
    if args.json:
        patch = _parse_json_value(args.json)
        if not isinstance(patch, dict):
            _emit({"success": False, "error": "json_object_required"})
            return 1
    elif args.key is not None:
        patch = {args.key: _parse_json_value(args.value)}
    else:
        _emit({"success": False, "error": "key_value_or_json_required"})
        return 1
    current = _rpc(args.port, UI_USER_DATA_GET_SYSTEM_SETTINGS)
    if current is None:
        saved = user_data_store.update_section(SYSTEM_SETTINGS_SECTION, patch)
        _emit({"source": "file", "success": True, "settings": saved})
        return 0
    # The service replaces the whole section: merge over the current one.
    merged = {**(current.get("settings") or {}), **patch}
    return _result("service", _rpc(args.port, UI_USER_DATA_SET_SYSTEM_SETTINGS, {"settings": merged}))


# --------------------------------------------------------------------------- #
# code sync                                                                    #
# --------------------------------------------------------------------------- #
def _offline_snapshot(cfg: PeerConfig):
    """Peer snapshot from the config file in the running service's shape: self
    reported separately and excluded from `peers`, every peer carrying the
    live-status keys with offline defaults."""
    me = {**cfg.get_self(), "light": False}
    peers = [
        {**p, "reachable": False, "last_seen": None, "status": None, "pending": False}
        for p in cfg.list_peers() if p.get("id") != me.get("id")
    ]
    return me, peers, cfg.version()


def cmd_codesync_run(args) -> int:
    """The codesync-only host: the shared RPC server serving the one Code Sync
    route table, plus the Code Sync manager. Resident until SIGINT/SIGTERM."""
    runner = HttpServerRunner(host=args.host, port=args.port)
    register_code_sync_routes(runner.server)
    register_code_sync_host_root(runner.server)
    code_sync_manager.start(light=True if args.light else None)
    runner.start()

    def request_stop(signum, _frame):
        THREAD_BUS.request_shutdown(reason=f"codesync host signal {signum}", execute_handlers=True)

    for name in ("SIGINT", "SIGTERM"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), request_stop)
    ColorPrint.green(f"[CodeSync] Host up (role={code_sync_manager.get_role()}, http=:{args.port})")
    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(SHUTDOWN_POLL_SECONDS)
    runner.stop()
    return 0


def cmd_codesync_show(args) -> int:
    data = _rpc(args.port, cs_routes.RPC_GET_PEERS)
    if data is not None:
        _emit({"source": "service", "self": data.get("self"),
               "peers": data.get("peers"), "version": data.get("version")})
        return 0
    me, peers, version = _offline_snapshot(peer_configs.for_port(args.port))
    _emit({"source": "file", "self": me, "peers": peers, "version": version})
    return 0


def cmd_codesync_role(args) -> int:
    up = _service_up(args.port)
    if not args.role:
        if up:
            data = _rpc(args.port, cs_routes.RPC_GET_PEERS) or {}
            _emit({"source": "service", "role": (data.get("self") or {}).get("role")})
        else:
            _emit({"source": "file", "role": peer_configs.for_port(args.port).get_role()})
        return 0
    if up:
        return _result("service", _rpc(args.port, cs_routes.RPC_SET_ROLE, {"role": args.role}))
    _emit({"source": "file", "success": True, "role": peer_configs.for_port(args.port).set_role(args.role)})
    return 0


def _peer_fields(args) -> Dict[str, Any]:
    fields = {"name": args.name, "host": args.host, "port": args.peer_port, "role": args.role}
    return {key: value for key, value in fields.items() if value is not None}


def cmd_codesync_peers(args) -> int:
    op = args.peers_op
    up = _service_up(args.port)
    cfg = None if up else peer_configs.for_port(args.port)

    if op == "list":
        if up:
            data = _rpc(args.port, cs_routes.RPC_GET_PEERS) or {}
            _emit({"source": "service", "peers": data.get("peers"), "self": data.get("self")})
        else:
            me, peers, _ = _offline_snapshot(cfg)
            _emit({"source": "file", "peers": peers, "self": me})
        return 0
    if op == "add":
        if not args.host:
            _emit({"success": False, "error": "host_required"})
            return 1
        peer = {"name": args.name or args.host, "host": args.host,
                "port": args.peer_port or PYCORE_HTTP_PORT, "role": args.role or "client"}
        if up:
            return _result("service", _rpc(args.port, cs_routes.RPC_ADD_PEER, peer))
        cfg.add_peer(peer["name"], peer["host"], peer["port"], peer["role"])
        _emit({"source": "file", "success": True, "peers": cfg.list_peers()})
        return 0
    if not args.id:
        _emit({"success": False, "error": "id_required"})
        return 1
    if op == "remove":
        if up:
            return _result("service", _rpc(args.port, cs_routes.RPC_REMOVE_PEER, {"id": args.id}))
        removed = cfg.remove_peer(args.id)
        _emit({"source": "file", "success": removed, "peers": cfg.list_peers()})
        return 0 if removed else 1
    fields = _peer_fields(args)
    if up:
        return _result("service", _rpc(args.port, cs_routes.RPC_UPDATE_PEER, {"id": args.id, **fields}))
    updated = cfg.update_peer(args.id, fields)
    _emit({"source": "file", "success": updated is not None, "peer": updated})
    return 0 if updated is not None else 1


def _runtime_toggle(args, route: str) -> int:
    """distribute / skip-update are runtime state: the service must be running."""
    if not _service_up(args.port):
        _emit({"success": False, "error": "service_not_running", "port": args.port})
        return 1
    return _result("service", _rpc(args.port, route, {"enabled": to_bool(args.state)}))


def cmd_codesync_distribute(args) -> int:
    return _runtime_toggle(args, cs_routes.RPC_SET_DISTRIBUTE)


def cmd_codesync_skip_update(args) -> int:
    return _runtime_toggle(args, cs_routes.RPC_SET_SKIP_UPDATE)


# --------------------------------------------------------------------------- #
# parser                                                                       #
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    # --port is attached to every leaf so it may follow the subcommand.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--port", type=int, default=PYCORE_HTTP_PORT,
                        help="local service port (default 59000)")

    parser = argparse.ArgumentParser(prog="pyservice config",
                                     description="Headless pycore configuration and the Code Sync host.")
    top = parser.add_subparsers(dest="group", required=True)
    config = top.add_parser("config", help="configuration commands")
    domains = config.add_subparsers(dest="domain", required=True)

    system = domains.add_parser("system", help="system settings (theme, lang, accent, ...)")
    system_actions = system.add_subparsers(dest="action", required=True)
    system_get = system_actions.add_parser("get", parents=[common], help="print system settings")
    system_get.add_argument("--key", help="print only this key")
    system_get.set_defaults(func=cmd_system_get)
    system_set = system_actions.add_parser("set", parents=[common], help="set settings (--key/--value or --json)")
    system_set.add_argument("--key")
    system_set.add_argument("--value")
    system_set.add_argument("--json", help='JSON object, e.g. {"theme":"light","lang":"zh"}')
    system_set.set_defaults(func=cmd_system_set)

    codesync = domains.add_parser("codesync", help="code-sync host / role / peers / distribute / skip-update")
    actions = codesync.add_subparsers(dest="action", required=True)
    run = actions.add_parser("run", parents=[common], help="start the codesync-only host")
    run.add_argument("--host", default=HTTP_BIND_HOST, help="bind host")
    run.add_argument("--light", action="store_true",
                     help="light client: mesh-only, no file receive/serve, no tree scan")
    run.set_defaults(func=cmd_codesync_run)
    actions.add_parser("show", parents=[common], help="show role + peers").set_defaults(func=cmd_codesync_show)
    role = actions.add_parser("role", parents=[common], help="get or set this device role")
    role.add_argument("role", nargs="?", choices=VALID_ROLES, help="omit to print the current role")
    role.set_defaults(func=cmd_codesync_role)
    peers = actions.add_parser("peers", parents=[common], help="list/add/remove/update peers")
    peers.add_argument("peers_op", choices=["list", "add", "remove", "update"])
    peers.add_argument("--name")
    peers.add_argument("--host")
    peers.add_argument("--peer-port", dest="peer_port", type=int, help="peer port (default 59000)")
    peers.add_argument("--role", choices=VALID_ROLES)
    peers.add_argument("--id")
    peers.set_defaults(func=cmd_codesync_peers)
    distribute = actions.add_parser("distribute", parents=[common],
                                    help="dev: start/stop distributing code (running service only)")
    distribute.add_argument("state", choices=["on", "off"])
    distribute.set_defaults(func=cmd_codesync_distribute)
    skip = actions.add_parser("skip-update", parents=[common],
                              help="client: temporarily reject code (running service only)")
    skip.add_argument("state", choices=["on", "off"])
    skip.set_defaults(func=cmd_codesync_skip_update)
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
