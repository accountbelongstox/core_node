# -*- coding: utf-8 -*-
"""Register every callmodule HTTP controller group."""

from pycore.callmodule.rpc_routes.code_sync_routes import register_code_sync_routes
from pycore.callmodule.rpc_routes.corebook_routes import register_corebook_routes
from pycore.callmodule.rpc_routes.local_agent_history_routes import register_local_agent_history_routes
from pycore.callmodule.rpc_routes.local_ai_chat_routes import register_local_ai_chat_routes
from pycore.callmodule.rpc_routes.local_ai_image_routes import register_local_ai_image_routes
from pycore.callmodule.rpc_routes.local_ai_keys_routes import register_local_ai_keys_routes
from pycore.callmodule.rpc_routes.local_ai_probe_routes import register_local_ai_probe_routes
from pycore.callmodule.rpc_routes.local_assist_routes import register_local_assist_routes
from pycore.callmodule.rpc_routes.local_books_routes import register_local_books_routes
from pycore.callmodule.rpc_routes.local_capability_status_routes import register_local_capability_status_routes
from pycore.callmodule.rpc_routes.local_dictionary_routes import register_local_dictionary_routes
from pycore.callmodule.rpc_routes.local_engine_test_routes import register_local_engine_test_routes
from pycore.callmodule.rpc_routes.local_engines_load_status_routes import register_local_engines_load_status_routes
from pycore.callmodule.rpc_routes.local_image_search_routes import register_local_image_search_routes
from pycore.callmodule.rpc_routes.local_llm_status_routes import register_local_llm_status_routes
from pycore.callmodule.rpc_routes.local_queue_accept_routes import register_local_queue_accept_routes
from pycore.callmodule.rpc_routes.local_local_config_routes import register_local_local_config_routes
from pycore.callmodule.rpc_routes.local_ocr_status_routes import register_local_ocr_status_routes
from pycore.callmodule.rpc_routes.local_sentence_audio_routes import register_local_sentence_audio_routes
from pycore.callmodule.rpc_routes.local_speech_history_routes import register_local_speech_history_routes
from pycore.callmodule.rpc_routes.local_stt_status_routes import register_local_stt_status_routes
from pycore.callmodule.rpc_routes.local_subtitle_search_routes import register_local_subtitle_search_routes
from pycore.callmodule.rpc_routes.local_system_resources_routes import register_local_system_resources_routes
from pycore.callmodule.rpc_routes.local_task_center_routes import register_local_task_center_routes
from pycore.callmodule.rpc_routes.local_task_history_routes import register_local_task_history_routes
from pycore.callmodule.rpc_routes.local_task_settings_routes import register_local_task_settings_routes
from pycore.callmodule.rpc_routes.local_translate_routes import register_local_translate_routes
from pycore.callmodule.rpc_routes.local_tts_status_routes import register_local_tts_status_routes
from pycore.callmodule.rpc_routes.local_user_data_routes import register_local_user_data_routes
from pycore.callmodule.rpc_routes.local_version_routes import register_local_version_routes
from pycore.callmodule.rpc_routes.local_video_extract_routes import register_local_video_extract_routes
from pycore.callmodule.rpc_routes.local_word_audio_routes import register_local_word_audio_routes
from pycore.callmodule.rpc_routes.local_word_tts_routes import register_local_word_tts_routes
from pycore.callmodule.rpc_routes.management_config_routes import register_management_config_routes
from pycore.callmodule.rpc_routes.management_control_routes import register_management_control_routes
from pycore.callmodule.rpc_routes.media_routes import register_media_routes
from pycore.callmodule.rpc_routes.notebooklm_stt_routes import register_notebooklm_stt_routes
from pycore.callmodule.rpc_routes.operation_routes import register_operation_routes
from pycore.callmodule.rpc_routes.pycore_manager_ui_state_routes import (
    register_pycore_manager_ui_state_routes,
)
from pycore.callmodule.rpc_routes.qwen_http_routes import register_qwen_http_routes
from pycore.callmodule.rpc_routes.thread_bus_routes import register_thread_bus_routes
from pycore.callmodule.rpc_routes.video_extract_routes import register_video_extract_routes
from pycore.callmodule.rpc_routes.voice_subtitle_routes import register_voice_subtitle_routes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


HTTP_ROUTE_REGISTRARS = (
    register_thread_bus_routes,
    register_video_extract_routes,
    register_media_routes,
    register_corebook_routes,
    register_local_engine_test_routes,
    register_code_sync_routes,
    register_local_books_routes,
    register_local_ai_chat_routes,
    register_notebooklm_stt_routes,
    register_voice_subtitle_routes,
    register_local_agent_history_routes,
    register_local_translate_routes,
    register_local_subtitle_search_routes,
    register_local_ai_image_routes,
    register_local_ai_keys_routes,
    register_local_ai_probe_routes,
    register_local_assist_routes,
    register_local_capability_status_routes,
    register_local_dictionary_routes,
    register_local_engines_load_status_routes,
    register_local_image_search_routes,
    register_local_llm_status_routes,
    register_local_ocr_status_routes,
    register_local_queue_accept_routes,
    register_local_sentence_audio_routes,
    register_local_speech_history_routes,
    register_local_stt_status_routes,
    register_local_system_resources_routes,
    register_local_task_center_routes,
    register_local_task_history_routes,
    register_local_task_settings_routes,
    register_local_tts_status_routes,
    register_local_user_data_routes,
    register_local_version_routes,
    register_local_video_extract_routes,
    register_local_word_audio_routes,
    register_local_word_tts_routes,
    register_management_config_routes,
    register_management_control_routes,
    register_local_local_config_routes,
    register_operation_routes,
    register_pycore_manager_ui_state_routes,
    register_qwen_http_routes,
)


def register_http_routes(server) -> None:
    """Register all HTTP controllers and fail loudly on broken wiring."""
    for registrar in HTTP_ROUTE_REGISTRARS:
        registrar(server)
    ColorPrint.green(
        f"[ConfigBuilder] Registered {len(server.list_routes())} HTTP routes"
    )
