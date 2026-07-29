# -*- coding: utf-8 -*-
"""RPC Routes for sentence_audio — native UI path (no router.invoke)."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SENTENCE_AUDIO_STATUS,
    UI_SENTENCE_AUDIO_CONFIG,
    UI_SENTENCE_AUDIO_RUN_ONCE,
    UI_SENTENCE_AUDIO_QUEUE_SNAPSHOT,
    UI_SENTENCE_AUDIO_VARIANTS_INDEX,
    UI_SENTENCE_AUDIO_VARIANTS_STORE,
    UI_SENTENCE_AUDIO_VARIANTS_DESTROY,
)
import pycore.callmodule.services.sentence_audio_service as sa


def register_local_sentence_audio_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(sa.status)

    server.route(name=UI_SENTENCE_AUDIO_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        if "auto_start" not in params:
            return {"success": False, "error": "auto_start is required"}
        return await asyncio.to_thread(
            sa.config,
            bool(params["auto_start"]),
            params.get("concurrency"),
        )

    server.route(name=UI_SENTENCE_AUDIO_CONFIG, handler=config_handler, sync=False)

    async def run_once_handler(params, request_id, context):
        return await asyncio.to_thread(sa.run_once)

    server.route(name=UI_SENTENCE_AUDIO_RUN_ONCE, handler=run_once_handler, sync=False)

    async def queue_snapshot_handler(params, request_id, context):
        return await asyncio.to_thread(sa.queue_snapshot)

    server.route(name=UI_SENTENCE_AUDIO_QUEUE_SNAPSHOT, handler=queue_snapshot_handler, sync=False)

    async def variants_index_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(sa.variants_index, str(params.get("lang") or "en"))

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_INDEX, handler=variants_index_handler, sync=False)

    async def variants_store_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            sa.variants_store,
            str(params.get("lang") or "en"),
            params.get("specs") or [],
        )

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_STORE, handler=variants_store_handler, sync=False)

    async def variants_destroy_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            sa.variants_destroy,
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
