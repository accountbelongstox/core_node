# -*- coding: utf-8 -*-
"""RPC Routes for queue_overview — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_OVERVIEW_GET_QUEUE_OVERVIEW
from pycore.callmodule.services.queue_overview_service import get_queue_overview


def register_local_queue_overview_routes(server):
    """Register WS RPC handlers."""

    async def get_queue_overview_handler(params, request_id, context):
        return await asyncio.to_thread(get_queue_overview)

    server.route(
        name=UI_QUEUE_OVERVIEW_GET_QUEUE_OVERVIEW,
        handler=get_queue_overview_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered queue_overview RPC routes")


__all__ = ["register_local_queue_overview_routes"]
