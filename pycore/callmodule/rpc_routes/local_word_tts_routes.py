# -*- coding: utf-8 -*-
"""RPC Routes for word_tts."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_TTS_STATUS,
    UI_WORD_TTS_CONFIG,
    UI_WORD_TTS_RUN_ONCE,
)
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.callmodule.services.word_tts_auto import apply_auto_start, get_status


def register_local_word_tts_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(get_status)

    server.route(name=UI_WORD_TTS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        if "auto_start" not in params:
            return {"success": False, "error": "auto_start is required"}
        return await asyncio.to_thread(
            apply_auto_start,
            bool(params["auto_start"]),
            params.get("concurrency"),
        )

    server.route(name=UI_WORD_TTS_CONFIG, handler=config_handler, sync=False)

    async def run_once_handler(params, request_id, context):
        def _run():
            try:
                get_tts_queue_poller_service().poll_and_process()
                return {"ok": True}
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "error": str(exc)}

        return await asyncio.to_thread(_run)

    server.route(name=UI_WORD_TTS_RUN_ONCE, handler=run_once_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered word_tts RPC routes")


__all__ = ["register_local_word_tts_routes"]
