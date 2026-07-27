# -*- coding: utf-8 -*-
"""RPC Routes for capability_status — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_CAPABILITY_STATUS_STATUS,
    UI_CAPABILITY_STATUS_INFO,
    UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
    UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
    UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
)
from pycore.callmodule.routers_bak.local.capability_status_router import (
    status as cap_status,
    info as cap_info,
    open_directory,
    get_capability_settings,
    post_capability_settings,
    OpenDirRequest,
    CapabilitySettingsPatch,
)


def register_local_capability_status_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(cap_status)

    server.route(name=UI_CAPABILITY_STATUS_STATUS, handler=status_handler, sync=False)

    async def info_handler(params, request_id, context):
        return await asyncio.to_thread(cap_info)

    server.route(name=UI_CAPABILITY_STATUS_INFO, handler=info_handler, sync=False)

    async def open_directory_handler(params, request_id, context):
        params = params or {}
        req = OpenDirRequest(key=str(params.get("key") or ""))
        return await asyncio.to_thread(open_directory, req)

    server.route(
        name=UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
        handler=open_directory_handler,
        sync=False,
    )

    async def get_capability_settings_handler(params, request_id, context):
        return await asyncio.to_thread(get_capability_settings)

    server.route(
        name=UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
        handler=get_capability_settings_handler,
        sync=False,
    )

    async def post_capability_settings_handler(params, request_id, context):
        params = params or {}
        req = CapabilitySettingsPatch(
            capability=str(params.get("capability") or ""),
            priority=params.get("priority"),
            options=params.get("options"),
        )
        return await asyncio.to_thread(post_capability_settings, req)

    server.route(
        name=UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
        handler=post_capability_settings_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered capability_status RPC routes")


__all__ = ["register_local_capability_status_routes"]
