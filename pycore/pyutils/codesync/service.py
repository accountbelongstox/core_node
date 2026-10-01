# -*- coding: utf-8 -*-
"""Public CodeSync service wrappers around CodeSyncManager."""

from __future__ import annotations

from typing import Any, Dict, Optional

import pycore.pyutils.codesync.routes as code_sync_routes
from pycore.pyfoundations.network_constants import PYCORE_HTTP_PORT
from pycore.pyutils.codesync.manager import code_sync_manager
from pycore.pyutils.codesync.service_ops import (
    run_service_op_detached,
    service_log_commands,
    service_status,
)
from pycore.pyutils.codesync.workspace_exchange import (
    DEFAULT_FILE_PAGE_SIZE,
    WorkspaceExchangeError,
    workspace_exchanges,
)
from pycore.pyutils.common.client_key_auth import ERROR_MISSING as CLIENT_KEY_ERROR_MISSING


def _p(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return params if isinstance(params, dict) else {}


def ping() -> Dict[str, Any]:
    return {"status": "ok", "service": "code-sync"}


def get_status() -> Dict[str, Any]:
    return code_sync_manager.get_status()


def peer_status() -> Dict[str, Any]:
    return code_sync_manager.get_local_peer_status()


def peer_config(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    peers = req.get("peers")
    if not isinstance(peers, list):
        return {"success": False, "error": "peers must be a list"}
    return code_sync_manager.apply_remote_config(
        peers,
        int(req.get("version") or 0),
        float(req.get("updated_at") or 0.0),
    )


def peer_heartbeat(
    params: Optional[Dict[str, Any]] = None,
    *,
    client_ip: Optional[str] = None,
) -> Dict[str, Any]:
    body = _p(params)
    return code_sync_manager.receive_heartbeat(body, client_ip)


def get_peers() -> Dict[str, Any]:
    return code_sync_manager.get_peers()


def get_sync_settings() -> Dict[str, Any]:
    return code_sync_manager.get_sync_settings()


def set_sync_settings(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return code_sync_manager.set_sync_settings(_p(params))


def reset_sync_settings() -> Dict[str, Any]:
    return code_sync_manager.reset_sync_settings()


def _page_size(req: Dict[str, Any]) -> int:
    return int(req.get("page_size") or req.get("pageSize") or req.get("limit") or 100)


def _since_revision(req: Dict[str, Any]) -> str:
    return str(req.get("since_revision") or req.get("sinceRevision") or "")


def get_sync_logs(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    return code_sync_manager.get_sync_logs(_page_size(req), int(req.get("page") or 1), _since_revision(req))


def get_ui_runtime(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    return code_sync_manager.get_ui_runtime(int(req.get("page") or 1), _page_size(req), _since_revision(req))


def get_file_tree() -> Dict[str, Any]:
    return code_sync_manager.get_file_tree()


def get_peer_file_tree(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    peer_id = str(_p(params).get("peer_id") or "").strip()
    if not peer_id:
        return {"success": False, "error": "peer_id required"}
    return code_sync_manager.get_peer_file_tree(peer_id)


def add_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    name = str(req.get("name") or "").strip()
    host = str(req.get("host") or "").strip()
    if not name or not host:
        return {"success": False, "error": "name and host required"}
    return code_sync_manager.add_peer(
        name,
        host,
        int(req.get("port") or PYCORE_HTTP_PORT),
        str(req.get("role") or "client"),
    )


def remove_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    peer_id = str(_p(params).get("id") or "").strip()
    if not peer_id:
        return {"success": False, "error": "id required"}
    return code_sync_manager.remove_peer(peer_id)


def update_peer(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    peer_id = str(req.get("id") or "").strip()
    if not peer_id:
        return {"success": False, "error": "id required"}
    fields = {k: v for k, v in req.items() if k != "id" and v is not None}
    return code_sync_manager.update_peer(peer_id, fields)


def set_role(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    role = str(_p(params).get("role") or "client")
    return code_sync_manager.set_role(role)


def set_distribute(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    enabled = bool(_p(params).get("enabled"))
    return code_sync_manager.set_distributing(enabled)


def set_skip_update(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    enabled = bool(_p(params).get("enabled"))
    return code_sync_manager.set_skip_update(enabled)


def discover() -> Dict[str, Any]:
    return code_sync_manager.discover()


def receive_frame(params: Optional[Dict[str, Any]] = None) -> tuple:
    """One DEV frame POSTed to this CLIENT; returns (result, http_status)."""
    return code_sync_manager.push_receiver.handle_frame_payload(_p(params))


def get_service_status() -> Dict[str, Any]:
    return service_status()


def restart_service() -> Dict[str, Any]:
    return _service_op("restart")


def reinstall_service() -> Dict[str, Any]:
    return _service_op("install")


def _service_op(op: str) -> Dict[str, Any]:
    """Detached + 1s-delayed, so this reply leaves before systemd stops the host."""
    ok, command, error = run_service_op_detached(op)
    result = {
        "success": ok,
        "op": op,
        "command": command,
        "log_commands": service_log_commands(),
    }
    if error:
        result["error"] = error
    return result


def apply_pending_update(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return code_sync_manager.apply_pending_update(
        str(_p(params).get("rel") or "").strip()
    )


def clear_pending_update(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return code_sync_manager.clear_pending_update(
        str(_p(params).get("rel") or "").strip()
    )


def _client_workspace(client_key: Dict[str, Any]):
    if not client_key.get("ok"):
        raise WorkspaceExchangeError(
            401,
            str(client_key.get("error_code") or CLIENT_KEY_ERROR_MISSING),
        )
    if not code_sync_manager.is_client_mode():
        raise WorkspaceExchangeError(503, "Workspace exchange is only available in client mode")
    if code_sync_manager.light:
        raise WorkspaceExchangeError(503, "Workspace exchange is unavailable in light mode")
    return workspace_exchanges.for_root(code_sync_manager.sync_target_root())


def _workspace_error(exc: WorkspaceExchangeError) -> Dict[str, Any]:
    return {
        "success": False,
        "error": exc.detail,
        "status_code": exc.status_code,
    }


def workspace_capabilities(client_key: Dict[str, Any]) -> Dict[str, Any]:
    try:
        result = _client_workspace(client_key).capabilities()
        result["routes"] = {
            "list_files": {
                "method": "GET",
                "path": code_sync_routes.WORKSPACE_FILES_PATH,
            },
            "read_file": {
                "method": "GET",
                "path": code_sync_routes.WORKSPACE_FILE_PATH,
                "query": ["path"],
            },
            "write_file": {
                "method": "PUT",
                "path": code_sync_routes.WORKSPACE_FILE_PATH,
                "query": ["path"],
                "body": ["content_base64", "content_sha256"],
            },
            "upload_document": {
                "method": "POST",
                "path": code_sync_routes.WORKSPACE_DOCUMENTS_PATH,
                "body": ["title", "content"],
            },
            "latest_document": {
                "method": "GET",
                "path": code_sync_routes.WORKSPACE_LATEST_DOCUMENT_PATH,
            },
        }
        return result
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)


def workspace_list_files(
    client_key: Dict[str, Any],
    cursor: str = "",
    limit: int = DEFAULT_FILE_PAGE_SIZE,
    include_hash: bool = False,
) -> Dict[str, Any]:
    try:
        return _client_workspace(client_key).list_files(cursor, limit, include_hash)
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)


def workspace_read_file(client_key: Dict[str, Any], file_path: str) -> Dict[str, Any]:
    try:
        return _client_workspace(client_key).read_file(file_path)
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)


def workspace_write_file(
    client_key: Dict[str, Any],
    file_path: str,
    params: Optional[Dict[str, Any]] = None,
    *,
    if_match: str = "",
    if_none_match: str = "",
) -> Dict[str, Any]:
    request = _p(params)
    try:
        return _client_workspace(client_key).write_file(
            file_path,
            request.get("content_base64"),
            content_sha256=str(request.get("content_sha256") or ""),
            if_match=if_match,
            if_none_match=if_none_match,
        )
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)


def workspace_write_document(
    client_key: Dict[str, Any],
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    request = _p(params)
    try:
        return _client_workspace(client_key).write_document(
            request.get("title"),
            request.get("content"),
        )
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)


def workspace_latest_document(client_key: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return _client_workspace(client_key).latest_document()
    except WorkspaceExchangeError as exc:
        return _workspace_error(exc)
