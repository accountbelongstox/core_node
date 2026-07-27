# -*- coding: utf-8 -*-
"""RPC Routes for sentence_audio — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SENTENCE_AUDIO_STATUS,
    UI_SENTENCE_AUDIO_CONFIG,
    UI_SENTENCE_AUDIO_RUN_ONCE,
    UI_SENTENCE_AUDIO_QUEUE_SNAPSHOT,
    UI_SENTENCE_AUDIO_VARIANTS_INDEX,
    UI_SENTENCE_AUDIO_VARIANTS_STORE,
    UI_SENTENCE_AUDIO_VARIANTS_DESTROY,
)
from pycore.callmodule.routers_bak.local.sentence_audio_router import (
    status as sentence_audio_status,
    config as sentence_audio_config,
    run_once,
    queue_snapshot,
    variants_index,
    variants_store,
    variants_destroy,
    SentenceAudioConfigRequest,
    VariantSpecsReplaceRequest,
)


def register_local_sentence_audio_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(sentence_audio_status)

    server.route(name=UI_SENTENCE_AUDIO_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        req = SentenceAudioConfigRequest(
            auto_start=bool(params.get("auto_start")),
            concurrency=params.get("concurrency"),
        )
        return await asyncio.to_thread(sentence_audio_config, req)

    server.route(name=UI_SENTENCE_AUDIO_CONFIG, handler=config_handler, sync=False)

    async def run_once_handler(params, request_id, context):
        return await asyncio.to_thread(run_once)

    server.route(name=UI_SENTENCE_AUDIO_RUN_ONCE, handler=run_once_handler, sync=False)

    async def queue_snapshot_handler(params, request_id, context):
        return await asyncio.to_thread(queue_snapshot)

    server.route(name=UI_SENTENCE_AUDIO_QUEUE_SNAPSHOT, handler=queue_snapshot_handler, sync=False)

    async def variants_index_handler(params, request_id, context):
        params = params or {}
        lang = str(params.get("lang") or "en")
        return await asyncio.to_thread(variants_index, lang)

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_INDEX, handler=variants_index_handler, sync=False)

    async def variants_store_handler(params, request_id, context):
        params = params or {}
        req = VariantSpecsReplaceRequest(
            lang=str(params.get("lang") or "en"),
            specs=params.get("specs") or [],
        )
        return await asyncio.to_thread(variants_store, req)

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_STORE, handler=variants_store_handler, sync=False)

    async def variants_destroy_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            variants_destroy,
            str(params.get("lang") or "en"),
            str(params.get("variant_key") or ""),
        )

    server.route(
        name=UI_SENTENCE_AUDIO_VARIANTS_DESTROY,
        handler=variants_destroy_handler,
        sync=False,
    )

    ColorPrint.green("[ConfigBuilder] Registered sentence_audio RPC routes")


__all__ = ["register_local_sentence_audio_routes"]
