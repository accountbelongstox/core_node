# -*- coding: utf-8 -*-
"""RPC Routes for engines_load_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_ENGINES_LOAD_STATUS_LOAD_STATUS
from pycore.callmodule.services.engines_load_status_service import get_load_status


def register_local_engines_load_status_routes(server):
    async def load_status_handler(params, request_id, context):
        return await asyncio.to_thread(get_load_status)

    server.route(name=UI_ENGINES_LOAD_STATUS_LOAD_STATUS, handler=load_status_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered engines_load_status RPC routes")


__all__ = ["register_local_engines_load_status_routes"]
