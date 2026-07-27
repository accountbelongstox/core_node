# -*- coding: utf-8 -*-
"""RPC v2 routes for NotebookLM STT."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.services.notebooklm_stt import (
    apply_notebooklm_auto_convert,
    clear_cache,
    convert_all_audio,
    convert_relative_audio,
    get_status,
    list_audio_files,
)
from pycore.callmodule.rpc_routes.route_names import (
    UI_NOTEBOOKLM_STT_GET_STATUS,
    UI_NOTEBOOKLM_STT_UPDATE_SETTINGS,
    UI_NOTEBOOKLM_STT_CONVERT_ALL,
    UI_NOTEBOOKLM_STT_CONVERT_SINGLE,
    UI_NOTEBOOKLM_STT_LIST_AUDIO_FILES,
    UI_NOTEBOOKLM_STT_CLEAR_CACHE,
)


def register_notebooklm_stt_routes(server):
    """Register WS RPC handlers."""

    async def get_status_handler(params, request_id, context):
        return get_status()

    server.route(name=UI_NOTEBOOKLM_STT_GET_STATUS, handler=get_status_handler, sync=False)

    async def update_settings_handler(params, request_id, context):
        params = params or {}
        enabled = bool(params.get("enabled"))
        await asyncio.to_thread(
            apply_notebooklm_auto_convert,
            enabled,
            bool(params.get("run_scan", enabled)),
        )
        return {"success": True, "enabled": enabled}

    server.route(name=UI_NOTEBOOKLM_STT_UPDATE_SETTINGS, handler=update_settings_handler, sync=False)

    async def convert_all_handler(params, request_id, context):
        return await asyncio.to_thread(convert_all_audio)

    server.route(name=UI_NOTEBOOKLM_STT_CONVERT_ALL, handler=convert_all_handler, sync=False)

    async def convert_single_handler(params, request_id, context):
        params = params or {}
        audio_file = str(params.get("audio_file") or "").strip()
        if not audio_file:
            return {"success": False, "error": "audio_file is required"}
        return await asyncio.to_thread(convert_relative_audio, audio_file)

    server.route(name=UI_NOTEBOOKLM_STT_CONVERT_SINGLE, handler=convert_single_handler, sync=False)

    async def list_audio_files_handler(params, request_id, context):
        return await asyncio.to_thread(list_audio_files)

    server.route(name=UI_NOTEBOOKLM_STT_LIST_AUDIO_FILES, handler=list_audio_files_handler, sync=False)

    async def clear_cache_handler(params, request_id, context):
        return await asyncio.to_thread(clear_cache)

    server.route(name=UI_NOTEBOOKLM_STT_CLEAR_CACHE, handler=clear_cache_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered notebooklm_stt RPC routes")

__all__ = ["register_notebooklm_stt_routes"]
