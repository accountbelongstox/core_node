# -*- coding: utf-8 -*-
"""RPC Routes for queue_priority — native UI path (no router.invoke)."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
    UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO,
    UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO_ITEM,
    UI_QUEUE_PRIORITY_PRIORITIZE_WORD_AUDIO_WORDS,
    UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
    UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
)
import pycore.callmodule.services.queue_priority_service as qp


def register_local_queue_priority_routes(server):
    """Register WS RPC handlers."""

    async def prioritize_word_images_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(qp.prioritize_word_images, params.get("items") or [])

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
        handler=prioritize_word_images_handler,
        sync=False,
    )

    async def prioritize_sentence_audio_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(qp.prioritize_sentence_audio, params.get("items") or [])

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO,
        handler=prioritize_sentence_audio_handler,
        sync=False,
    )

    async def prioritize_sentence_audio_item_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            qp.prioritize_sentence_audio_item,
            str(params.get("content_id") or ""),
            str(params.get("language") or ""),
        )

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO_ITEM,
        handler=prioritize_sentence_audio_item_handler,
        sync=False,
    )

    async def prioritize_word_audio_words_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            qp.prioritize_word_audio_words,
            list(params.get("words") or []),
            str(params.get("language") or ""),
        )

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_WORD_AUDIO_WORDS,
        handler=prioritize_word_audio_words_handler,
        sync=False,
    )

    async def prioritize_covers_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            qp.prioritize_covers,
            list(params.get("ids") or []),
            bool(params.get("all") or False),
        )

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
        handler=prioritize_covers_handler,
        sync=False,
    )

    async def prioritize_posters_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(qp.prioritize_posters, params.get("items") or [])

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
        handler=prioritize_posters_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered queue_priority RPC routes")


__all__ = ["register_local_queue_priority_routes"]
