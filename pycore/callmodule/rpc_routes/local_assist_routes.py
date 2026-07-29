# -*- coding: utf-8 -*-
"""RPC Routes for assist."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_ASSIST_ASSIST_CONFIG,
    UI_ASSIST_ASSIST_CYCLE,
    UI_ASSIST_ASSIST_STATUS,
)
import pycore.callmodule.services.assist_service as assist


def register_local_assist_routes(server):
    async def assist_status_handler(params, request_id, context):
        params = params or {}
        include = params.get("include_laravel", True)
        return await asyncio.to_thread(assist.assist_status, bool(include))

    server.route(name=UI_ASSIST_ASSIST_STATUS, handler=assist_status_handler, sync=False)

    async def assist_config_handler(params, request_id, context):
        return await asyncio.to_thread(assist.assist_config, params or {})

    server.route(name=UI_ASSIST_ASSIST_CONFIG, handler=assist_config_handler, sync=False)

    async def assist_cycle_handler(params, request_id, context):
        return await asyncio.to_thread(assist.assist_cycle)

    server.route(name=UI_ASSIST_ASSIST_CYCLE, handler=assist_cycle_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered assist RPC routes")


__all__ = ["register_local_assist_routes"]
