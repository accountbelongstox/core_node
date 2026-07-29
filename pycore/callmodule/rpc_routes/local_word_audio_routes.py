# -*- coding: utf-8 -*-
"""RPC Routes for word_audio — native UI path (no router.invoke)."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
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
import pycore.callmodule.services.word_audio_service as wa


def register_local_word_audio_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(wa.status)

    server.route(name=UI_WORD_AUDIO_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            wa.test,
            str(params.get("word") or ""),
            str(params.get("lang") or "en"),
            params.get("accent"),
        )

    server.route(name=UI_WORD_AUDIO_TEST, handler=test_handler, sync=False)

    async def missing_batch_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            wa.missing_batch,
            int(params.get("limit") or 1000),
            str(params.get("language") or "en"),
        )

    server.route(name=UI_WORD_AUDIO_MISSING_BATCH, handler=missing_batch_handler, sync=False)

    async def word_audio_media_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            wa.word_audio_media,
            str(params.get("word") or ""),
            str(params.get("language") or "en"),
        )

    server.route(name=UI_WORD_AUDIO_WORD_AUDIO_MEDIA, handler=word_audio_media_handler, sync=False)

    async def upload_word_audio_handler(params, request_id, context):
        return await asyncio.to_thread(wa.upload_word_audio, params or {})

    server.route(name=UI_WORD_AUDIO_UPLOAD_WORD_AUDIO, handler=upload_word_audio_handler, sync=False)

    async def fetch_youdao_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            wa.fetch_youdao,
            str(params.get("word") or ""),
            int(params.get("type") or 2),
        )

    server.route(name=UI_WORD_AUDIO_FETCH_YOUDAO, handler=fetch_youdao_handler, sync=False)

    async def edge_synth_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            wa.edge_synth,
            str(params.get("word") or ""),
            str(params.get("lang") or "en"),
            params.get("accent"),
        )

    server.route(name=UI_WORD_AUDIO_EDGE_SYNTH, handler=edge_synth_handler, sync=False)

    async def fix_word_text_handler(params, request_id, context):
        return await asyncio.to_thread(wa.fix_word_text, params or {})

    server.route(name=UI_WORD_AUDIO_FIX_WORD_TEXT, handler=fix_word_text_handler, sync=False)

    async def boost_priority_handler(params, request_id, context):
        return await asyncio.to_thread(wa.boost_priority, params or {})

    server.route(name=UI_WORD_AUDIO_BOOST_PRIORITY, handler=boost_priority_handler, sync=False)

    async def boost_priority_batch_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(wa.boost_priority_batch, params.get("items") or [])

    server.route(
        name=UI_WORD_AUDIO_BOOST_PRIORITY_BATCH,
        handler=boost_priority_batch_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered word_audio RPC routes")


__all__ = ["register_local_word_audio_routes"]
