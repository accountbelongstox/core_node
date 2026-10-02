# -*- coding: utf-8 -*-
"""The one Code Sync route table: RPC routes (UI, panel, CLI), the standalone
panel and the /code-sync peer protocol. Served by the full pycore RPC server
and by the codesync-only host alike.

Frozen: Code Sync is retired; repositories sync with `gitsync`. Not updated by refactors unless explicitly requested.
"""

import pycore.pyutils.codesync.routes as cs_routes
import pycore.pyutils.codesync.service as cs
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyutils.codesync.manager import code_sync_manager
from pycore.pyutils.codesync.panel import load_panel_asset, load_panel_index
from pycore.pyutils.rpc.http.client_key_request import request_client_key


fastapi_module = get_third_package_fastapi()
Request = fastapi_module.Request
JSONResponse = fastapi_module.responses.JSONResponse
Response = fastapi_module.responses.Response
HTMLResponse = fastapi_module.responses.HTMLResponse

RPC_ROUTES = (
    (cs_routes.RPC_PING, cs.ping),
    (cs_routes.RPC_GET_STATUS, cs.get_status),
    (cs_routes.RPC_GET_PEERS, cs.get_peers),
    (cs_routes.RPC_GET_SYNC_SETTINGS, cs.get_sync_settings),
    (cs_routes.RPC_SET_SYNC_SETTINGS, cs.set_sync_settings),
    (cs_routes.RPC_RESET_SYNC_SETTINGS, cs.reset_sync_settings),
    (cs_routes.RPC_GET_SYNC_LOGS, cs.get_sync_logs),
    (cs_routes.RPC_RUNTIME_GET, cs.get_ui_runtime),
    (cs_routes.RPC_GET_FILE_TREE, cs.get_file_tree),
    (cs_routes.RPC_GET_PEER_FILE_TREE, cs.get_peer_file_tree),
    (cs_routes.RPC_ADD_PEER, cs.add_peer),
    (cs_routes.RPC_REMOVE_PEER, cs.remove_peer),
    (cs_routes.RPC_UPDATE_PEER, cs.update_peer),
    (cs_routes.RPC_SET_ROLE, cs.set_role),
    (cs_routes.RPC_SET_DISTRIBUTE, cs.set_distribute),
    (cs_routes.RPC_SET_SKIP_UPDATE, cs.set_skip_update),
    (cs_routes.RPC_DISCOVER, cs.discover),
    (cs_routes.RPC_APPLY_PENDING_UPDATE, cs.apply_pending_update),
    (cs_routes.RPC_CLEAR_PENDING_UPDATE, cs.clear_pending_update),
    (cs_routes.RPC_SERVICE_STATUS, cs.get_service_status),
    (cs_routes.RPC_SERVICE_RESTART, cs.restart_service),
    (cs_routes.RPC_SERVICE_REINSTALL, cs.reinstall_service),
)


def _workspace_response(result):
    content = dict(result or {})
    status_code = int(content.pop("status_code", 200) or 200)
    headers = {"ETag": str(content["etag"])} if content.get("etag") else {}
    return JSONResponse(content, status_code=status_code, headers=headers)


def register_code_sync_host_root(server):
    """Codesync-only host: the panel at "/" (a light client answers a small
    identity document instead) and an empty favicon."""

    async def host_root():
        if code_sync_manager.light and code_sync_manager.get_role() == "client":
            return JSONResponse({"service": "code-sync", "light": True,
                                 "role": code_sync_manager.get_role(), "reachable": True})
        return HTMLResponse(load_panel_index())

    async def host_favicon():
        return Response(status_code=204, media_type="image/x-icon")

    server.app.add_api_route(cs_routes.HOST_ROOT_PATH, host_root, methods=["GET"], name="code_sync_host_root")
    server.app.add_api_route(cs_routes.HOST_FAVICON_PATH, host_favicon, methods=["GET"], name="code_sync_host_favicon")


