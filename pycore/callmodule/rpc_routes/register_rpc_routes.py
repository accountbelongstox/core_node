# -*- coding: utf-8 -*-
"""
RPC Routes - Modular Route Registration for the desktop UI WS bridge.

Exports the per-area route registration functions called by
callmodule.config._init_rpc_routes. Mirrors the pycore/pyctl/speech/rpc/routes
convention: one file per functional area, each exposing a
``register_<area>_routes(server)`` function.
"""

import importlib
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_ROUTE_MODULES = [
    ("pycore.callmodule.rpc_routes.thread_bus_routes", "register_thread_bus_routes"),
    ("pycore.callmodule.rpc_routes.video_extract_routes", "register_video_extract_routes"),
    ("pycore.callmodule.rpc_routes.media_routes", "register_media_routes"),
    ("pycore.callmodule.rpc_routes.corebook_routes", "register_corebook_routes"),
    ("pycore.callmodule.rpc_routes.laravel_api_routes", "register_laravel_api_routes"),
    ("pycore.callmodule.rpc_routes.router_rpc_routes", "register_router_rpc_routes"),
    ("pycore.callmodule.rpc_routes.local_engine_test_routes", "register_local_engine_test_routes"),
    ("pycore.callmodule.rpc_routes.native_ui_routes", "register_native_ui_routes"),
    ("pycore.callmodule.rpc_routes.code_sync_routes", "register_code_sync_routes"),
    ("pycore.callmodule.rpc_routes.management_routes", "register_management_routes"),
    ("pycore.callmodule.rpc_routes.system_routes", "register_system_routes"),
    ("pycore.callmodule.rpc_routes.local_books_routes", "register_local_books_routes"),
    ("pycore.callmodule.rpc_routes.local_ai_chat_routes", "register_local_ai_chat_routes"),
    ("pycore.callmodule.rpc_routes.notebooklm_stt_routes", "register_notebooklm_stt_routes"),
    ("pycore.callmodule.rpc_routes.voice_subtitle_routes", "register_voice_subtitle_routes"),
    ("pycore.callmodule.rpc_routes.web_routes", "register_web_routes"),
    ("pycore.callmodule.rpc_routes.local_agent_history_routes", "register_local_agent_history_routes"),
    ("pycore.callmodule.rpc_routes.local_translate_routes", "register_local_translate_routes"),
    ("pycore.callmodule.rpc_routes.local_subtitle_search_routes", "register_local_subtitle_search_routes"),
    ("pycore.callmodule.rpc_routes.local_ai_image_routes", "register_local_ai_image_routes"),
    ("pycore.callmodule.rpc_routes.local_ai_keys_routes", "register_local_ai_keys_routes"),
    ("pycore.callmodule.rpc_routes.local_ai_probe_routes", "register_local_ai_probe_routes"),
    ("pycore.callmodule.rpc_routes.local_assist_routes", "register_local_assist_routes"),
    ("pycore.callmodule.rpc_routes.local_capability_status_routes", "register_local_capability_status_routes"),
    ("pycore.callmodule.rpc_routes.local_dictionary_routes", "register_local_dictionary_routes"),
    ("pycore.callmodule.rpc_routes.local_engines_load_status_routes", "register_local_engines_load_status_routes"),
    ("pycore.callmodule.rpc_routes.local_heartbeat_workers_routes", "register_local_heartbeat_workers_routes"),
    ("pycore.callmodule.rpc_routes.local_image_search_routes", "register_local_image_search_routes"),
    ("pycore.callmodule.rpc_routes.local_llm_status_routes", "register_local_llm_status_routes"),
    ("pycore.callmodule.rpc_routes.local_ocr_status_routes", "register_local_ocr_status_routes"),
    ("pycore.callmodule.rpc_routes.local_queue_bumps_routes", "register_local_queue_bumps_routes"),
    ("pycore.callmodule.rpc_routes.local_queue_overview_routes", "register_local_queue_overview_routes"),
    ("pycore.callmodule.rpc_routes.local_queue_priority_routes", "register_local_queue_priority_routes"),
    ("pycore.callmodule.rpc_routes.local_sentence_audio_routes", "register_local_sentence_audio_routes"),
    ("pycore.callmodule.rpc_routes.local_speech_history_routes", "register_local_speech_history_routes"),
    ("pycore.callmodule.rpc_routes.local_stt_status_routes", "register_local_stt_status_routes"),
    ("pycore.callmodule.rpc_routes.local_system_resources_routes", "register_local_system_resources_routes"),
    ("pycore.callmodule.rpc_routes.local_task_center_routes", "register_local_task_center_routes"),
    ("pycore.callmodule.rpc_routes.local_task_history_routes", "register_local_task_history_routes"),
    ("pycore.callmodule.rpc_routes.local_task_settings_routes", "register_local_task_settings_routes"),
    ("pycore.callmodule.rpc_routes.local_translation_queue_routes", "register_local_translation_queue_routes"),
    ("pycore.callmodule.rpc_routes.local_tts_status_routes", "register_local_tts_status_routes"),
    ("pycore.callmodule.rpc_routes.local_version_routes", "register_local_version_routes"),
    ("pycore.callmodule.rpc_routes.local_video_extract_routes", "register_local_video_extract_routes"),
    ("pycore.callmodule.rpc_routes.local_vocabulary_routes", "register_local_vocabulary_routes"),
    ("pycore.callmodule.rpc_routes.local_word_audio_routes", "register_local_word_audio_routes"),
    ("pycore.callmodule.rpc_routes.local_word_tts_routes", "register_local_word_tts_routes"),
    ("pycore.callmodule.rpc_routes.management_config_routes", "register_management_config_routes"),
    ("pycore.callmodule.rpc_routes.management_control_routes", "register_management_control_routes"),
    ("pycore.callmodule.rpc_routes.management_heartbeat_routes", "register_management_heartbeat_routes"),
    ("pycore.callmodule.rpc_routes.local_local_config_routes", "register_local_local_config_routes"),
    ("pycore.callmodule.rpc_routes.management_logs_routes", "register_management_logs_routes"),
    ("pycore.callmodule.rpc_routes.operation_routes", "register_operation_routes"),
    ("pycore.callmodule.rpc_routes.qwen_rpc_routes", "register_qwen_rpc_routes"),
]

def register_rpc_routes(server):
    """Register every callmodule RPC v2 route group.

    Each registrar is isolated: one failure must not skip the remaining groups.
    """
    for mod_name, func_name in _ROUTE_MODULES:
        try:
            mod = importlib.import_module(mod_name)
            registrar = getattr(mod, func_name)
            registrar(server)
        except Exception as e:
            ColorPrint.yellow(f"[RPC Routes] feature_unavailable: {mod_name} failed to load: {e}")

__all__ = ["register_rpc_routes"]
