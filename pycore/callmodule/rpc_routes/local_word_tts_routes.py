# -*- coding: utf-8 -*-
"""Register Word TTS controllers on RPC v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.tts.word_queue_poller_service import tts_queue_poller_service
from pycore.pyctl.tts.word_tts_auto import apply_auto_start, get_status
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_local_word_tts_routes(server) -> None:
    """Register Word TTS controllers."""

    def config_handler(params, _request_id, _context):
        request = params or {}
        if "auto_start" not in request:
            return {"success": False, "error": "auto_start is required"}
        return apply_auto_start(
            bool(request["auto_start"]),
            request.get("concurrency"),
        )

    def run_once_handler(_params, _request_id, _context):
        tts_queue_poller_service.poll_and_process()
        return {"ok": True}

    server.route(name=route_names.UI_WORD_TTS_STATUS, handler=get_status)
    server.route(name=route_names.UI_WORD_TTS_CONFIG, handler=config_handler)
    server.route(name=route_names.UI_WORD_TTS_RUN_ONCE, handler=run_once_handler)
    ColorPrint.green("[ConfigBuilder] Registered word_tts RPC routes")

