# -*- coding: utf-8 -*-
"""Canonical standalone HTTP paths for Code Sync."""


ROOT_PATH = "/"
FAVICON_PATH = "/favicon.ico"
BASE_PATH = "/code-sync"
PING_PATH = f"{BASE_PATH}/ping"
STATUS_PATH = f"{BASE_PATH}/status"
PEER_STATUS_PATH = f"{BASE_PATH}/peer/status"
PEER_CONFIG_PATH = f"{BASE_PATH}/peer/config"
PEER_HEARTBEAT_PATH = f"{BASE_PATH}/peer/heartbeat"
PEERS_PATH = f"{BASE_PATH}/peers"
PEERS_ADD_PATH = f"{PEERS_PATH}/add"
PEERS_REMOVE_PATH = f"{PEERS_PATH}/remove"
PEERS_UPDATE_PATH = f"{PEERS_PATH}/update"
SETTINGS_PATH = f"{BASE_PATH}/settings"
SETTINGS_RESET_PATH = f"{SETTINGS_PATH}/reset"
LOGS_PATH = f"{BASE_PATH}/logs"
FILE_TREE_PATH = f"{BASE_PATH}/file-tree"
PEER_FILE_TREE_PATH = f"{BASE_PATH}/peer-file-tree"
ROLE_PATH = f"{BASE_PATH}/role"
DISTRIBUTE_PATH = f"{BASE_PATH}/distribute"
SKIP_UPDATE_PATH = f"{BASE_PATH}/skip-update"
DISCOVER_PATH = f"{BASE_PATH}/discover"
SERVICE_STATUS_PATH = f"{BASE_PATH}/service/status"
SERVICE_RESTART_PATH = f"{BASE_PATH}/service/restart"
SERVICE_REINSTALL_PATH = f"{BASE_PATH}/service/reinstall"
EVENTS_PATH = f"{BASE_PATH}/events"
EVENTS_ACK_PATH = f"{EVENTS_PATH}/ack"
REGISTER_PATH = f"{BASE_PATH}/register"
INITIAL_SYNC_PATH = f"{BASE_PATH}/initial-sync"
CHANGES_PATH = f"{BASE_PATH}/changes"
DOWNLOAD_PATH = f"{BASE_PATH}/download"
TOGGLE_BACKUP_PATH = f"{BASE_PATH}/toggle-backup"
SET_SERVER_PATH = f"{BASE_PATH}/set-server"
SET_CLIENT_PATH = f"{BASE_PATH}/set-client"
STOP_PATH = f"{BASE_PATH}/stop"
UI_PING_PATH = "/api/ui/code_sync/ping"


__all__ = [
    "BASE_PATH",
    "CHANGES_PATH",
    "DISCOVER_PATH",
    "DISTRIBUTE_PATH",
    "DOWNLOAD_PATH",
    "EVENTS_ACK_PATH",
    "EVENTS_PATH",
    "FAVICON_PATH",
    "FILE_TREE_PATH",
    "INITIAL_SYNC_PATH",
    "LOGS_PATH",
    "PEERS_ADD_PATH",
    "PEERS_PATH",
    "PEERS_REMOVE_PATH",
    "PEERS_UPDATE_PATH",
    "PEER_CONFIG_PATH",
    "PEER_FILE_TREE_PATH",
    "PEER_HEARTBEAT_PATH",
    "PEER_STATUS_PATH",
    "PING_PATH",
    "REGISTER_PATH",
    "ROLE_PATH",
    "ROOT_PATH",
    "SERVICE_REINSTALL_PATH",
    "SERVICE_RESTART_PATH",
    "SERVICE_STATUS_PATH",
    "SETTINGS_PATH",
    "SETTINGS_RESET_PATH",
    "SET_CLIENT_PATH",
    "SET_SERVER_PATH",
    "SKIP_UPDATE_PATH",
    "STATUS_PATH",
    "STOP_PATH",
    "TOGGLE_BACKUP_PATH",
    "UI_PING_PATH",
]
