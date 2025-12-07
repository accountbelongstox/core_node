# -*- coding: utf-8 -*-
"""Local Processing Routers Package"""
from .screenshot_router import router as screenshot_router
from .image_router import router as image_router
from .audio_router import router as audio_router
from .file_router import router as file_router
from .video_router import router as video_router

__all__ = ["screenshot_router", "image_router", "audio_router", "file_router", "video_router"]
