# -*- coding: utf-8 -*-
"""RPC Routes for heartbeat_workers."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_HEARTBEAT_WORKERS_STATUS,
    UI_HEARTBEAT_WORKERS_CONFIG,
)
import pycore.callmodule.services.heartbeat_workers_service as hb


def register_local_heartbeat_workers_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(hb.status)

    server.route(name=UI_HEARTBEAT_WORKERS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        if "enabled" not in params:
            return {"success": False, "error": "enabled is required"}
        return await asyncio.to_thread(
            hb.config,
            str(params.get("callback_name") or ""),
            bool(params["enabled"]),
        )

    server.route(name=UI_HEARTBEAT_WORKERS_CONFIG, handler=config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered heartbeat_workers RPC routes")


__all__ = ["register_local_heartbeat_workers_routes"]
