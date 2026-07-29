# -*- coding: utf-8 -*-
"""RPC Routes for speech_history."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SPEECH_HISTORY_HISTORY,
    UI_SPEECH_HISTORY_HISTORY_FILE,
    UI_SPEECH_HISTORY_HISTORY_REVEAL,
    UI_SPEECH_HISTORY_HISTORY_DELETE,
    UI_SPEECH_HISTORY_HISTORY_CLEAR,
)
import pycore.callmodule.services.speech_history_service as hist


def register_local_speech_history_routes(server):
    async def history_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history, int(params.get("limit") or 50))

    server.route(name=UI_SPEECH_HISTORY_HISTORY, handler=history_handler, sync=False)

    async def history_file_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_file, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_FILE, handler=history_file_handler, sync=False)

    async def history_reveal_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_reveal, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_REVEAL, handler=history_reveal_handler, sync=False)

    async def history_delete_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_delete, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_DELETE, handler=history_delete_handler, sync=False)

    async def history_clear_handler(params, request_id, context):
        return await asyncio.to_thread(hist.history_clear)

    server.route(name=UI_SPEECH_HISTORY_HISTORY_CLEAR, handler=history_clear_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered speech_history RPC routes")


__all__ = ["register_local_speech_history_routes"]
