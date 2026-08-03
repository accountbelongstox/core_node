# -*- coding: utf-8 -*-
"""HTTP Routes for word_audio — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_AUDIO_STATUS,
    UI_WORD_AUDIO_TEST,
    UI_WORD_AUDIO_FETCH_YOUDAO,
    UI_WORD_AUDIO_EDGE_SYNTH,
)
import pycore.pyctl.tts.word_audio_service as wa


def register_local_word_audio_routes(server):
    """Register HTTP controllers."""

    server.post(path=UI_WORD_AUDIO_STATUS, handler=wa.status)

    def test_handler(params, request_id, context):
        return wa.test(str(params.get("word") or ""), str(params.get("lang") or "en"), params.get("accent"))

    server.post(path=UI_WORD_AUDIO_TEST, handler=test_handler)

    def fetch_youdao_handler(params, request_id, context):
        return wa.fetch_youdao(str(params.get("word") or ""), int(params.get("type") or 2))

    server.post(path=UI_WORD_AUDIO_FETCH_YOUDAO, handler=fetch_youdao_handler)

    def edge_synth_handler(params, request_id, context):
        return wa.edge_synth(str(params.get("word") or ""), str(params.get("lang") or "en"), params.get("accent"))

    server.post(path=UI_WORD_AUDIO_EDGE_SYNTH, handler=edge_synth_handler)



