# -*- coding: utf-8 -*-
"""Wire V11.2C remaining RPC routes."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "rpc_routes"


def write_code_sync_routes() -> None:
    content = '''# -*- coding: utf-8 -*-
"""RPC Routes for code_sync."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.callmodule.rpc_routes.route_names as rn
import pycore.callmodule.services.code_sync_service as cs
from pycore.callmodule.services.code_sync_service import (
    ChangesRequest,
    DistributeRequest,
    DownloadRequest,
    InitialSyncRequest,
    PeerAddRequest,
    PeerConfigRequest,
    PeerRemoveRequest,
    PeerUpdateRequest,
    RegisterRequest,
    RoleRequest,
    SkipUpdateRequest,
)


def register_code_sync_routes(server):
    async def _call(coro):
        return await coro

    routes = [
        (rn.UI_CODE_SYNC_PING, lambda p: cs.ping()),
        (rn.UI_CODE_SYNC_GET_STATUS, lambda p: cs.get_status()),
        (rn.UI_CODE_SYNC_PEER_STATUS, lambda p: cs.peer_status()),
        (rn.UI_CODE_SYNC_PEER_CONFIG, lambda p: cs.peer_config(PeerConfigRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_PEER_HEARTBEAT, lambda p: cs.peer_heartbeat(p or {})),
        (rn.UI_CODE_SYNC_GET_PEERS, lambda p: cs.get_peers()),
        (rn.UI_CODE_SYNC_GET_SYNC_SETTINGS, lambda p: cs.get_sync_settings()),
        (rn.UI_CODE_SYNC_SET_SYNC_SETTINGS, lambda p: cs.set_sync_settings(p or {})),
        (rn.UI_CODE_SYNC_RESET_SYNC_SETTINGS, lambda p: cs.reset_sync_settings()),
        (rn.UI_CODE_SYNC_GET_SYNC_LOGS, lambda p: cs.get_sync_logs(int((p or {}).get("limit") or 100))),
        (rn.UI_CODE_SYNC_GET_FILE_TREE, lambda p: cs.get_file_tree()),
        (rn.UI_CODE_SYNC_GET_PEER_FILE_TREE, lambda p: cs.get_peer_file_tree(str((p or {}).get("peer_id") or ""))),
        (rn.UI_CODE_SYNC_ADD_PEER, lambda p: cs.add_peer(PeerAddRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_REMOVE_PEER, lambda p: cs.remove_peer(PeerRemoveRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_UPDATE_PEER, lambda p: cs.update_peer(PeerUpdateRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_ROLE, lambda p: cs.set_role(RoleRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_DISTRIBUTE, lambda p: cs.set_distribute(DistributeRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_SKIP_UPDATE, lambda p: cs.set_skip_update(SkipUpdateRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_DISCOVER, lambda p: cs.discover()),
        (rn.UI_CODE_SYNC_SET_SERVER_MODE, lambda p: cs.set_server_mode()),
        (rn.UI_CODE_SYNC_SET_CLIENT_MODE, lambda p: cs.set_client_mode()),
        (rn.UI_CODE_SYNC_STOP_SYNC, lambda p: cs.stop_sync()),
        (rn.UI_CODE_SYNC_DOWNLOAD_FILE, lambda p: cs.download_file(DownloadRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_TOGGLE_BACKUP, lambda p: cs.toggle_backup(p or {})),
    ]

    for route_name, fn in routes:
        async def handler(params, request_id, context, _fn=fn):
            return await _fn(params)

        server.route(name=route_name, handler=handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered code_sync RPC routes")


__all__ = ["register_code_sync_routes"]
'''
    (ROOT / "code_sync_routes.py").write_text(content, encoding="utf-8")


if __name__ == "__main__":
    write_code_sync_routes()
    print("wired C batch")
