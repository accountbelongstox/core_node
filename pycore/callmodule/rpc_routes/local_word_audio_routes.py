# -*- coding: utf-8 -*-
"""HTTP Routes for word_audio — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_AUDIO_STATUS,
    UI_WORD_AUDIO_TEST,
    UI_WORD_AUDIO_MISSING_BATCH,
    UI_WORD_AUDIO_WORD_AUDIO_MEDIA,
    UI_WORD_AUDIO_UPLOAD_WORD_AUDIO,
    UI_WORD_AUDIO_FETCH_YOUDAO,
    UI_WORD_AUDIO_EDGE_SYNTH,
    UI_WORD_AUDIO_FIX_WORD_TEXT,
    UI_WORD_AUDIO_BOOST_PRIORITY,
    UI_WORD_AUDIO_BOOST_PRIORITY_BATCH,
)
import pycore.pyctl.tts.word_audio_service as wa


def register_local_word_audio_routes(server):
    """Register HTTP controllers."""

    server.post(path=UI_WORD_AUDIO_STATUS, handler=wa.status)

    def test_handler(params, request_id, context):
        return wa.test(str(params.get("word") or ""), str(params.get("lang") or "en"), params.get("accent"))

    server.post(path=UI_WORD_AUDIO_TEST, handler=test_handler)

    def missing_batch_handler(params, request_id, context):
        return wa.missing_batch(int(params.get("limit") or 1000), str(params.get("language") or "en"))

    server.post(path=UI_WORD_AUDIO_MISSING_BATCH, handler=missing_batch_handler)

    def word_audio_media_handler(params, request_id, context):
        return wa.word_audio_media(str(params.get("word") or ""), str(params.get("language") or "en"))

    server.post(path=UI_WORD_AUDIO_WORD_AUDIO_MEDIA, handler=word_audio_media_handler)

    server.post(path=UI_WORD_AUDIO_UPLOAD_WORD_AUDIO, handler=wa.upload_word_audio)

    def fetch_youdao_handler(params, request_id, context):
        return wa.fetch_youdao(str(params.get("word") or ""), int(params.get("type") or 2))

    server.post(path=UI_WORD_AUDIO_FETCH_YOUDAO, handler=fetch_youdao_handler)

    def edge_synth_handler(params, request_id, context):
        return wa.edge_synth(str(params.get("word") or ""), str(params.get("lang") or "en"), params.get("accent"))

    server.post(path=UI_WORD_AUDIO_EDGE_SYNTH, handler=edge_synth_handler)

    server.post(path=UI_WORD_AUDIO_FIX_WORD_TEXT, handler=wa.fix_word_text)
    server.post(path=UI_WORD_AUDIO_BOOST_PRIORITY, handler=wa.boost_priority)

    def boost_priority_batch_handler(params, request_id, context):
        return wa.boost_priority_batch(params.get("items") or [])

    server.post(
        path=UI_WORD_AUDIO_BOOST_PRIORITY_BATCH,
        handler=boost_priority_batch_handler,
    )


