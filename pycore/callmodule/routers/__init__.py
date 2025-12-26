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
<<<<<<< HEAD
from .singleton_router import singleton_router
from .web_router import router as web_router
from .code_sync_router import router as code_sync_router
=======
from .code_sync_router import router as code_sync_router
from .notebooklm_stt_router import router as notebooklm_stt_router
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798

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
    'code_sync_router'
=======
    'code_sync_router',
    'notebooklm_stt_router'
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
]
