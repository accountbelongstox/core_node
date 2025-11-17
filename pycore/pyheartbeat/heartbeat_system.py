#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Heartbeat System

Central coordinator for the PyHeartbeat system.
"""

import threading
from typing import Optional
from pycore.pyfoundations import ColorPrint, get_global_task_queue
from pycore.pyheartbeat.thread_pool import GlobalThreadPool, get_global_thread_pool
from pycore.pyheartbeat.heartbeat_pusher import HeartbeatPusher
from pycore.pyheartbeat.unified_api import UnifiedTaskAPI, get_unified_api


class HeartbeatSystem:
    """
    Heartbeat system coordinator

    Manages the heartbeat pusher and provides system-level operations.
    """

    _instance: Optional['HeartbeatSystem'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize heartbeat system"""
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._initialized = True
        self._running = False

        self._task_queue = get_global_task_queue()
        self._thread_pool = get_global_thread_pool()
        self._unified_api = get_unified_api()

        self._heartbeat_pusher: Optional[HeartbeatPusher] = None

        self._config = {
            'tick_interval': 1.0,
            'heartbeat_timeout': 30.0
        }

    def start(self, tick_interval: Optional[float] = None):
        """
        Start heartbeat system

        Args:
            tick_interval: Heartbeat tick interval (default: 1.0s)
        """
        if self._running:
            ColorPrint.yellow("[HeartbeatSystem] Already running")
            return

        if tick_interval is not None:
            self._config['tick_interval'] = tick_interval

        ColorPrint.green("[HeartbeatSystem] Starting...")

        self._heartbeat_pusher = HeartbeatPusher(
            tick_interval=self._config['tick_interval'],
            thread_pool=self._thread_pool
        )
        self._heartbeat_pusher.start()

        self._running = True

        ColorPrint.green("[HeartbeatSystem] Started successfully")

    def stop(self):
        """Stop heartbeat system"""
        if not self._running:
            return

        ColorPrint.yellow("[HeartbeatSystem] Stopping...")

        if self._heartbeat_pusher:
            self._heartbeat_pusher.stop()
            self._heartbeat_pusher.join(timeout=5.0)

        self._running = False

        ColorPrint.blue("[HeartbeatSystem] Stopped")

    def is_running(self) -> bool:
        """Check if system is running"""
        return self._running and (
            self._heartbeat_pusher is not None and
            self._heartbeat_pusher.is_running()
        )

    def get_api(self) -> UnifiedTaskAPI:
        """Get unified API"""
        return self._unified_api

    def get_stats(self) -> dict:
        """Get comprehensive system statistics"""
        stats = {
            'running': self._running,
            'config': self._config.copy(),
            'thread_pool': self._thread_pool.get_stats(),
            'task_queue': self._task_queue.get_stats()
        }

        if self._heartbeat_pusher:
            stats['heartbeat_pusher'] = self._heartbeat_pusher.get_stats()

        return stats

    def check_health(self) -> dict:
        """Check system health"""
        health = {
            'system_running': self._running,
            'pusher_running': self._heartbeat_pusher.is_running() if self._heartbeat_pusher else False
        }

        health['thread_pool_health'] = self._thread_pool.check_health(
            heartbeat_timeout=self._config['heartbeat_timeout']
        )

        return health


_heartbeat_system: Optional['HeartbeatSystem'] = None
_system_lock = threading.Lock()


def get_heartbeat_system() -> HeartbeatSystem:
    """
    Get heartbeat system singleton

    Returns:
        HeartbeatSystem instance
    """
    global _heartbeat_system

    if _heartbeat_system is None:
        with _system_lock:
            if _heartbeat_system is None:
                _heartbeat_system = HeartbeatSystem()

    return _heartbeat_system


def initialize_heartbeat_system() -> HeartbeatSystem:
    """
    Initialize and return heartbeat system

    This is the main entry point for starting the PyHeartbeat system.

    Returns:
        HeartbeatSystem instance
    """
    system = get_heartbeat_system()

    ColorPrint.blue("[PyHeartbeat] Initialized")
    ColorPrint.blue("[PyHeartbeat] Use system.start() to begin operation")

    return system


__all__ = [
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system'
]
