# -*- coding: utf-8 -*-
"""HTTP Routes for word_audio — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_AUDIO_STATUS,
    UI_WORD_AUDIO_TEST,
)
import pycore.pyctl.tts.word_audio_service as wa


def register_local_word_audio_routes(server):
    """Register HTTP controllers."""

    server.post(path=UI_WORD_AUDIO_STATUS, handler=wa.status)

    def test_handler(params, request_id, context):
        return wa.test(str(params.get("word") or ""), str(params.get("lang") or "en"), params.get("accent"))

    server.post(path=UI_WORD_AUDIO_TEST, handler=test_handler)
