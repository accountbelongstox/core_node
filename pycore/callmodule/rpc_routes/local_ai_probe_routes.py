# -*- coding: utf-8 -*-
"""RPC Routes for ai_probe."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_PROBE_AI_CATALOG,
    UI_AI_PROBE_PROBE,
    UI_AI_PROBE_BALANCE,
)
import pycore.callmodule.services.ai_probe_service as probe


def register_local_ai_probe_routes(server):
    async def ai_catalog_handler(params, request_id, context):
        return await probe.ai_catalog()

    server.route(name=UI_AI_PROBE_AI_CATALOG, handler=ai_catalog_handler, sync=False)

    async def probe_handler(params, request_id, context):
        params = params or {}
        return await probe.probe(
            int(params.get("refresh") or 0),
            params.get("provider"),
        )

    server.route(name=UI_AI_PROBE_PROBE, handler=probe_handler, sync=False)

    async def balance_handler(params, request_id, context):
        params = params or {}
        return await probe.balance(params.get("provider"))

    server.route(name=UI_AI_PROBE_BALANCE, handler=balance_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_probe RPC routes")


__all__ = ["register_local_ai_probe_routes"]
