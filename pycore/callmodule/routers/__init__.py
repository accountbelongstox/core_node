# -*- coding: utf-8 -*-
"""
API Routers
"""

from .health_router import health_router
from .module_call_router import module_call_router
from .ocr_router import ocr_router
from .translator_router import translator_router
from .mcp_router import mcp_router
from .singleton_router import singleton_router
from .web_router import router as web_router
from .code_sync_router import router as code_sync_router
from .voice_subtitle_router import router as voice_subtitle_router
from .notebooklm_stt_router import router as notebooklm_stt_router

__all__ = [
    'health_router',
    'module_call_router',
    'ocr_router',
    'translator_router',
    'mcp_router',
    'singleton_router',
    'web_router',
    'code_sync_router',
    'voice_subtitle_router',
    'notebooklm_stt_router'
]
