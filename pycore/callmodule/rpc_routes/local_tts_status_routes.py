# -*- coding: utf-8 -*-
"""RPC Routes for tts_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TTS_STATUS_GET_SETTINGS,
    UI_TTS_STATUS_POST_SERVER_ACTION,
    UI_TTS_STATUS_POST_SETTINGS,
    UI_TTS_STATUS_STATUS,
    UI_TTS_STATUS_TEST,
)
import pycore.callmodule.services.tts_status_service as tts


def register_local_tts_status_routes(server):
    async def status_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(tts.status, int(params.get("refresh") or 0))

    server.route(name=UI_TTS_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        return await asyncio.to_thread(tts.test, params or {})

    server.route(name=UI_TTS_STATUS_TEST, handler=test_handler, sync=False)

    async def get_settings_handler(params, request_id, context):
        return await asyncio.to_thread(tts.get_settings)

    server.route(name=UI_TTS_STATUS_GET_SETTINGS, handler=get_settings_handler, sync=False)

    async def post_settings_handler(params, request_id, context):
        return await asyncio.to_thread(tts.post_settings, params or {})

    server.route(name=UI_TTS_STATUS_POST_SETTINGS, handler=post_settings_handler, sync=False)

    async def post_server_action_handler(params, request_id, context):
        return await asyncio.to_thread(tts.post_server_action, params or {})

    server.route(name=UI_TTS_STATUS_POST_SERVER_ACTION, handler=post_server_action_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered tts_status RPC routes")


__all__ = ["register_local_tts_status_routes"]
