# -*- coding: utf-8 -*-
"""HTTP Routes for sentence_audio — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_SENTENCE_AUDIO_STATUS,
    UI_SENTENCE_AUDIO_CONFIG,
)
from pycore.pyctl.tts.sentence_audio_auto import apply_auto_start, get_status


def register_local_sentence_audio_routes(server):
    """Register HTTP controllers."""

    server.post(path=UI_SENTENCE_AUDIO_STATUS, handler=get_status)

    def config_handler(params, request_id, context):
        if "auto_start" not in params:
            return {"success": False, "error": "auto_start is required"}
        return apply_auto_start(
            bool(params["auto_start"]),
            concurrency=params.get("concurrency"),
            speaker=params.get("speaker"),
        )

    server.post(path=UI_SENTENCE_AUDIO_CONFIG, handler=config_handler)

