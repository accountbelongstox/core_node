# -*- coding: utf-8 -*-
"""RPC Routes for ai_keys."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_KEYS_DELETE_KEY,
    UI_AI_KEYS_LIST_KEYS,
    UI_AI_KEYS_RESET_COOLDOWN,
    UI_AI_KEYS_SET_KEY,
)
import pycore.pyctl.ai.key_service as keys


def register_local_ai_keys_routes(server):
    server.route(name=UI_AI_KEYS_LIST_KEYS, handler=keys.list_keys)
    server.route(name=UI_AI_KEYS_SET_KEY, handler=keys.set_key)
    server.route(name=UI_AI_KEYS_RESET_COOLDOWN, handler=keys.reset_cooldown)

    def delete_key_handler(params, request_id, context):
        params = params or {}
        return keys.delete_key(str(params.get("key_name") or ""))

    server.route(name=UI_AI_KEYS_DELETE_KEY, handler=delete_key_handler)
    ColorPrint.green("[ConfigBuilder] Registered ai_keys RPC routes")

