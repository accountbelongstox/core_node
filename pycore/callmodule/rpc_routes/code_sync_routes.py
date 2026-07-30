# -*- coding: utf-8 -*-
"""RPC routes for Code Sync."""

import pycore.callmodule.rpc_routes.route_names as rn
import pycore.pyutils.codesync.service as cs


def register_code_sync_routes(server):
    def get_sync_logs(params, _request_id, _context):
        return cs.get_sync_logs(int((params or {}).get("limit") or 100))

    def get_peer_file_tree(params, _request_id, _context):
        return cs.get_peer_file_tree(str((params or {}).get("peer_id") or ""))

    routes = (
        (rn.CODE_SYNC_PUSH_FRAME, cs.push_frame),
        (rn.UI_CODE_SYNC_PING, cs.ping),
        (rn.UI_CODE_SYNC_GET_STATUS, cs.get_status),
        (rn.UI_CODE_SYNC_PEER_STATUS, cs.peer_status),
        (rn.UI_CODE_SYNC_PEER_CONFIG, cs.peer_config),
        (rn.UI_CODE_SYNC_PEER_HEARTBEAT, cs.peer_heartbeat),
        (rn.UI_CODE_SYNC_GET_PEERS, cs.get_peers),
        (rn.UI_CODE_SYNC_GET_SYNC_SETTINGS, cs.get_sync_settings),
        (rn.UI_CODE_SYNC_SET_SYNC_SETTINGS, cs.set_sync_settings),
        (rn.UI_CODE_SYNC_RESET_SYNC_SETTINGS, cs.reset_sync_settings),
        (rn.UI_CODE_SYNC_GET_SYNC_LOGS, get_sync_logs),
        (rn.UI_CODE_SYNC_GET_FILE_TREE, cs.get_file_tree),
        (rn.UI_CODE_SYNC_GET_PEER_FILE_TREE, get_peer_file_tree),
        (rn.UI_CODE_SYNC_ADD_PEER, cs.add_peer),
        (rn.UI_CODE_SYNC_REMOVE_PEER, cs.remove_peer),
        (rn.UI_CODE_SYNC_UPDATE_PEER, cs.update_peer),
        (rn.UI_CODE_SYNC_SET_ROLE, cs.set_role),
        (rn.UI_CODE_SYNC_SET_DISTRIBUTE, cs.set_distribute),
        (rn.UI_CODE_SYNC_SET_SKIP_UPDATE, cs.set_skip_update),
        (rn.UI_CODE_SYNC_DISCOVER, cs.discover),
        (rn.UI_CODE_SYNC_SET_SERVER_MODE, cs.set_server_mode),
        (rn.UI_CODE_SYNC_SET_CLIENT_MODE, cs.set_client_mode),
        (rn.UI_CODE_SYNC_STOP_SYNC, cs.stop_sync),
        (rn.UI_CODE_SYNC_DOWNLOAD_FILE, cs.download_file),
        (rn.UI_CODE_SYNC_TOGGLE_BACKUP, cs.toggle_backup),
    )
    server.register_routes(routes, group="code_sync")

