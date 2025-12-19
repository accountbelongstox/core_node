#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Thread Pool

Centralized registry for all threads and their task processing capabilities.
Thread pool mappings are stored in Encyclopedia for global access.
"""

import threading
import time
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field, asdict
from pycore.pyfoundations import ColorPrint, Task, ENCYCLOPEDIA


THREAD_POOL_THREADS_KEY = 'heartbeat.thread_pool.threads'
THREAD_POOL_TASK_HANDLERS_KEY = 'heartbeat.thread_pool.task_type_handlers'


class ThreadStatus(Enum):
    """Thread status states"""
    STARTING = "starting"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class ThreadInfo:
    """Thread information container"""
    name: str
    instance: threading.Thread
    task_handlers: Dict[str, Callable[[Task], bool]]
    thread_id: Optional[int] = None
    status: ThreadStatus = ThreadStatus.STARTING
    started_at: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    shutdown_priority: int = 50  # Lower priority shuts down first

    def update_heartbeat(self):
        """Update last heartbeat timestamp"""
        self.last_heartbeat = time.time()
        if self.status == ThreadStatus.STARTING:
            self.status = ThreadStatus.RUNNING

    def is_alive(self) -> bool:
        """Check if thread is still alive"""
        return self.instance.is_alive()

    def get_uptime(self) -> float:
        """Get thread uptime in seconds"""
        return time.time() - self.started_at

    def get_heartbeat_age(self) -> float:
        """Get time since last heartbeat in seconds"""
        return time.time() - self.last_heartbeat

    def get_task_types(self) -> List[str]:
        """Get list of task types this thread can handle"""
        return list(self.task_handlers.keys())

    def get_handler(self, task_type: str) -> Optional[Callable[[Task], bool]]:
        """Get handler function for specific task type"""
        return self.task_handlers.get(task_type)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Encyclopedia storage"""
        return {
            'name': self.name,
            'thread_id': self.thread_id,
            'task_types': self.get_task_types(),
            'status': self.status.value,
            'started_at': self.started_at,
            'last_heartbeat': self.last_heartbeat,
            'uptime': self.get_uptime(),
            'heartbeat_age': self.get_heartbeat_age(),
            'alive': self.is_alive(),
            'metadata': self.metadata,
            'shutdown_priority': self.shutdown_priority
        }


