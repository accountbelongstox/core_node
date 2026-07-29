# -*- coding: utf-8 -*-
"""Code sync application service — RPC-facing sync control plane."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyutils.codesync.manager import get_code_sync_manager


def _p(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return params if isinstance(params, dict) else {}


async def ping() -> Dict[str, Any]:
    return {"status": "ok", "service": "code-sync"}


async def get_status() -> Dict[str, Any]:
    return get_code_sync_manager().get_status()


async def peer_status() -> Dict[str, Any]:
    try:
        return get_code_sync_manager().get_local_peer_status()
    except Exception as exc:  # noqa: BLE001
        return {"role": "client", "distributing": False, "error": str(exc)}


async def peer_config(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    peers = req.get("peers")
    if not isinstance(peers, list):
        return {"success": False, "error": "peers must be a list"}
    return get_code_sync_manager().apply_remote_config(
        peers,
        int(req.get("version") or 0),
        float(req.get("updated_at") or 0.0),
    )


async def peer_heartbeat(
    params: Optional[Dict[str, Any]] = None,
    *,
    client_ip: Optional[str] = None,
) -> Dict[str, Any]:
    body = _p(params)
    return get_code_sync_manager().receive_heartbeat(body, client_ip)


async def get_peers() -> Dict[str, Any]:
    return get_code_sync_manager().get_peers()


async def get_sync_settings() -> Dict[str, Any]:
    return get_code_sync_manager().get_sync_settings()


async def set_sync_settings(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return get_code_sync_manager().set_sync_settings(_p(params))


async def reset_sync_settings() -> Dict[str, Any]:
    return get_code_sync_manager().reset_sync_settings()


async def get_sync_logs(limit: int = 100) -> Dict[str, Any]:
    return get_code_sync_manager().get_sync_logs(int(limit or 100))


async def get_file_tree() -> Dict[str, Any]:
    return get_code_sync_manager().get_file_tree()


async def get_peer_file_tree(peer_id: str) -> Dict[str, Any]:
    peer_id = str(peer_id or "").strip()
    if not peer_id:
        return {"success": False, "error": "peer_id required"}
    return get_code_sync_manager().get_peer_file_tree(peer_id)


async def add_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    name = str(req.get("name") or "").strip()
    host = str(req.get("host") or "").strip()
    if not name or not host:
        return {"success": False, "error": "name and host required"}
    return get_code_sync_manager().add_peer(
        name,
        host,
        int(req.get("port") or 59000),
        str(req.get("role") or "client"),
    )


async def remove_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    peer_id = str(_p(params).get("id") or "").strip()
    if not peer_id:
        return {"success": False, "error": "id required"}
    return get_code_sync_manager().remove_peer(peer_id)


async def update_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    peer_id = str(req.get("id") or "").strip()
    if not peer_id:
        return {"success": False, "error": "id required"}
    fields = {k: v for k, v in req.items() if k != "id" and v is not None}
    return get_code_sync_manager().update_peer(peer_id, fields)


async def set_role(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    role = str(_p(params).get("role") or "client")
    return get_code_sync_manager().set_role(role)


async def set_distribute(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    enabled = bool(_p(params).get("enabled"))
    return get_code_sync_manager().set_distributing(enabled)


async def set_skip_update(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    enabled = bool(_p(params).get("enabled"))
    return get_code_sync_manager().set_skip_update(enabled)


async def discover() -> Dict[str, Any]:
    return get_code_sync_manager().discover()


async def set_server_mode() -> Dict[str, Any]:
    get_code_sync_manager().set_server_mode()
    return {"success": True, "message": "Switched to server mode"}


async def set_client_mode() -> Dict[str, Any]:
    get_code_sync_manager().set_client_mode()
    return {"success": True, "message": "Switched to client mode"}


async def stop_sync() -> Dict[str, Any]:
    get_code_sync_manager().stop()
    return {"success": True, "message": "Code sync stopped"}


async def register_client(
    params: Optional[Dict[str, Any]] = None,
    *,
    client_ip: str = "unknown",
) -> Dict[str, Any]:
    manager = get_code_sync_manager()
    if not manager.is_server_mode():
        return {"success": False, "error": "Not in server mode", "status_code": 503}
    server = manager.get_server()
    if not server:
        return {"success": False, "error": "Server not available", "status_code": 503}

    client_id = str(_p(params).get("client_id") or "").strip()
    if not client_id:
        return {"success": False, "error": "client_id required"}
    needs_initial_sync = server.register_client(client_id, client_ip or "unknown")
    return {
        "success": True,
        "needs_initial_sync": needs_initial_sync,
        "message": f"Client registered: {client_id}",
    }


async def initial_sync(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    manager = get_code_sync_manager()
    if not manager.is_server_mode():
        return {"success": False, "error": "Not in server mode", "status_code": 503}
    server = manager.get_server()
    if not server:
        return {"success": False, "error": "Server not available", "status_code": 503}

    client_id = str(_p(params).get("client_id") or "").strip()
    if not client_id:
        return {"success": False, "error": "client_id required"}
    files = server.get_initial_sync_files(client_id)
    return {"success": True, "files": files}


async def get_changes(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    manager = get_code_sync_manager()
    if not manager.is_server_mode():
        return {"success": False, "error": "Not in server mode", "status_code": 503}
    server = manager.get_server()
    if not server:
        return {"success": False, "error": "Server not available", "status_code": 503}

    req = _p(params)
    client_id = str(req.get("client_id") or "").strip()
    if not client_id:
        return {"success": False, "error": "client_id required"}
    received_count = int(req.get("received_count") or 0)
    skipped_count = int(req.get("skipped_count") or 0)
    if received_count > 0 or skipped_count > 0:
        server.update_client_stats(
            client_id,
            received_count=received_count,
            skipped_count=skipped_count,
        )
    files = server.get_changed_files(client_id)
    return {"success": True, "files": files}


async def download_file(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    manager = get_code_sync_manager()
    if not manager.is_server_mode():
        return {"success": False, "error": "Not in server mode", "status_code": 503}
    server = manager.get_server()
    if not server:
        return {"success": False, "error": "Server not available", "status_code": 503}

    normalized = str(_p(params).get("file_path") or "").replace("\\", "/")
    if not normalized:
        return {"success": False, "error": "file_path required"}

    base = Path(server.root_dir).resolve()
    try:
        file_path = (base / normalized).resolve()
    except Exception:  # noqa: BLE001
        return {"success": False, "error": "Invalid path", "status_code": 400}
    if file_path != base and base not in file_path.parents:
        return {"success": False, "error": "Invalid path", "status_code": 400}
    if not file_path.is_file():
        return {"success": False, "error": f"File not found: {normalized}", "status_code": 404}

    raw = file_path.read_bytes()
    return {
        "success": True,
        "file_path": normalized,
        "content_base64": base64.b64encode(raw).decode("ascii"),
        "bytes": len(raw),
    }


async def toggle_backup(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    manager = get_code_sync_manager()
    if not manager.is_client_mode():
        return {"success": False, "error": "Not in client mode", "status_code": 503}
    client = manager.get_client()
    if not client:
        return {"success": False, "error": "Client not available", "status_code": 503}
    enabled = bool(_p(params).get("enabled", True))
    client.enable_backup = enabled
    return {"success": True, "enabled": enabled}
