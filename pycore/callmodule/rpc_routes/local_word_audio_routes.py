# -*- coding: utf-8 -*-
"""RPC Routes for word_audio — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
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
from pycore.callmodule.routers_bak.local.word_audio_router import (
    status as word_audio_status,
    test as word_audio_test,
    missing_batch,
    word_audio_media,
    upload_word_audio,
    fetch_youdao,
    edge_synth,
    fix_word_text,
    boost_priority,
    boost_priority_batch,
    WordAudioTestRequest,
    WordAudioPriorityBatchRequest,
    EdgeSynthRequest,
)


def register_local_word_audio_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(word_audio_status)

    server.route(name=UI_WORD_AUDIO_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        req = WordAudioTestRequest(
            word=str(params.get("word") or ""),
            lang=str(params.get("lang") or "en"),
            accent=params.get("accent"),
        )
        return await asyncio.to_thread(word_audio_test, req)

    server.route(name=UI_WORD_AUDIO_TEST, handler=test_handler, sync=False)

    async def missing_batch_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            missing_batch,
            int(params.get("limit") or 1000),
            str(params.get("language") or "en"),
        )

    server.route(name=UI_WORD_AUDIO_MISSING_BATCH, handler=missing_batch_handler, sync=False)

    async def word_audio_media_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            word_audio_media,
            str(params.get("word") or ""),
            str(params.get("language") or "en"),
        )

    server.route(name=UI_WORD_AUDIO_WORD_AUDIO_MEDIA, handler=word_audio_media_handler, sync=False)

    async def upload_word_audio_handler(params, request_id, context):
        return await asyncio.to_thread(upload_word_audio, params or {})

    server.route(name=UI_WORD_AUDIO_UPLOAD_WORD_AUDIO, handler=upload_word_audio_handler, sync=False)

    async def fetch_youdao_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            fetch_youdao,
            str(params.get("word") or ""),
            int(params.get("type") or 2),
        )

    server.route(name=UI_WORD_AUDIO_FETCH_YOUDAO, handler=fetch_youdao_handler, sync=False)

    async def edge_synth_handler(params, request_id, context):
        params = params or {}
        req = EdgeSynthRequest(
            word=str(params.get("word") or ""),
            lang=str(params.get("lang") or "en"),
            accent=params.get("accent"),
        )
        return await asyncio.to_thread(edge_synth, req)

    server.route(name=UI_WORD_AUDIO_EDGE_SYNTH, handler=edge_synth_handler, sync=False)

    async def fix_word_text_handler(params, request_id, context):
        return await asyncio.to_thread(fix_word_text, params or {})

    server.route(name=UI_WORD_AUDIO_FIX_WORD_TEXT, handler=fix_word_text_handler, sync=False)

    async def boost_priority_handler(params, request_id, context):
        return await asyncio.to_thread(boost_priority, params or {})

    server.route(name=UI_WORD_AUDIO_BOOST_PRIORITY, handler=boost_priority_handler, sync=False)

    async def boost_priority_batch_handler(params, request_id, context):
        params = params or {}
        req = WordAudioPriorityBatchRequest(items=params.get("items") or [])
        return await asyncio.to_thread(boost_priority_batch, req)

    server.route(
        name=UI_WORD_AUDIO_BOOST_PRIORITY_BATCH,
        handler=boost_priority_batch_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered word_audio RPC routes")


__all__ = ["register_local_word_audio_routes"]
