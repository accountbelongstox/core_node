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
from .ai_probe_router import router as ai_probe_router
from .ai_chat_router import router as ai_chat_router
from .ai_image_router import router as ai_image_router
from .ocr_status_router import router as ocr_status_router
from .tts_status_router import router as tts_status_router
from .capability_status_router import router as capability_status_router
from .translation_queue_router import router as translation_queue_router
from .task_center_router import router as task_center_router
from .assist_router import router as assist_router

__all__ = ["screenshot_router", "image_router", "audio_router", "file_router", "video_router", "video_extract_router", "system_resources_router", "user_data_router", "books_router", "ai_probe_router", "ai_chat_router", "ai_image_router", "ocr_status_router", "tts_status_router", "capability_status_router", "translation_queue_router", "task_center_router", "assist_router"]
