# -*- coding: utf-8 -*-
"""HTTP routes for Code Sync."""

import pycore.callmodule.rpc_routes.route_names as rn
import pycore.pyutils.codesync.service as cs
from pycore.pyfoundations.http_sse import (
    SSE_CONTENT_TYPE,
    SSE_RESPONSE_HEADERS,
)
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
import pycore.pyutils.codesync.routes as code_sync_http_routes
from pycore.pyutils.codesync.sse_transport import (
    code_sync_sse_broker,
    iter_code_sync_reply_stream,
)


fastapi_module = get_third_package_fastapi()
Request = fastapi_module.Request


def register_code_sync_routes(server):
    streaming_response_type = fastapi_module.responses.StreamingResponse
    frame_body = fastapi_module.Body(default={})
    peer_config_body = fastapi_module.Body(default={})
    peer_heartbeat_body = fastapi_module.Body(default={})
    pending_update_body = fastapi_module.Body(default={})
    workspace_file_body = fastapi_module.Body(default={})
    workspace_document_body = fastapi_module.Body(default={})
    workspace_file_path = fastapi_module.Query(default="", alias="path")

    def get_sync_logs(params, _request_id, _context):
        return cs.get_sync_logs(
            int(params.get("page_size") or params.get("pageSize") or params.get("limit") or 100),
            int(params.get("page") or 1),
            str(params.get("since_revision") or params.get("sinceRevision") or ""),
        )

    def get_ui_runtime(params, _request_id, _context):
        return cs.get_ui_runtime(
            int(params.get("page") or 1),
            int(params.get("page_size") or params.get("pageSize") or 100),
            str(params.get("since_revision") or params.get("sinceRevision") or ""),
        )

    def get_peer_file_tree(params, _request_id, _context):
        return cs.get_peer_file_tree(str(params.get("peer_id") or ""))

    async def stream_frames(
        session_id: str,
        sender_id: str = "",
    ):
        normalized_session_id = str(session_id or "").strip()
        if not normalized_session_id:
            return fastapi_module.responses.JSONResponse(
                {"detail": "session_id required"},
                status_code=400,
            )

        return streaming_response_type(
            iter_code_sync_reply_stream(normalized_session_id),
            media_type=SSE_CONTENT_TYPE,
            headers=dict(SSE_RESPONSE_HEADERS),
        )

    async def receive_frame(payload=frame_body):
        manager = cs.get_code_sync_manager()
        result, status = code_sync_sse_broker.handle_frame_payload(
            payload,
            manager.push_receiver.handle_text,
        )
        return fastapi_module.responses.JSONResponse(
            result,
            status_code=status,
        )

    async def get_peer_status():
        return await await_bus_task(
            cs.peer_status,
            thread_name="CodeSyncPeerStatusRoute",
        )

    async def receive_peer_config(payload=peer_config_body):
        return await await_bus_task(
            cs.peer_config,
            payload,
            thread_name="CodeSyncPeerConfigRoute",
        )

    async def receive_peer_heartbeat(request: Request, payload=peer_heartbeat_body):
        client = getattr(request, "client", None)
        return await await_bus_task(
            cs.peer_heartbeat,
            payload,
            client_ip=getattr(client, "host", None),
            thread_name="CodeSyncPeerHeartbeatRoute",
        )

    async def apply_pending_update(payload=pending_update_body):
        return await await_bus_task(
            cs.apply_pending_update,
            payload,
            thread_name="CodeSyncApplyPendingUpdateRoute",
        )

    async def clear_pending_update(payload=pending_update_body):
        return await await_bus_task(
            cs.clear_pending_update,
            payload,
            thread_name="CodeSyncClearPendingUpdateRoute",
        )

    def workspace_response(result):
        content = dict(result or {})
        status_code = int(content.pop("status_code", 200) or 200)
        headers = {}
        if content.get("etag"):
            headers["ETag"] = str(content["etag"])
        if status_code == 401:
            headers["WWW-Authenticate"] = 'Bearer realm="codesync-workspace"'
        return fastapi_module.responses.JSONResponse(
            content,
            status_code=status_code,
            headers=headers,
        )

    async def get_workspace_capabilities(request: Request):
        result = await await_bus_task(
            cs.workspace_capabilities,
            str(request.headers.get("authorization") or ""),
            thread_name="CodeSyncWorkspaceCapabilitiesRoute",
        )
        return workspace_response(result)

    async def list_workspace_files(
        request: Request,
        cursor: str = "",
        limit: int = 1000,
        include_hash: bool = False,
    ):
        result = await await_bus_task(
            cs.workspace_list_files,
            str(request.headers.get("authorization") or ""),
            cursor,
            limit,
            include_hash,
            thread_name="CodeSyncWorkspaceFilesRoute",
        )
        return workspace_response(result)

    async def read_workspace_file(
        request: Request,
        file_path: str = workspace_file_path,
    ):
        result = await await_bus_task(
            cs.workspace_read_file,
            str(request.headers.get("authorization") or ""),
            file_path,
            thread_name="CodeSyncWorkspaceReadFileRoute",
        )
        return workspace_response(result)

    async def write_workspace_file(
        request: Request,
        file_path: str = workspace_file_path,
        payload=workspace_file_body,
    ):
        result = await await_bus_task(
            cs.workspace_write_file,
            str(request.headers.get("authorization") or ""),
            file_path,
            payload,
            if_match=str(request.headers.get("if-match") or ""),
            if_none_match=str(request.headers.get("if-none-match") or ""),
            thread_name="CodeSyncWorkspaceWriteFileRoute",
        )
        return workspace_response(result)

    async def write_workspace_document(
        request: Request,
        payload=workspace_document_body,
    ):
        result = await await_bus_task(
            cs.workspace_write_document,
            str(request.headers.get("authorization") or ""),
            payload,
            thread_name="CodeSyncWorkspaceWriteDocumentRoute",
        )
        return workspace_response(result)

    async def get_latest_workspace_document(request: Request):
        result = await await_bus_task(
            cs.workspace_latest_document,
            str(request.headers.get("authorization") or ""),
            thread_name="CodeSyncWorkspaceLatestDocumentRoute",
        )
        return workspace_response(result)

    routes = (
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
        (rn.UI_CODE_SYNC_RUNTIME_GET, get_ui_runtime),
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
        (rn.UI_CODE_SYNC_APPLY_PENDING_UPDATE, apply_pending_update),
        (rn.UI_CODE_SYNC_CLEAR_PENDING_UPDATE, clear_pending_update),
    )
    server.register_routes(routes, group="code_sync")
    server.app.add_api_route(
        code_sync_http_routes.EVENTS_PATH,
        stream_frames,
        methods=["GET"],
        name="code_sync_sse_stream",
    )
    server.app.add_api_route(
        code_sync_http_routes.EVENTS_FRAME_PATH,
        receive_frame,
        methods=["POST"],
        name="code_sync_sse_frame",
    )
    server.app.add_api_route(
        code_sync_http_routes.PEER_STATUS_PATH,
        get_peer_status,
        methods=["GET"],
        name="code_sync_peer_status",
    )
    server.app.add_api_route(
        code_sync_http_routes.PEER_CONFIG_PATH,
        receive_peer_config,
        methods=["POST"],
        name="code_sync_peer_config",
    )
    server.app.add_api_route(
        code_sync_http_routes.PEER_HEARTBEAT_PATH,
        receive_peer_heartbeat,
        methods=["POST"],
        name="code_sync_peer_heartbeat",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_PATH,
        get_workspace_capabilities,
        methods=["GET"],
        name="code_sync_workspace_capabilities",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_FILES_PATH,
        list_workspace_files,
        methods=["GET"],
        name="code_sync_workspace_files",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_FILE_PATH,
        read_workspace_file,
        methods=["GET"],
        name="code_sync_workspace_read_file",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_FILE_PATH,
        write_workspace_file,
        methods=["PUT"],
        name="code_sync_workspace_write_file",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_DOCUMENTS_PATH,
        write_workspace_document,
        methods=["POST"],
        name="code_sync_workspace_write_document",
    )
    server.app.add_api_route(
        code_sync_http_routes.WORKSPACE_LATEST_DOCUMENT_PATH,
        get_latest_workspace_document,
        methods=["GET"],
        name="code_sync_workspace_latest_document",
    )
