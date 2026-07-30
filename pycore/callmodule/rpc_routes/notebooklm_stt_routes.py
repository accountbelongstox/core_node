# -*- coding: utf-8 -*-
"""HTTP v2 routes for NotebookLM STT."""


from pycore.pyutils.whisper_stt.notebooklm_stt import (
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
    """Register HTTP controllers."""

    server.post(name=UI_NOTEBOOKLM_STT_GET_STATUS, handler=get_status)

    def update_settings_handler(params, request_id, context):
        params = params or {}
        enabled = bool(params.get("enabled"))
        apply_notebooklm_auto_convert(enabled, bool(params.get("run_scan", enabled)))
        return {"success": True, "enabled": enabled}

    server.post(name=UI_NOTEBOOKLM_STT_UPDATE_SETTINGS, handler=update_settings_handler)

    server.post(name=UI_NOTEBOOKLM_STT_CONVERT_ALL, handler=convert_all_audio)

    def convert_single_handler(params, request_id, context):
        params = params or {}
        audio_file = str(params.get("audio_file") or "").strip()
        if not audio_file:
            return {"success": False, "error": "audio_file is required"}
        return convert_relative_audio(audio_file)

    server.post(name=UI_NOTEBOOKLM_STT_CONVERT_SINGLE, handler=convert_single_handler)

    server.post(name=UI_NOTEBOOKLM_STT_LIST_AUDIO_FILES, handler=list_audio_files)
    server.post(name=UI_NOTEBOOKLM_STT_CLEAR_CACHE, handler=clear_cache)
