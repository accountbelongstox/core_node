# -*- coding: utf-8 -*-
"""RPC Routes for queue_priority — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
    UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO,
    UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO_ITEM,
    UI_QUEUE_PRIORITY_PRIORITIZE_WORD_AUDIO_WORDS,
    UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
    UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
)
from pycore.callmodule.routers_bak.local.queue_priority_router import (
    prioritize_word_images,
    prioritize_sentence_audio,
    prioritize_sentence_audio_item,
    prioritize_word_audio_words,
    prioritize_covers,
    prioritize_posters,
    WordImagePriorityRequest,
    SentencePriorityRequest,
    SentenceItemPriorityRequest,
    WordAudioWordsPriorityRequest,
    CoverPriorityRequest,
    PosterPriorityRequest,
)


def register_local_queue_priority_routes(server):
    """Register WS RPC handlers."""

    async def prioritize_word_images_handler(params, request_id, context):
        params = params or {}
        req = WordImagePriorityRequest(items=params.get("items") or [])
        return await asyncio.to_thread(prioritize_word_images, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
        handler=prioritize_word_images_handler,
        sync=False,
    )

    async def prioritize_sentence_audio_handler(params, request_id, context):
        params = params or {}
        req = SentencePriorityRequest(items=params.get("items") or [])
        return await asyncio.to_thread(prioritize_sentence_audio, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO,
        handler=prioritize_sentence_audio_handler,
        sync=False,
    )

    async def prioritize_sentence_audio_item_handler(params, request_id, context):
        params = params or {}
        req = SentenceItemPriorityRequest(
            content_id=str(params.get("content_id") or ""),
            language=str(params.get("language") or ""),
        )
        return await asyncio.to_thread(prioritize_sentence_audio_item, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_SENTENCE_AUDIO_ITEM,
        handler=prioritize_sentence_audio_item_handler,
        sync=False,
    )

    async def prioritize_word_audio_words_handler(params, request_id, context):
        params = params or {}
        req = WordAudioWordsPriorityRequest(
            words=list(params.get("words") or []),
            language=str(params.get("language") or ""),
        )
        return await asyncio.to_thread(prioritize_word_audio_words, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_WORD_AUDIO_WORDS,
        handler=prioritize_word_audio_words_handler,
        sync=False,
    )

    async def prioritize_covers_handler(params, request_id, context):
        params = params or {}
        req = CoverPriorityRequest(
            ids=list(params.get("ids") or []),
            all=bool(params.get("all") or False),
        )
        return await asyncio.to_thread(prioritize_covers, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
        handler=prioritize_covers_handler,
        sync=False,
    )

    async def prioritize_posters_handler(params, request_id, context):
        params = params or {}
        req = PosterPriorityRequest(items=params.get("items") or [])
        return await asyncio.to_thread(prioritize_posters, req)

    server.route(
        name=UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
        handler=prioritize_posters_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered queue_priority RPC routes")


__all__ = ["register_local_queue_priority_routes"]
