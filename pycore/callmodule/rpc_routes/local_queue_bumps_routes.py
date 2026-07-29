# -*- coding: utf-8 -*-
"""RPC Routes for queue_bumps."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_BUMPS_LIST_BUMPS
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub


def register_local_queue_bumps_routes(server):
    async def list_bumps_handler(params, request_id, context):
        params = params or {}
        limit = int(params.get("limit") or 30)

        def _run():
            snap = get_queue_bump_hub().snapshot(limit=max(1, min(limit, 60)))
            return {"success": True, **snap}

        return await asyncio.to_thread(_run)

    server.route(name=UI_QUEUE_BUMPS_LIST_BUMPS, handler=list_bumps_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered queue_bumps RPC routes")


__all__ = ["register_local_queue_bumps_routes"]
