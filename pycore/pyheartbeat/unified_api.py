#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Task API

Provides simple, intuitive methods for task submission.
"""

import threading
from typing import Dict, Any, Optional, Callable
from pycore.pyfoundations import Task, TaskPriority, get_global_task_queue


class UnifiedTaskAPI:
    """
    Unified interface for task submission

    Provides high-level methods for submitting tasks to the global queue.
    """

    _instance: Optional['UnifiedTaskAPI'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize unified API"""
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._initialized = True
        self._task_queue = get_global_task_queue()

    def addTTSTask(
        self,
        text: str,
        voice: str = 'default',
        speed: float = 1.0,
        output_path: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        callback: Optional[Callable] = None,
        error_callback: Optional[Callable] = None,
        max_retries: int = 3
    ) -> str:
        """
        Add TTS (Text-to-Speech) task

        Args:
            text: Text to synthesize
            voice: Voice ID (default: 'default')
            speed: Speech speed (default: 1.0)
            output_path: Output file path (optional)
            priority: Task priority (default: NORMAL)
            callback: Completion callback
            error_callback: Error callback
            max_retries: Maximum retry attempts

        Returns:
            Task ID
        """
        task = Task(
            task_type='tts',
            task_data={
                'text': text,
                'voice': voice,
                'speed': speed,
                'output_path': output_path
            },
            priority=priority,
            callback=callback,
            error_callback=error_callback,
            max_retries=max_retries
        )

        self._task_queue.put(task)
        return task.task_id

    def addRPCTask(
        self,
        method: str,
        params: Dict[str, Any],
        client_id: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        callback: Optional[Callable] = None,
        error_callback: Optional[Callable] = None,
        max_retries: int = 3
    ) -> str:
        """
        Add RPC task

        Args:
            method: RPC method name
            params: Method parameters
            client_id: Client ID (optional)
            priority: Task priority (default: NORMAL)
            callback: Completion callback
            error_callback: Error callback
            max_retries: Maximum retry attempts

        Returns:
            Task ID
        """
        task = Task(
            task_type='rpc',
            task_data={
                'method': method,
                'params': params,
                'client_id': client_id
            },
            priority=priority,
            callback=callback,
            error_callback=error_callback,
            max_retries=max_retries
        )

        self._task_queue.put(task)
        return task.task_id

    def addUITask(
        self,
        action: str,
        params: Dict[str, Any],
        priority: TaskPriority = TaskPriority.HIGH,
        callback: Optional[Callable] = None,
        error_callback: Optional[Callable] = None,
        max_retries: int = 3
    ) -> str:
        """
        Add Native UI task

        Args:
            action: UI action (e.g., 'show_notification', 'update_status')
            params: Action parameters
            priority: Task priority (default: HIGH)
            callback: Completion callback
            error_callback: Error callback
            max_retries: Maximum retry attempts

        Returns:
            Task ID
        """
        task = Task(
            task_type='ui',
            task_data={
                'action': action,
                'params': params
            },
            priority=priority,
            callback=callback,
            error_callback=error_callback,
            max_retries=max_retries
        )

        self._task_queue.put(task)
        return task.task_id

    def addBrowserTask(
        self,
        action: str,
        url: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        callback: Optional[Callable] = None,
        error_callback: Optional[Callable] = None,
        max_retries: int = 3
    ) -> str:
        """
        Add PyBrowser/Selenium task

        Args:
            action: Browser action (e.g., 'navigate', 'click', 'extract')
            url: Target URL (optional)
            params: Action parameters
            priority: Task priority (default: NORMAL)
            callback: Completion callback
            error_callback: Error callback
            max_retries: Maximum retry attempts

        Returns:
            Task ID
        """
        task = Task(
            task_type='browser',
            task_data={
                'action': action,
                'url': url,
                'params': params or {}
            },
            priority=priority,
            callback=callback,
            error_callback=error_callback,
            max_retries=max_retries
        )

        self._task_queue.put(task)
        return task.task_id

    def hasTask(self, task_id: str) -> bool:
        """
        Check if task exists

        Args:
            task_id: Task ID

        Returns:
            True if task exists
        """
        task = self._task_queue.get_task(task_id)
        return task is not None

    def getTask(self, task_id: str) -> Optional[Dict]:
        """
        Get task status and details

        Args:
            task_id: Task ID

        Returns:
            Task details dictionary or None
        """
        task = self._task_queue.get_task(task_id)
        return task.to_dict() if task else None

    def cancelTask(self, task_id: str) -> bool:
        """
        Cancel task

        Args:
            task_id: Task ID

        Returns:
            True if task was cancelled
        """
        return self._task_queue.remove(task_id)

    def getStats(self) -> Dict[str, Any]:
        """
        Get system statistics

        Returns:
            Dictionary with system statistics
        """
        from pycore.pyheartbeat.heartbeat_system import get_heartbeat_system

        system = get_heartbeat_system()
        return system.get_stats()


_unified_api: Optional[UnifiedTaskAPI] = None
_api_lock = threading.Lock()


def get_unified_api() -> UnifiedTaskAPI:
    """
    Get unified API singleton

    Returns:
        UnifiedTaskAPI instance
    """
    global _unified_api

    if _unified_api is None:
        with _api_lock:
            if _unified_api is None:
                _unified_api = UnifiedTaskAPI()

    return _unified_api


__all__ = [
    'UnifiedTaskAPI',
    'get_unified_api'
]
