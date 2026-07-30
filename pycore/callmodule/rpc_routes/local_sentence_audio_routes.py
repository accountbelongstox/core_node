# -*- coding: utf-8 -*-
"""RPC Routes for sentence_audio — native UI path (no router.invoke)."""


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
import pycore.pyctl.tts.sentence_audio_service as sa
from pycore.pyctl.tts.sentence_audio_auto import apply_auto_start, get_status


def register_local_sentence_audio_routes(server):
    """Register HTTP controllers."""

    server.route(name=UI_SENTENCE_AUDIO_STATUS, handler=get_status)

    def config_handler(params, request_id, context):
        params = params or {}
        if "auto_start" not in params:
            return {"success": False, "error": "auto_start is required"}
        return apply_auto_start(
            bool(params["auto_start"]),
            concurrency=params.get("concurrency"),
        )

    server.route(name=UI_SENTENCE_AUDIO_CONFIG, handler=config_handler)

    server.route(name=UI_SENTENCE_AUDIO_RUN_ONCE, handler=sa.run_once)
    server.route(name=UI_SENTENCE_AUDIO_QUEUE_SNAPSHOT, handler=sa.queue_snapshot)

    def variants_index_handler(params, request_id, context):
        params = params or {}
        return sa.variants_index(str(params.get("lang") or "en"))

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_INDEX, handler=variants_index_handler)

    def variants_store_handler(params, request_id, context):
        params = params or {}
        return sa.variants_store(str(params.get("lang") or "en"), params.get("specs") or [])

    server.route(name=UI_SENTENCE_AUDIO_VARIANTS_STORE, handler=variants_store_handler)

    def variants_destroy_handler(params, request_id, context):
        params = params or {}
        return sa.variants_destroy(str(params.get("lang") or "en"), str(params.get("variant_key") or ""))

    server.route(
        name=UI_SENTENCE_AUDIO_VARIANTS_DESTROY,
        handler=variants_destroy_handler,
    )

    ColorPrint.green("[ConfigBuilder] Registered sentence_audio RPC routes")


