#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyHeartbeat - Unified Global Task Scheduler

Simplified, unified heartbeat system:
1. Ticks every 1 second
2. Supports callback registration with intervals (using tick counter)
3. Processes task queue
4. No additional threads

Usage:
    from pycore.pyheartbeat import get_heartbeat_system

    # Initialize and start
    system = get_heartbeat_system()
    system.start()

    # Register callback
    def my_callback():
        print("Running every 30 seconds")

    system.register_callback('my_task', my_callback, interval=30)

Reference: PYHEARTBEAT_ARCHITECTURE.md
"""

from pycore.pyheartbeat.heartbeat import (
    CallbackInfo,
    HeartbeatPusher,
    HeartbeatPusherThread,
    HeartbeatSystem,
    get_heartbeat_system,
    initialize_heartbeat_system
)

from pycore.pythreadpool import (
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    get_global_thread_pool,
    get_thread_pool_from_encyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
)

__all__ = [
    # Core System
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system',

    # Components
    'CallbackInfo',
    'HeartbeatPusher',
    'HeartbeatPusherThread',

    # Thread Pool
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',
]

__version__ = '3.0.0'  # Unified architecture
