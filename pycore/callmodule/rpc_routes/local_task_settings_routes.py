# -*- coding: utf-8 -*-
"""RPC Routes for task_settings."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_SETTINGS_CHAINS,
    UI_TASK_SETTINGS_UPDATE_CHAIN,
)
from pycore.callmodule.services.task_capability_chains import get_chains, save_chain


def register_local_task_settings_routes(server):
    async def chains_handler(params, request_id, context):
        return await asyncio.to_thread(lambda: {"success": True, "chains": get_chains()})

    server.route(name=UI_TASK_SETTINGS_CHAINS, handler=chains_handler, sync=False)

    async def update_chain_handler(params, request_id, context):
        params = params or {}

        def _run():
            result = save_chain(str(params.get("task_type") or ""), list(params.get("priority") or []))
            if not result.get("ok"):
                return {"success": False, **result}
            return {"success": True, **result}

        return await asyncio.to_thread(_run)

    server.route(name=UI_TASK_SETTINGS_UPDATE_CHAIN, handler=update_chain_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered task_settings RPC routes")


__all__ = ["register_local_task_settings_routes"]
