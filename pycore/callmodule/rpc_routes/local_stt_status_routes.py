# -*- coding: utf-8 -*-
"""RPC Routes for stt_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_STT_STATUS_STATUS, UI_STT_STATUS_TEST
import pycore.callmodule.services.stt_status_service as stt


def register_local_stt_status_routes(server):
    async def status_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(stt.status, int(params.get("refresh") or 0))

    server.route(name=UI_STT_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        return await asyncio.to_thread(stt.test, params or {})

    server.route(name=UI_STT_STATUS_TEST, handler=test_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered stt_status RPC routes")


__all__ = ["register_local_stt_status_routes"]
