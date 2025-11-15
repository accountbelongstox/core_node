# -*- coding: utf-8 -*-
"""
API Routers
"""

from .health_router import health_router
from .module_call_router import module_call_router
from .ocr_router import ocr_router

__all__ = ['health_router', 'module_call_router', 'ocr_router']
