# -*- coding: utf-8 -*-
"""
API Routers
"""

# Management layer routers (NEW)
from .management import (
    status_router,
    config_router,
    control_router,
    logs_router,
    capabilities_router,
    local_config_router,
    local_stats_router,
    local_test_router,
)

# Legacy routers (still active)
from .module_call_router import module_call_router
from .mcp_router import mcp_router
from .code_sync_router import router as code_sync_router
<<<<<<< HEAD
from .voice_subtitle_router import router as voice_subtitle_router
=======
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
from .notebooklm_stt_router import router as notebooklm_stt_router

__all__ = [
    # Management routers
    'status_router',
    'config_router',
    'control_router',
    'logs_router',
    'capabilities_router',
    'local_config_router',
    'local_stats_router',
    'local_test_router',
    # Legacy routers
    'module_call_router',
    'mcp_router',
<<<<<<< HEAD
    'singleton_router',
    'web_router',
    'code_sync_router',
    'voice_subtitle_router',
=======
    'code_sync_router',
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
    'notebooklm_stt_router'
]
