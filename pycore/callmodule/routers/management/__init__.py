# -*- coding: utf-8 -*-
"""
Management Routers Package
"""

from .status_router import router as status_router
from .config_router import router as config_router
from .control_router import router as control_router
from .logs_router import router as logs_router
from .capabilities_router import router as capabilities_router
from .local_config_router import router as local_config_router
from .local_stats_router import router as local_stats_router
from .local_test_router import router as local_test_router
from .heartbeat_router import router as heartbeat_router

__all__ = [
    "status_router",
    "config_router",
    "control_router",
    "logs_router",
    "capabilities_router",
    "local_config_router",
    "local_stats_router",
    "local_test_router",
    "heartbeat_router",
]