class GlobalThreadPool:
    """
    Global thread pool registry

    Centralized management for all threads and their task processing capabilities.
    All mappings are stored in Encyclopedia for global access.
    """

    _instance: Optional['GlobalThreadPool'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize thread pool"""
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._initialized = True
        self._threads: Dict[str, ThreadInfo] = {}
        self._task_type_handlers: Dict[str, List[str]] = {}
        self._threads_lock = threading.Lock()

        self._sync_to_encyclopedia()

    def _sync_to_encyclopedia(self):
        """Sync thread pool mappings to Encyclopedia"""
        threads_data = {
            name: info.to_dict() for name, info in self._threads.items()
        }

        ENCYCLOPEDIA.add(THREAD_POOL_THREADS_KEY, threads_data)
        ENCYCLOPEDIA.add(THREAD_POOL_TASK_HANDLERS_KEY, self._task_type_handlers.copy())

    def register_thread(
        self,
        name: str,
        instance: threading.Thread,
        task_handlers: Dict[str, Callable[[Task], bool]],
        metadata: Optional[Dict[str, Any]] = None,
        shutdown_priority: Optional[int] = None
    ) -> bool:
        """
        Register thread with task type handlers

        Args:
            name: Thread identifier
            instance: Thread instance
            task_handlers: Dict mapping task_type to accept_task function
                          Example: {'tts': accept_tts_task, 'audio': accept_audio_task}
            metadata: Additional metadata
            shutdown_priority: Shutdown priority (lower = shutdown first)
                              If None, tries to get from THREAD_REGISTRY

        Returns:
            True if registered successfully

        Example:
            def accept_tts_task(task: Task) -> bool:
                if queue.qsize() < 10:
                    queue.put(task)
                    return True
                return False

            thread_pool.register_thread(
                name='tts_worker',
                instance=tts_thread,
                task_handlers={
                    'tts': accept_tts_task,
                    'audio': accept_audio_task
                },
                metadata={'max_queue_size': 10},
                shutdown_priority=60
            )
        """
        with self._threads_lock:
            if name in self._threads:
                ColorPrint.yellow(f"[ThreadPool] Thread '{name}' already registered")
                return False

            if not task_handlers:
                ColorPrint.red(f"[ThreadPool] Thread '{name}' has no task handlers")
                return False

            # Get shutdown priority from registry or parameter
            if shutdown_priority is None:
                from .registry import THREAD_REGISTRY
                registry_entry = THREAD_REGISTRY.get(name, {})
                shutdown_priority = registry_entry.get('shutdown_priority', 50)

            thread_info = ThreadInfo(
                name=name,
                instance=instance,
                task_handlers=task_handlers,
                thread_id=instance.ident,
                metadata=metadata or {},
                shutdown_priority=shutdown_priority
            )

            self._threads[name] = thread_info

            for task_type in task_handlers.keys():
                if task_type not in self._task_type_handlers:
                    self._task_type_handlers[task_type] = []
                self._task_type_handlers[task_type].append(name)

            self._sync_to_encyclopedia()

            task_types_str = ', '.join(task_handlers.keys())
            ColorPrint.green(
                f"[ThreadPool] Registered thread: {name} "
                f"(task_types: {task_types_str})"
            )
            return True

    def unregister_thread(self, name: str) -> bool:
        """
        Unregister thread from pool

        Args:
            name: Thread identifier

        Returns:
            True if unregistered successfully
        """
        with self._threads_lock:
            if name not in self._threads:
                return False

            thread_info = self._threads[name]

            for task_type in thread_info.task_handlers.keys():
                if task_type in self._task_type_handlers:
                    if name in self._task_type_handlers[task_type]:
                        self._task_type_handlers[task_type].remove(name)
                    if not self._task_type_handlers[task_type]:
                        del self._task_type_handlers[task_type]

            del self._threads[name]

            self._sync_to_encyclopedia()

            ColorPrint.blue(f"[ThreadPool] Unregistered thread: {name}")
            return True

    def get_thread(self, name: str) -> Optional[ThreadInfo]:
        """
        Get thread info by name

        Args:
            name: Thread identifier

        Returns:
            ThreadInfo or None
        """
        with self._threads_lock:
            return self._threads.get(name)

    def get_all_threads(self) -> List[ThreadInfo]:
        """
        Get all registered threads

        Returns:
            List of ThreadInfo objects
        """
        with self._threads_lock:
            return list(self._threads.values())

    def get_handlers_for_task_type(self, task_type: str) -> List[tuple]:
        """
        Get list of (thread_info, handler_fn) for a specific task type

        Args:
            task_type: Task type identifier

        Returns:
            List of (ThreadInfo, handler_function) tuples
        """
        with self._threads_lock:
            thread_names = self._task_type_handlers.get(task_type, [])
            handlers = []

            for name in thread_names:
                if name in self._threads:
                    thread_info = self._threads[name]
                    handler_fn = thread_info.get_handler(task_type)
                    if handler_fn:
                        handlers.append((thread_info, handler_fn))

            return handlers

    def is_thread_alive(self, name: str) -> bool:
        """
        Check if thread is alive

        Args:
            name: Thread identifier

        Returns:
            True if thread is alive
        """
        thread_info = self.get_thread(name)
        return thread_info.is_alive() if thread_info else False

    def update_heartbeat(self, name: str):
        """
        Update thread heartbeat timestamp

        Args:
            name: Thread identifier
        """
        with self._threads_lock:
            if name in self._threads:
                self._threads[name].update_heartbeat()
                self._sync_to_encyclopedia()

    def update_status(self, name: str, status: ThreadStatus):
        """
        Update thread status

        Args:
            name: Thread identifier
            status: New status
        """
        with self._threads_lock:
            if name in self._threads:
                self._threads[name].status = status
                self._sync_to_encyclopedia()
                ColorPrint.blue(f"[ThreadPool] Thread '{name}' status: {status.value}")

    def check_health(self, heartbeat_timeout: float = 30.0) -> Dict[str, List[str]]:
        """
        Check health of all threads

        Args:
            heartbeat_timeout: Heartbeat timeout in seconds

        Returns:
            Dictionary with healthy and unhealthy thread names
        """
        healthy = []
        unhealthy = []

        with self._threads_lock:
            for name, thread_info in self._threads.items():
                if not thread_info.is_alive():
                    unhealthy.append(name)
                elif thread_info.get_heartbeat_age() > heartbeat_timeout:
                    unhealthy.append(name)
                else:
                    healthy.append(name)

        return {
            'healthy': healthy,
            'unhealthy': unhealthy
        }

    def get_stats(self) -> Dict[str, Any]:
        """
        Get thread pool statistics

        Returns:
            Dictionary with statistics
        """
        with self._threads_lock:
            total = len(self._threads)
            status_counts = {}

            for thread_info in self._threads.values():
                status = thread_info.status.value
                status_counts[status] = status_counts.get(status, 0) + 1

            return {
                'total_threads': total,
                'status_counts': status_counts,
                'task_type_handlers': {
                    task_type: handlers.copy()
                    for task_type, handlers in self._task_type_handlers.items()
                },
                'threads': {
                    name: info.to_dict()
                    for name, info in self._threads.items()
                }
            }

    def get_shutdown_order(self) -> List[tuple]:
        """
        Get threads in shutdown order (by priority, lower first)

        Returns:
            List of (thread_name, thread_info, priority) tuples sorted by priority
        """
        with self._threads_lock:
            threads_with_priority = [
                (name, info, info.shutdown_priority)
                for name, info in self._threads.items()
            ]
            # Sort by priority (lower priority shuts down first)
            threads_with_priority.sort(key=lambda x: x[2])
            return threads_with_priority

    def shutdown_by_priority(
        self,
        shutdown_callback: Optional[Callable[[str, Any], None]] = None,
        timeout_per_thread: float = 5.0
    ) -> Dict[str, bool]:
        """
        Shutdown all threads in priority order

        Args:
            shutdown_callback: Optional callback(thread_name, thread_instance) to shutdown thread
                              If None, will call thread.stop() if available
            timeout_per_thread: Max wait time per thread (seconds)

        Returns:
            Dictionary mapping thread_name to success status
        """
        shutdown_order = self.get_shutdown_order()
        results = {}

        ColorPrint.blue("[ThreadPool] Starting prioritized shutdown...")
        ColorPrint.blue(f"[ThreadPool] Shutdown order: {[name for name, _, _ in shutdown_order]}")

        for thread_name, thread_info, priority in shutdown_order:
            ColorPrint.yellow(f"[ThreadPool] Shutting down '{thread_name}' (priority: {priority})...")

            try:
                # Call custom shutdown callback if provided
                if shutdown_callback:
                    shutdown_callback(thread_name, thread_info.instance)
                # Otherwise try to call stop() method if available
                elif hasattr(thread_info.instance, 'stop'):
                    thread_info.instance.stop()
                else:
                    ColorPrint.yellow(f"[ThreadPool] No shutdown method for '{thread_name}'")

                # Wait for thread to finish with timeout
                if thread_info.instance.is_alive():
                    thread_info.instance.join(timeout=timeout_per_thread)

                    if thread_info.instance.is_alive():
                        ColorPrint.red(f"[ThreadPool] Thread '{thread_name}' did not stop within timeout")
                        results[thread_name] = False
                    else:
                        ColorPrint.green(f"[ThreadPool] Thread '{thread_name}' stopped successfully")
                        results[thread_name] = True
                else:
                    ColorPrint.green(f"[ThreadPool] Thread '{thread_name}' already stopped")
                    results[thread_name] = True

                # Unregister thread
                self.unregister_thread(thread_name)

            except Exception as e:
                ColorPrint.red(f"[ThreadPool] Error shutting down '{thread_name}': {e}")
                results[thread_name] = False

        ColorPrint.green("[ThreadPool] Prioritized shutdown complete")
        return results


_global_thread_pool: Optional[GlobalThreadPool] = None
_pool_lock = threading.Lock()


def get_global_thread_pool() -> GlobalThreadPool:
    """
    Get global thread pool singleton

    Returns:
        GlobalThreadPool instance
    """
    global _global_thread_pool

    if _global_thread_pool is None:
        with _pool_lock:
            if _global_thread_pool is None:
                _global_thread_pool = GlobalThreadPool()

    return _global_thread_pool


def get_thread_pool_from_encyclopedia() -> Optional[Dict[str, Any]]:
    """
    Get thread pool information from Encyclopedia

    Returns:
        Dictionary with threads and task_type_handlers, or None if not initialized
    """
    threads = ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY)
    task_handlers = ENCYCLOPEDIA.get(THREAD_POOL_TASK_HANDLERS_KEY)

    if threads is None or task_handlers is None:
        return None

    return {
        'threads': threads,
        'task_type_handlers': task_handlers
    }


__all__ = [
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',
]
