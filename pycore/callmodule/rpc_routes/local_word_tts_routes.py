# -*- coding: utf-8 -*-
"""Register Word TTS controllers on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.tts.lane_auto import word_audio_auto


def register_local_word_tts_routes(server) -> None:
    """Register Word TTS controllers."""

    def config_handler(params, _request_id, _context):
        request = params
        if "auto_start" not in request:
            return {"success": False, "error": "auto_start is required"}
        return word_audio_auto.apply_auto_start(
            bool(request["auto_start"]),
            request.get("concurrency"),
        )

    server.post(path=route_names.UI_WORD_TTS_STATUS, handler=word_audio_auto.status)
    server.post(path=route_names.UI_WORD_TTS_CONFIG, handler=config_handler)

