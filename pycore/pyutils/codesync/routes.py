# -*- coding: utf-8 -*-
"""Canonical Code Sync route names: RPC routes (UI, panel, CLI) and the
peer-protocol paths served under /code-sync."""

from pycore.pyfoundations.network_constants import HTTP_API_PREFIX
from pycore.pyfoundations.rpc_route_contract import rpc_route_contract

# ---- RPC routes (dispatcher table under /api; paths from the RPC contract) #
RPC_PING = rpc_route_contract.path("codeSyncPing")
RPC_GET_STATUS = rpc_route_contract.path("codeSyncGetStatus")
RPC_GET_PEERS = rpc_route_contract.path("codeSyncGetPeers")
RPC_GET_SYNC_SETTINGS = rpc_route_contract.path("codeSyncGetSyncSettings")
RPC_SET_SYNC_SETTINGS = rpc_route_contract.path("codeSyncSetSyncSettings")
RPC_RESET_SYNC_SETTINGS = rpc_route_contract.path("codeSyncResetSyncSettings")
RPC_GET_SYNC_LOGS = rpc_route_contract.path("codeSyncGetSyncLogs")
RPC_RUNTIME_GET = rpc_route_contract.path("codeSyncRuntimeGet")
RPC_GET_FILE_TREE = rpc_route_contract.path("codeSyncGetFileTree")
RPC_GET_PEER_FILE_TREE = rpc_route_contract.path("codeSyncGetPeerFileTree")
RPC_ADD_PEER = rpc_route_contract.path("codeSyncAddPeer")
RPC_REMOVE_PEER = rpc_route_contract.path("codeSyncRemovePeer")
RPC_UPDATE_PEER = rpc_route_contract.path("codeSyncUpdatePeer")
RPC_SET_ROLE = rpc_route_contract.path("codeSyncSetRole")
RPC_SET_DISTRIBUTE = rpc_route_contract.path("codeSyncSetDistribute")
RPC_SET_SKIP_UPDATE = rpc_route_contract.path("codeSyncSetSkipUpdate")
RPC_DISCOVER = rpc_route_contract.path("codeSyncDiscover")
RPC_APPLY_PENDING_UPDATE = rpc_route_contract.path("codeSyncApplyPendingUpdate")
RPC_CLEAR_PENDING_UPDATE = rpc_route_contract.path("codeSyncClearPendingUpdate")
RPC_SERVICE_STATUS = rpc_route_contract.path("codeSyncServiceStatus")
RPC_SERVICE_RESTART = rpc_route_contract.path("codeSyncServiceRestart")
RPC_SERVICE_REINSTALL = rpc_route_contract.path("codeSyncServiceReinstall")


def rpc_path(route: str) -> str:
    """Absolute HTTP path of one RPC route."""
    return f"{HTTP_API_PREFIX}/{route}"


# ---- /code-sync paths: standalone panel and peer protocol ---------------- #
HOST_ROOT_PATH = "/"
HOST_FAVICON_PATH = "/favicon.ico"
BASE_PATH = "/code-sync"
PANEL_PATH = f"{BASE_PATH}/"
ASSETS_PATH_PREFIX = f"{BASE_PATH}/assets/"
ROUTES_PATH = f"{BASE_PATH}/routes"
PEER_STATUS_PATH = f"{BASE_PATH}/peer/status"
PEER_CONFIG_PATH = f"{BASE_PATH}/peer/config"
PEER_HEARTBEAT_PATH = f"{BASE_PATH}/peer/heartbeat"
FILE_TREE_PATH = f"{BASE_PATH}/file-tree"
EVENTS_FRAME_PATH = f"{BASE_PATH}/events/frame"
WORKSPACE_PATH = f"{BASE_PATH}/workspace"
WORKSPACE_FILES_PATH = f"{WORKSPACE_PATH}/files"
WORKSPACE_FILE_PATH = f"{WORKSPACE_PATH}/file"
WORKSPACE_DOCUMENTS_PATH = f"{WORKSPACE_PATH}/documents"
WORKSPACE_LATEST_DOCUMENT_PATH = f"{WORKSPACE_DOCUMENTS_PATH}/latest"

# The panel POSTs every call (empty JSON body for reads) to these RPC paths.
PANEL_API_ROUTES = {
    "status": rpc_path(RPC_GET_STATUS),
    "peers": rpc_path(RPC_GET_PEERS),
    "logs": rpc_path(RPC_GET_SYNC_LOGS),
    "role": rpc_path(RPC_SET_ROLE),
    "distribute": rpc_path(RPC_SET_DISTRIBUTE),
    "skipUpdate": rpc_path(RPC_SET_SKIP_UPDATE),
    "applyPendingUpdate": rpc_path(RPC_APPLY_PENDING_UPDATE),
    "clearPendingUpdate": rpc_path(RPC_CLEAR_PENDING_UPDATE),
}