def register_code_sync_routes(server):
    body = fastapi_module.Body(default={})
    workspace_file_path = fastapi_module.Query(default="", alias="path")

    async def panel_index():
        return HTMLResponse(load_panel_index())

    async def panel_asset(name: str):
        asset = load_panel_asset(name)
        if asset is None:
            return JSONResponse({"detail": "Not found"}, status_code=404)
        data, content_type = asset
        return Response(content=data, media_type=content_type)

    async def panel_routes():
        return JSONResponse(cs_routes.PANEL_API_ROUTES)

    async def get_peer_status():
        return await await_bus_task(cs.peer_status, thread_name="CodeSyncPeerStatusRoute")

    async def receive_peer_config(payload=body):
        return await await_bus_task(cs.peer_config, payload, thread_name="CodeSyncPeerConfigRoute")

    async def receive_peer_heartbeat(request: Request, payload=body):
        client = getattr(request, "client", None)
        return await await_bus_task(
            cs.peer_heartbeat,
            payload,
            client_ip=getattr(client, "host", None),
            thread_name="CodeSyncPeerHeartbeatRoute",
        )

    async def get_file_tree():
        return await await_bus_task(cs.get_file_tree, thread_name="CodeSyncFileTreeRoute")

    async def receive_frame(payload=body):
        result, status_code = await await_bus_task(cs.receive_frame, payload, thread_name="CodeSyncFrameRoute")
        return JSONResponse(result, status_code=status_code)

    async def get_workspace_capabilities(request: Request):
        return _workspace_response(await await_bus_task(
            cs.workspace_capabilities,
            await request_client_key(request),
            thread_name="CodeSyncWorkspaceCapabilitiesRoute",
        ))

    async def list_workspace_files(
        request: Request,
        cursor: str = "",
        limit: int = 1000,
        include_hash: bool = False,
    ):
        return _workspace_response(await await_bus_task(
            cs.workspace_list_files,
            await request_client_key(request),
            cursor,
            limit,
            include_hash,
            thread_name="CodeSyncWorkspaceFilesRoute",
        ))

    async def read_workspace_file(request: Request, file_path: str = workspace_file_path):
        return _workspace_response(await await_bus_task(
            cs.workspace_read_file,
            await request_client_key(request),
            file_path,
            thread_name="CodeSyncWorkspaceReadFileRoute",
        ))

    async def write_workspace_file(request: Request, file_path: str = workspace_file_path, payload=body):
        return _workspace_response(await await_bus_task(
            cs.workspace_write_file,
            await request_client_key(request),
            file_path,
            payload,
            if_match=str(request.headers.get("if-match") or ""),
            if_none_match=str(request.headers.get("if-none-match") or ""),
            thread_name="CodeSyncWorkspaceWriteFileRoute",
        ))

    async def write_workspace_document(request: Request, payload=body):
        return _workspace_response(await await_bus_task(
            cs.workspace_write_document,
            await request_client_key(request),
            payload,
            thread_name="CodeSyncWorkspaceWriteDocumentRoute",
        ))

    async def get_latest_workspace_document(request: Request):
        return _workspace_response(await await_bus_task(
            cs.workspace_latest_document,
            await request_client_key(request),
            thread_name="CodeSyncWorkspaceLatestDocumentRoute",
        ))

    server.register_routes(RPC_ROUTES, group="code_sync")
    raw_routes = (
        (cs_routes.BASE_PATH, panel_index, "GET", "code_sync_panel"),
        (cs_routes.PANEL_PATH, panel_index, "GET", "code_sync_panel_slash"),
        (f"{cs_routes.ASSETS_PATH_PREFIX}{{name}}", panel_asset, "GET", "code_sync_panel_asset"),
        (cs_routes.ROUTES_PATH, panel_routes, "GET", "code_sync_panel_routes"),
        (cs_routes.PEER_STATUS_PATH, get_peer_status, "GET", "code_sync_peer_status"),
        (cs_routes.PEER_CONFIG_PATH, receive_peer_config, "POST", "code_sync_peer_config"),
        (cs_routes.PEER_HEARTBEAT_PATH, receive_peer_heartbeat, "POST", "code_sync_peer_heartbeat"),
        (cs_routes.FILE_TREE_PATH, get_file_tree, "GET", "code_sync_file_tree"),
        (cs_routes.EVENTS_FRAME_PATH, receive_frame, "POST", "code_sync_frame"),
        (cs_routes.WORKSPACE_PATH, get_workspace_capabilities, "GET", "code_sync_workspace_capabilities"),
        (cs_routes.WORKSPACE_FILES_PATH, list_workspace_files, "GET", "code_sync_workspace_files"),
        (cs_routes.WORKSPACE_FILE_PATH, read_workspace_file, "GET", "code_sync_workspace_read_file"),
        (cs_routes.WORKSPACE_FILE_PATH, write_workspace_file, "PUT", "code_sync_workspace_write_file"),
        (cs_routes.WORKSPACE_DOCUMENTS_PATH, write_workspace_document, "POST", "code_sync_workspace_write_document"),
        (cs_routes.WORKSPACE_LATEST_DOCUMENT_PATH, get_latest_workspace_document, "GET", "code_sync_workspace_latest_document"),
    )
    for path, handler, method, name in raw_routes:
        server.app.add_api_route(path, handler, methods=[method], name=name)
