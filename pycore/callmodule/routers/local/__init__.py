# -*- coding: utf-8 -*-
"""Local Processing Routers Package"""
from .screenshot_router import router as screenshot_router
from .image_router import router as image_router
from .audio_router import router as audio_router
from .file_router import router as file_router
from .video_router import router as video_router
from .video_extract_router import router as video_extract_router
from .system_resources_router import router as system_resources_router
from .user_data_router import router as user_data_router
from .books_router import router as books_router
from .corebook_router import router as corebook_router
from .ai_probe_router import router as ai_probe_router
from .ai_chat_router import router as ai_chat_router
from .ai_image_router import router as ai_image_router
from .ai_keys_router import router as ai_keys_router
from .ocr_status_router import router as ocr_status_router
from .tts_status_router import router as tts_status_router
from .stt_status_router import router as stt_status_router
from .engines_load_status_router import router as engines_load_status_router
from .speech_history_router import router as speech_history_router
from .capability_status_router import router as capability_status_router
from .translation_queue_router import router as translation_queue_router
from .task_center_router import router as task_center_router
from .queue_overview_router import router as queue_overview_router
from .task_history_router import router as task_history_router
from .assist_router import router as assist_router
from .poster_router import router as poster_router
from .image_search_router import router as image_search_router
from .sentence_audio_router import router as sentence_audio_router
from .queue_bumps_router import router as queue_bumps_router
from .dictionary_router import router as dictionary_router
from .word_audio_router import router as word_audio_router
from .word_tts_router import router as word_tts_router
from .vocabulary_router import router as vocabulary_router
from .heartbeat_workers_router import router as heartbeat_workers_router
from .agent_history_router import router as agent_history_router
from .task_settings_router import router as task_settings_router
from .version_router import router as version_router

__all__ = ["screenshot_router", "image_router", "audio_router", "file_router", "video_router", "video_extract_router", "system_resources_router", "user_data_router", "books_router", "corebook_router", "ai_probe_router", "ai_chat_router", "ai_image_router", "ai_keys_router", "ocr_status_router", "tts_status_router", "stt_status_router", "engines_load_status_router", "speech_history_router", "capability_status_router", "translation_queue_router", "task_center_router", "queue_overview_router", "task_history_router", "assist_router", "poster_router", "image_search_router", "sentence_audio_router", "queue_bumps_router", "dictionary_router", "word_audio_router", "word_tts_router", "vocabulary_router", "heartbeat_workers_router", "agent_history_router", "task_settings_router", "version_router"]
