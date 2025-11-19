#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyCore Thread Pool - Unified Thread Management

Centralized thread pool and service registry for all PyCore services.

Architecture:
- registry.py: Unified thread registry (metadata + starters)
- starters.py: Service starter functions
- pool.py: GlobalThreadPool implementation

Usage:
    from pycore.pythreadpool import get_global_thread_pool, start_rpc_v2

    # Start a service
    instance = start_rpc_v2({'port': 58100})

    # Access thread pool
    pool = get_global_thread_pool()
"""

from .pool import (
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    get_global_thread_pool,
    get_thread_pool_from_encyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY,
)

from .registry import (
    THREAD_REGISTRY,
    SERVICE_STARTERS,
    register_service,
)

from .starters import (
    start_heartbeat,
    start_rpc_v2,
    start_speech,
    start_ui,
)

__all__ = [
    # Thread Pool
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',

    # Registry
    'THREAD_REGISTRY',
    'SERVICE_STARTERS',
    'register_service',

    # Starters
    'start_heartbeat',
    'start_rpc_v2',
    'start_speech',
    'start_ui',
]
