#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyHeartbeat - Global Task Scheduler and Thread Management System

Lightweight, thread-pool-based task dispatching system with no hardcoded dependencies.
Threads register themselves with task type handlers, and heartbeat pusher routes tasks
to registered threads based on task_type.

Architecture:
1. GlobalTaskQueue (in pyfoundations) - Thread-safe priority queue
2. GlobalThreadPool - Centralized thread registry with task type handlers
3. HeartbeatPusher - 1-second heartbeat loop for task distribution
4. UnifiedTaskAPI - Simple task submission interface
5. HeartbeatSystem - Central coordinator

Usage:
    from pycore.pyheartbeat import initialize_heartbeat_system, get_unified_api, get_global_thread_pool
    from pycore.pyfoundations import Task, TaskPriority

    # Step 1: Initialize and start heartbeat system
    system = initialize_heartbeat_system()
    system.start()

    # Step 2: Register thread with task handlers
    thread_pool = get_global_thread_pool()

    def accept_tts_task(task: Task) -> bool:
        if tts_queue.qsize() < 10:
            tts_queue.put(task)
            task.mark_running()
            return True
        return False

    thread_pool.register_thread(
        name='tts_worker',
        instance=tts_thread,
        task_handlers={
            'tts': accept_tts_task,
            'audio': accept_audio_task
        },
        metadata={'max_queue_size': 10}
    )

    # Step 3: Submit tasks via unified API
    api = get_unified_api()
    task_id = api.addTTSTask(text='Hello World', priority=TaskPriority.HIGH)

    # Step 4: Check status
    status = api.getTask(task_id)

Reference: PYHEARTBEAT_ARCHITECTURE.md
"""

from pycore.pyheartbeat.heartbeat_system import (
    HeartbeatSystem,
    get_heartbeat_system,
    initialize_heartbeat_system
)

from pycore.pyheartbeat.unified_api import (
    UnifiedTaskAPI,
    get_unified_api
)

from pycore.pyheartbeat.thread_pool import (
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    get_global_thread_pool,
    get_thread_pool_from_encyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
)

from pycore.pyheartbeat.heartbeat_pusher import HeartbeatPusher

__all__ = [
    # System
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system',

    # Unified API
    'UnifiedTaskAPI',
    'get_unified_api',

    # Thread Pool
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',

    # Heartbeat Pusher
    'HeartbeatPusher',
]

__version__ = '2.0.0'
