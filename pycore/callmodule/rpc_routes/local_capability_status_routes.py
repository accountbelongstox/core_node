# -*- coding: utf-8 -*-
"""RPC Routes for capability_status — native UI path (no router.invoke)."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_CAPABILITY_STATUS_STATUS,
    UI_CAPABILITY_STATUS_INFO,
    UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
    UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
    UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
)
import pycore.callmodule.services.capability_service as cap


def register_local_capability_status_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(cap.status)

    server.route(name=UI_CAPABILITY_STATUS_STATUS, handler=status_handler, sync=False)

    async def info_handler(params, request_id, context):
        return await asyncio.to_thread(cap.info)

    server.route(name=UI_CAPABILITY_STATUS_INFO, handler=info_handler, sync=False)

    async def open_directory_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(cap.open_directory, str(params.get("key") or ""))

    server.route(
        name=UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
        handler=open_directory_handler,
        sync=False,
    )

    async def get_capability_settings_handler(params, request_id, context):
        return await asyncio.to_thread(cap.get_capability_settings)

    server.route(
        name=UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
        handler=get_capability_settings_handler,
        sync=False,
    )

    async def post_capability_settings_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            cap.post_capability_settings,
            str(params.get("capability") or ""),
            params.get("priority"),
            params.get("options"),
        )

    server.route(
        name=UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
        handler=post_capability_settings_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered capability_status RPC routes")


__all__ = ["register_local_capability_status_routes"]
