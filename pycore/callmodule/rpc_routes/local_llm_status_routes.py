# -*- coding: utf-8 -*-
"""RPC Routes for llm_status."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LLM_STATUS_GET_SETTINGS,
    UI_LLM_STATUS_POST_SERVER_ACTION,
    UI_LLM_STATUS_POST_SETTINGS,
    UI_LLM_STATUS_STATUS,
    UI_LLM_STATUS_TEST,
)
from pycore.callmodule.services import llm_status_service as llm


def register_local_llm_status_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(llm.status)

    server.route(name=UI_LLM_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        return await asyncio.to_thread(llm.test, params or {})

    server.route(name=UI_LLM_STATUS_TEST, handler=test_handler, sync=False)

    async def get_settings_handler(params, request_id, context):
        return await asyncio.to_thread(llm.get_settings)

    server.route(name=UI_LLM_STATUS_GET_SETTINGS, handler=get_settings_handler, sync=False)

    async def post_settings_handler(params, request_id, context):
        return await asyncio.to_thread(llm.post_settings, params or {})

    server.route(name=UI_LLM_STATUS_POST_SETTINGS, handler=post_settings_handler, sync=False)

    async def post_server_action_handler(params, request_id, context):
        return await asyncio.to_thread(llm.post_server_action, params or {})

    server.route(name=UI_LLM_STATUS_POST_SERVER_ACTION, handler=post_server_action_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered llm_status RPC routes")


__all__ = ["register_local_llm_status_routes"]
