# -*- coding: utf-8 -*-
"""HTTP routes for Code Sync."""

import asyncio
import time

import pycore.callmodule.rpc_routes.route_names as rn
import pycore.pyutils.codesync.service as cs
from pycore.pyfoundations.http_sse import (
    SSE_CONTENT_TYPE,
    SSE_KEEP_ALIVE,
    SSE_RESPONSE_HEADERS,
    encode_sse_event,
)
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyfoundations.pygvar import PYCORE_HTTP_PORT
from pycore.pyutils.codesync.sse_transport import (
    SSE_ACK_PATH,
    SSE_EVENT_NAME,
    SSE_KEEP_ALIVE_SECONDS,
    SSE_STREAM_PATH,
    code_sync_sse_broker,
)


fastapi_module = get_third_package_fastapi()


def register_code_sync_routes(server):
    streaming_response_type = fastapi_module.responses.StreamingResponse
    ack_body = fastapi_module.Body(default={})

    def get_sync_logs(params, _request_id, _context):
        return cs.get_sync_logs(int(params.get("limit") or 100))

    def get_peer_file_tree(params, _request_id, _context):
        return cs.get_peer_file_tree(str(params.get("peer_id") or ""))

    async def stream_frames(
        request: fastapi_module.Request,
        client_id: str,
        since_frame: str = "",
        client_port: int = PYCORE_HTTP_PORT,
    ):
        normalized_client_id = str(client_id or "").strip()
        source_host = str(request.client.host if request.client else "").strip()
        aliases = (source_host, f"{source_host}:{int(client_port or 0)}")

        async def event_stream():
            cursor = str(since_frame or "").strip()
            next_keep_alive = time.monotonic() + SSE_KEEP_ALIVE_SECONDS
            session = code_sync_sse_broker.connect(normalized_client_id, aliases)
            try:
                while True:
                    code_sync_sse_broker.touch(normalized_client_id, session)
                    frame = code_sync_sse_broker.next_frame(normalized_client_id, cursor)
                    if frame is not None:
                        cursor = str(frame.get("frame_id") or "")
                        yield encode_sse_event(SSE_EVENT_NAME, frame, cursor)
                        next_keep_alive = time.monotonic() + SSE_KEEP_ALIVE_SECONDS
                    elif time.monotonic() >= next_keep_alive:
                        yield SSE_KEEP_ALIVE
                        next_keep_alive = time.monotonic() + SSE_KEEP_ALIVE_SECONDS
                    await asyncio.sleep(0.1)
            finally:
                code_sync_sse_broker.disconnect(normalized_client_id, session)

        return streaming_response_type(
            event_stream(),
            media_type=SSE_CONTENT_TYPE,
            headers=dict(SSE_RESPONSE_HEADERS),
        )

    async def acknowledge_frame(payload=ack_body):
        result, status = code_sync_sse_broker.acknowledge_payload(payload)
        return fastapi_module.responses.JSONResponse(
            result,
            status_code=status,
        )

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
    server.app.add_api_route(
        SSE_STREAM_PATH,
        stream_frames,
        methods=["GET"],
        name="code_sync_sse_stream",
    )
    server.app.add_api_route(
        SSE_ACK_PATH,
        acknowledge_frame,
        methods=["POST"],
        name="code_sync_sse_ack",
    )
