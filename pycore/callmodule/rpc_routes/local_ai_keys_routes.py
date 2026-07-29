# -*- coding: utf-8 -*-
"""RPC Routes for ai_keys."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_KEYS_DELETE_KEY,
    UI_AI_KEYS_LIST_KEYS,
    UI_AI_KEYS_RESET_COOLDOWN,
    UI_AI_KEYS_SET_KEY,
)
import pycore.callmodule.services.ai_keys_service as keys


def register_local_ai_keys_routes(server):
    async def list_keys_handler(params, request_id, context):
        return await asyncio.to_thread(keys.list_keys)

    server.route(name=UI_AI_KEYS_LIST_KEYS, handler=list_keys_handler, sync=False)

    async def set_key_handler(params, request_id, context):
        return await asyncio.to_thread(keys.set_key, params or {})

    server.route(name=UI_AI_KEYS_SET_KEY, handler=set_key_handler, sync=False)

    async def reset_cooldown_handler(params, request_id, context):
        return await asyncio.to_thread(keys.reset_cooldown, params or {})

    server.route(name=UI_AI_KEYS_RESET_COOLDOWN, handler=reset_cooldown_handler, sync=False)

    async def delete_key_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(keys.delete_key, str(params.get("key_name") or ""))

    server.route(name=UI_AI_KEYS_DELETE_KEY, handler=delete_key_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_keys RPC routes")


__all__ = ["register_local_ai_keys_routes"]
